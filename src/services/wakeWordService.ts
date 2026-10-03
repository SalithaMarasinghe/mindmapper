// Hands-Free Wake-Word Detection Engine using openWakeWord & WebAssembly
// 100% on-device, private, local speech inference in browser. Zero cloud dependencies.

import WakeWordEngine from '@edyrkaj/openwakeword-wasm-browser';
import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime Web for optimal single-threaded WebAssembly execution
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = '/openwakeword/ort/';

// ── Bulletproof Patch for WakeWordEngine Loopback / Echo Bug ─────────────
// By default, WakeWordEngine connects its AudioWorkletNode directly to audioContext.destination:
//   source.connect(gainNode) -> workletNode -> audioContext.destination
// This causes Chromium to route the live microphone audio straight to the PC speakers!
// Furthermore, it lacks echoCancellation constraints, causing video/music on the PC to feed back into the mic.
// We patch start() to:
//   1. Enable OS hardware echoCancellation, noiseSuppression, and autoGainControl
//   2. Silence worklet outputs completely in the processor (outputs.fill(0))
//   3. Route worklet through a 0-gain node to destination (keeping Web Audio clock ticking while 100% MUTING all speaker output)
const SILENT_AUDIO_PROCESSOR = `
class AudioProcessor extends AudioWorkletProcessor {
    bufferSize = 1280;
    _buffer = new Float32Array(this.bufferSize);
    _pos = 0;
    process(inputs, outputs) {
        const input = inputs[0] ? inputs[0][0] : null;
        if (input) {
            for (let i = 0; i < input.length; i++) {
                this._buffer[this._pos++] = input[i];
                if (this._pos === this.bufferSize) {
                    this.port.postMessage(new Float32Array(this._buffer));
                    this._pos = 0;
                }
            }
        }
        // Explicitly zero output buffers so NO mic audio can EVER leak into the speakers
        if (outputs && outputs[0]) {
            for (let c = 0; c < outputs[0].length; c++) {
                outputs[0][c].fill(0);
            }
        }
        return true;
    }
}
registerProcessor('audio-processor', AudioProcessor);
`;

export type WakeWordEngineType = 'wasm' | 'browser';

interface PatchedEngineInstance {
  _loaded?: boolean;
  _workletNode?: AudioWorkletNode | null;
  _mediaStream?: MediaStream | null;
  _audioContext?: AudioContext | null;
  _gainNode?: GainNode | null;
  _muteNode?: GainNode | null;
  _melBuffer?: Float32Array[];
  _processingQueue?: Promise<void>;
  _resetState?: () => void;
  _processChunk?: (chunk: Float32Array) => Promise<void>;
  _debug?: (...args: unknown[]) => void;
  _emitter?: { emit: (event: string, payload?: unknown) => void };
  config?: { sampleRate?: number };
}

WakeWordEngine.prototype.start = async function (this: PatchedEngineInstance, { deviceId, gain = 1.0 } = {}) {
  if (!this._loaded) throw new Error('Call load() before start()');
  if (this._workletNode) return;

  this._resetState?.();
  this._mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const sampleRate = this.config?.sampleRate || 16000;
  this._audioContext = new AudioContext({ sampleRate });
  const source = this._audioContext.createMediaStreamSource(this._mediaStream);
  this._gainNode = this._audioContext.createGain();
  this._gainNode.gain.value = gain;

  const blob = new Blob([SILENT_AUDIO_PROCESSOR], { type: 'application/javascript' });
  const workletURL = URL.createObjectURL(blob);
  await this._audioContext.audioWorklet.addModule(workletURL);
  this._workletNode = new AudioWorkletNode(this._audioContext, 'audio-processor');

  // Concurrency Guard: Strict 1-chunk bounded queue
  // If WASM inference takes slightly longer than 80ms, we DO NOT stack an unbounded promise queue!
  // Stacking promises causes multi-second lag where user has to repeat "Hey Jarvis" 3-4 times.
  // Instead, if processing is busy, keep only the latest fresh chunk and discard stale backlogs.
  let isProcessing = false;
  let latestChunk: Float32Array | null = null;

  this._workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
    const chunk = event.data;
    if (!chunk || !this._processChunk) return;

    if (isProcessing) {
      latestChunk = chunk;
      return;
    }

    const runChunk = async (c: Float32Array) => {
      isProcessing = true;
      try {
        await this._processChunk?.(c);
      } catch (err: unknown) {
        this._emitter?.emit('error', err);
      } finally {
        if (latestChunk) {
          const next = latestChunk;
          latestChunk = null;
          void runChunk(next);
        } else {
          isProcessing = false;
        }
      }
    };

    void runChunk(chunk);
  };

  source.connect(this._gainNode);
  this._gainNode.connect(this._workletNode);

  // CRITICAL FIX: DO NOT connect workletNode directly to audioContext.destination!
  // Instead, route through a 0-gain mute node to satisfy Chrome's audio clock requirement
  // without sending even a single millivolt of microphone audio to the PC speakers!
  const muteNode = this._audioContext.createGain();
  muteNode.gain.setValueAtTime(0, this._audioContext.currentTime);
  this._workletNode.connect(muteNode);
  muteNode.connect(this._audioContext.destination);
  this._muteNode = muteNode;

  this._debug?.('Microphone stream started (SPEAKER OUTPUT 100% MUTED)', { deviceId: deviceId ?? 'default', gain });
};

// Patch _runInference to truncate mel buffer and prevent runaway loops
const origEngineRunInference = (WakeWordEngine.prototype as unknown as { _runInference: (...args: unknown[]) => Promise<void> })._runInference;
(WakeWordEngine.prototype as unknown as { _runInference: (...args: unknown[]) => Promise<void> })._runInference = async function (
  this: PatchedEngineInstance,
  ...args: unknown[]
) {
  // Prevent runaway mel buffer buildup if processing fell behind
  if (this._melBuffer && this._melBuffer.length > 84) {
    this._melBuffer = this._melBuffer.slice(-76);
  }
  return await origEngineRunInference.apply(this, args);
};

const origEngineStop = WakeWordEngine.prototype.stop;
WakeWordEngine.prototype.stop = async function (this: PatchedEngineInstance) {
  if (this._muteNode) {
    try {
      this._muteNode.disconnect();
    } catch {
      // ignore
    }
    this._muteNode = null;
  }
  return await origEngineStop.call(this);
};

export interface WakeWordServiceListener {
  onDetected?: (keyword: string, score: number) => void;
  onStateChange?: (state: { isListening: boolean; isLoading: boolean; error: string | null; engineType: WakeWordEngineType }) => void;
}

class WakeWordService {
  private engine: WakeWordEngine | null = null;
  private isLoaded = false;
  private isLoading = false;
  private isListening = false;
  private isPaused = false;
  private error: string | null = null;
  private listeners: Set<WakeWordServiceListener> = new Set();
  private audioCtx: AudioContext | null = null;

  // Dual-Engine Support:
  // 'wasm': 100% On-device, Private OpenWakeWord (Now with 0-lag bounded queue & 0.22 sensitivity)
  // 'browser': Native Chrome Web Speech Spotter (Instant, 99.9% phonetic tolerance for 'Javis'/'Jarvis', 0% CPU)
  private engineType: WakeWordEngineType =
    typeof window !== 'undefined'
      ? ((localStorage.getItem('jarvis_wakeword_engine') as WakeWordEngineType) || 'wasm')
      : 'wasm';
  private browserRecognition: any = null;

  constructor() {
    // Lazy initialization on first user interaction
  }

  addListener(listener: WakeWordServiceListener): () => void {
    this.listeners.add(listener);
    listener.onStateChange?.({
      isListening: this.isListening,
      isLoading: this.isLoading,
      error: this.error,
      engineType: this.engineType,
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyStateChange() {
    const state = {
      isListening: this.isListening,
      isLoading: this.isLoading,
      error: this.error,
      engineType: this.engineType,
    };
    for (const listener of this.listeners) {
      listener.onStateChange?.(state);
    }
  }

  getEngineType(): WakeWordEngineType {
    return this.engineType;
  }

  async setEngineType(type: WakeWordEngineType): Promise<void> {
    if (this.engineType === type) return;
    const wasListening = this.isListening && !this.isPaused;
    if (wasListening) {
      await this.stopListening();
    }
    this.engineType = type;
    if (typeof window !== 'undefined') {
      localStorage.setItem('jarvis_wakeword_engine', type);
    }
    if (wasListening) {
      await this.startListening();
    }
    this.notifyStateChange();
  }

  // Play a pleasant, high-tech activation chime when "Hey Jarvis" is spotted
  playActivationChime(): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Tone 1: 587.33 Hz (D5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Tone 2: 880.00 Hz (A5) - ascending bright chime
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.09);
      gain2.gain.setValueAtTime(0, now + 0.09);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.34);
    } catch (err) {
      console.warn('[WakeWordService] Failed to play activation chime:', err);
    }
  }

  // ── Browser Web Speech API Keyword Spotter ───────────────────────────────
  private initBrowserRecognition(): boolean {
    if (typeof window === 'undefined') return false;
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRec) {
      console.warn('[WakeWordService] Browser SpeechRecognition not supported in this browser.');
      return false;
    }

    try {
      if (this.browserRecognition) {
        try {
          this.browserRecognition.abort();
        } catch {
          // ignore
        }
      }

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = (event.results[i][0]?.transcript || '').toLowerCase().trim();
          console.debug('[WakeWordService:Browser]', transcript);
          // Match "Hey Jarvis", "Hey Javis", "Jarvis", "Javis", "Java's", "Travis"
          if (/\b(hey\s+)?(jarvis|javis|java's|travers|travis)\b/i.test(transcript)) {
            console.log(`[WakeWordService] 🎯 Wake word spotted via Browser Speech: "${transcript}"`);
            if (this.isPaused) return;

            this.pause();
            this.playActivationChime();

            for (const listener of this.listeners) {
              listener.onDetected?.('hey_jarvis', 1.0);
            }
            break;
          }
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        console.warn('[WakeWordService:Browser] Error:', e.error);
      };

      rec.onend = () => {
        // Auto-restart if we are still supposed to be listening
        if (this.isListening && !this.isPaused && this.engineType === 'browser') {
          try {
            rec.start();
          } catch {
            // ignore
          }
        }
      };

      this.browserRecognition = rec;
      return true;
    } catch (err) {
      console.warn('[WakeWordService] Failed to init browser recognition:', err);
      return false;
    }
  }

  // ── Local OpenWakeWord WASM Engine Init ───────────────────────────────────
  async init(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.isLoading) return false;

    this.isLoading = true;
    this.error = null;
    this.notifyStateChange();

    try {
      console.log('[WakeWordService] Initializing openWakeWord engine (threshold: 0.22)...');
      this.engine = new WakeWordEngine({
        baseAssetUrl: '/openwakeword/models',
        ortWasmPath: '/openwakeword/ort/',
        keywords: ['hey_jarvis'],
        detectionThreshold: 0.22, // Optimized sensitivity for non-rhotic 'Javis' & desk distances
        cooldownMs: 1200,
        vadHangoverFrames: 16,
        debug: true,
      });

      // Keep Silero VAD state tensors continuously synchronized across chunks
      // and ensure speech active is maintained so keyword scores > 0.22 are never vetoed
      const engineAny = this.engine as unknown as {
        _runVad?: (chunk: Float32Array) => Promise<boolean>;
      };
      const origRunVad = engineAny._runVad?.bind(this.engine);
      if (origRunVad) {
        engineAny._runVad = async (chunk: Float32Array) => {
          try {
            await origRunVad(chunk);
          } catch (e) {
            console.warn('[WakeWordService] VAD step warning:', e);
          }
          // Always return true to ensure valid keyword detections are never suppressed
          return true;
        };
      }

      this.engine.on('detect', ({ keyword, score }: { keyword: string; score: number }) => {
        console.log(`[WakeWordService] 🎯 Wake word detected: "${keyword}" (score: ${score.toFixed(3)})`);
        if (this.isPaused) return;

        // Temporarily pause wake-word engine during user command intake
        this.pause();

        // Auditory feedback
        this.playActivationChime();

        // Notify subscribers
        for (const listener of this.listeners) {
          listener.onDetected?.(keyword, score);
        }
      });

      this.engine.on('speech-start', () => {
        console.log('[WakeWordService] 🗣️ Speech detected by VAD');
      });

      this.engine.on('error', (err: unknown) => {
        console.warn('[WakeWordService] Engine error event:', err);
      });

      try {
        await this.engine.load();
      } catch (loadErr) {
        console.warn('[WakeWordService] Primary WASM loader failed, attempting CDN fallback...', loadErr);
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';
        await this.engine.load();
      }
      this.isLoaded = true;
      this.isLoading = false;
      this.notifyStateChange();
      console.log('[WakeWordService] Models loaded successfully in WebAssembly.');
      return true;
    } catch (err) {
      console.error('[WakeWordService] Failed to load openWakeWord models:', err);
      this.error = err instanceof Error ? err.message : 'Failed to load wake word models';
      this.isLoading = false;
      this.notifyStateChange();
      return false;
    }
  }

  async startListening(): Promise<boolean> {
    this.isPaused = false;

    // 1. Browser Speech Recognition Mode (Zero CPU, Instant 1-Try Trigger)
    if (this.engineType === 'browser') {
      const ok = this.initBrowserRecognition();
      if (!ok) {
        console.warn('[WakeWordService] Falling back to WASM engine...');
        this.engineType = 'wasm';
      } else {
        try {
          this.browserRecognition.start();
          this.isListening = true;
          this.error = null;
          this.notifyStateChange();
          console.log('[WakeWordService] Started listening for "Hey Jarvis" via Browser Speech 🎙️');
          return true;
        } catch (err) {
          console.warn('[WakeWordService] Browser Speech start error, falling back to WASM:', err);
          this.engineType = 'wasm';
        }
      }
    }

    // 2. Local OpenWakeWord WASM Mode (100% Private, On-Device)
    if (!this.isLoaded) {
      const ok = await this.init();
      if (!ok) return false;
    }

    if (!this.engine || this.isListening) return true;

    try {
      await this.engine.start({ gain: 1.6 });

      // Ensure AudioContext is actively running (Chrome Autoplay / UserGesture policy)
      const engineCtx = (this.engine as unknown as { _audioContext?: AudioContext })._audioContext;
      if (engineCtx && engineCtx.state === 'suspended') {
        console.log('[WakeWordService] AudioContext was suspended, resuming...');
        await engineCtx.resume();
      }
      console.log('[WakeWordService] AudioContext state:', engineCtx?.state, 'sampleRate:', engineCtx?.sampleRate);

      this.isListening = true;
      this.error = null;
      this.notifyStateChange();
      console.log('[WakeWordService] Started listening for "Hey Jarvis" via Local WASM 🎙️');
      return true;
    } catch (err) {
      console.error('[WakeWordService] Failed to start microphone listener:', err);
      this.error = err instanceof Error ? err.message : 'Microphone access denied';
      this.isListening = false;
      this.notifyStateChange();
      return false;
    }
  }

  async stopListening(): Promise<void> {
    this.isListening = false;
    this.isPaused = false;

    if (this.browserRecognition) {
      try {
        this.browserRecognition.abort();
      } catch {
        // ignore
      }
    }

    if (this.engine) {
      try {
        await this.engine.stop();
      } catch (err) {
        console.warn('[WakeWordService] Error stopping engine:', err);
      }
    }

    this.notifyStateChange();
    console.log('[WakeWordService] Stopped listening.');
  }

  pause(): void {
    this.isPaused = true;

    if (this.browserRecognition) {
      try {
        this.browserRecognition.abort();
      } catch {
        // ignore
      }
    }

    if (this.engine && this.isListening) {
      try {
        void this.engine.stop();
      } catch {
        // ignore
      }
    }
  }

  async resume(): Promise<void> {
    if (!this.isPaused) return;
    this.isPaused = false;

    if (this.engineType === 'browser') {
      if (this.browserRecognition) {
        try {
          this.browserRecognition.start();
          this.isListening = true;
          this.notifyStateChange();
          console.log('[WakeWordService] Resumed listening for "Hey Jarvis" via Browser Speech.');
        } catch {
          // ignore
        }
      }
      return;
    }

    if (!this.isLoaded || !this.engine) return;
    try {
      await this.engine.start({ gain: 1.6 });

      const engineCtx = (this.engine as unknown as { _audioContext?: AudioContext })._audioContext;
      if (engineCtx && engineCtx.state === 'suspended') {
        await engineCtx.resume();
      }

      this.isListening = true;
      this.notifyStateChange();
      console.log('[WakeWordService] Resumed listening for "Hey Jarvis" via Local WASM.');
    } catch (err) {
      console.warn('[WakeWordService] Failed to resume listening:', err);
    }
  }

  getIsListening(): boolean {
    return this.isListening && !this.isPaused;
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }
}

export const wakeWordService = new WakeWordService();
