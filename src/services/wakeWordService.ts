// Hands-Free Wake-Word Detection Engine using openWakeWord & WebAssembly
// 100% on-device, private, local speech inference in browser. Zero cloud dependencies.

import WakeWordEngine from '@edyrkaj/openwakeword-wasm-browser';
import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime Web for optimal single-threaded WebAssembly execution
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = '/openwakeword/ort/';

export interface WakeWordServiceListener {
  onDetected?: (keyword: string, score: number) => void;
  onStateChange?: (state: { isListening: boolean; isLoading: boolean; error: string | null }) => void;
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

  constructor() {
    // Lazy initialization on first user interaction
  }

  addListener(listener: WakeWordServiceListener): () => void {
    this.listeners.add(listener);
    listener.onStateChange?.({
      isListening: this.isListening,
      isLoading: this.isLoading,
      error: this.error,
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
    };
    for (const listener of this.listeners) {
      listener.onStateChange?.(state);
    }
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

  async init(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.isLoading) return false;

    this.isLoading = true;
    this.error = null;
    this.notifyStateChange();

    try {
      console.log('[WakeWordService] Initializing openWakeWord engine...');
      this.engine = new WakeWordEngine({
        baseAssetUrl: '/openwakeword/models',
        ortWasmPath: '/openwakeword/ort/',
        keywords: ['hey_jarvis'],
        detectionThreshold: 0.45, // Optimized sensitivity for high accuracy and fast response
        cooldownMs: 2500,
        vadHangoverFrames: 16,
        debug: true,
      });

      // Hybrid VAD + RMS energy booster so speech is never missed
      const engineAny = this.engine as unknown as {
        _runVad?: (chunk: Float32Array) => Promise<boolean>;
      };
      const origRunVad = engineAny._runVad?.bind(this.engine);
      if (origRunVad) {
        engineAny._runVad = async (chunk: Float32Array) => {
          let sumSquares = 0;
          for (let i = 0; i < chunk.length; i++) {
            sumSquares += chunk[i] * chunk[i];
          }
          const rms = Math.sqrt(sumSquares / chunk.length);
          // If acoustic energy exceeds background threshold, consider speech active
          if (rms > 0.015) {
            return true;
          }
          return await origRunVad(chunk);
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

      await this.engine.load();
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
    if (!this.isLoaded) {
      const ok = await this.init();
      if (!ok) return false;
    }

    if (!this.engine || this.isListening) return true;

    try {
      this.isPaused = false;
      await this.engine.start();

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
      console.log('[WakeWordService] Started listening for "Hey Jarvis" 🎙️');
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
    if (!this.engine || !this.isListening) return;

    try {
      this.isListening = false;
      this.isPaused = false;
      await this.engine.stop();
      this.notifyStateChange();
      console.log('[WakeWordService] Stopped listening.');
    } catch (err) {
      console.warn('[WakeWordService] Error stopping engine:', err);
    }
  }

  pause(): void {
    this.isPaused = true;
    if (this.engine && this.isListening) {
      try {
        void this.engine.stop();
      } catch {
        // ignore
      }
    }
  }

  async resume(): Promise<void> {
    if (!this.isPaused || !this.isLoaded || !this.engine) return;
    try {
      this.isPaused = false;
      await this.engine.start();

      const engineCtx = (this.engine as unknown as { _audioContext?: AudioContext })._audioContext;
      if (engineCtx && engineCtx.state === 'suspended') {
        await engineCtx.resume();
      }

      this.isListening = true;
      this.notifyStateChange();
      console.log('[WakeWordService] Resumed listening for "Hey Jarvis".');
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
