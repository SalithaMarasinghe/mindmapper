// Jarvis Voice & Audio Engine
// STT: MediaRecorder → Groq Whisper (via Supabase edge function jarvis-transcribe)
// TTS: Google Cloud Text-to-Speech (Neural2 via Supabase edge function jarvis-tts)
// Fallback: Patched Web Speech API with GC & 15-second cutoff fixes
// Visualizer: Web Audio API frequency analyser

import { supabase } from '../lib/supabase';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export class JarvisVoiceService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isSpeaking = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private onOrbStateCallback:
    | ((state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'success') => void)
    | null = null;

  // ── Neural TTS state (Google Cloud Neural2) ─────────────────────────────
  private activeAudioSource: AudioBufferSourceNode | null = null;
  private ttsAbortController: AbortController | null = null;

  // ── Browser TTS fallback state ──────────────────────────────────────────
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  // ── MediaRecorder state ─────────────────────────────────────────────────
  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];
  private recordingStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  isRecording = false;

  constructor() {
    this.initVoices();
  }

  // ── Web Audio Analyser (for orb visualizer) ─────────────────────────────
  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioContext) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
        }
      }
      if (this.audioContext && !this.analyser) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.8;
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
      return this.audioContext;
    } catch (err) {
      console.warn('[JarvisVoice] AudioContext init failed:', err);
      return null;
    }
  }

  async initAudioAnalyzer(stream?: MediaStream): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.analyser) return false;

    try {
      const s =
        stream ||
        (await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        }));

      // Strip any outgoing connections on the analyser node
      // The analyser should ONLY act as a passive measurement sink for FFT & RMS, NEVER output to speakers
      if (this.analyser) {
        try {
          this.analyser.disconnect();
        } catch {
          // ignore
        }
      }

      if (this.micSourceNode) {
        try {
          this.micSourceNode.disconnect();
        } catch {
          // ignore
        }
        this.micSourceNode = null;
      }
      this.micSourceNode = ctx.createMediaStreamSource(s);
      this.micSourceNode.connect(this.analyser);
      return true;
    } catch (err) {
      console.warn('[JarvisVoice] Microphone analyser init failed:', err);
      return false;
    }
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  getLiveAudioLevel(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    return Math.min(1, sum / dataArray.length / 128);
  }

  // Time-domain Root-Mean-Square (RMS) amplitude for precision voice-activity and silence detection
  getLiveRMS(): number {
    if (!this.analyser) return 0;
    const bufferLength = this.analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / bufferLength);
  }

  // ── MediaRecorder: Start Recording ─────────────────────────────────────
  async startRecording(): Promise<boolean> {
    // Immediately interrupt and kill any active speech narration
    this.stopSpeaking();
    if (this.isRecording) return true;

    try {
      let stream = this.recordingStream;
      const isStreamActive =
        Boolean(stream) &&
        stream!.getAudioTracks().length > 0 &&
        stream!.getAudioTracks().some((t) => t.readyState === 'live');

      if (!isStreamActive || !stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        this.recordingStream = stream;
      }
      this.recordingChunks = [];

      // Pick best supported codec
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      this.mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordingChunks.push(e.data);
      };

      this.mediaRecorder.start(100); // collect chunks every 100ms
      this.isRecording = true;

      // Ensure analyser is initialized and attached before returning
      await this.initAudioAnalyzer(stream);

      return true;
    } catch (err) {
      console.error('[JarvisVoice] Failed to start recording:', err);
      return false;
    }
  }

  // ── MediaRecorder: Stop and return audio blob ───────────────────────────
  stopRecording(releaseStream = false): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.isRecording = false;
        if (releaseStream) {
          this.releaseMediaStream();
        }
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recordingChunks, { type: mimeType });
        this.recordingChunks = [];
        this.isRecording = false;
        this.mediaRecorder = null;

        // Only release underlying audio tracks when explicitly requested
        // (retains stream alive for smooth conversational dialogue in Voice Mode)
        if (releaseStream) {
          this.releaseMediaStream();
        }

        resolve(blob);
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.isRecording = false;
        if (releaseStream) {
          this.releaseMediaStream();
        }
        resolve(null);
      }
    });
  }

  // ── Release MediaStream and disconnect audio graph ──────────────────────
  releaseMediaStream(): void {
    if (this.recordingStream) {
      try {
        this.recordingStream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      this.recordingStream = null;
    }

    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch {
        // ignore
      }
      this.micSourceNode = null;
    }
  }

  // ── Cancel Recording without returning blob or triggering callbacks ────
  cancelRecording(releaseStream = false): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.ondataavailable = null;
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }

    this.recordingChunks = [];
    this.isRecording = false;
    this.mediaRecorder = null;

    if (releaseStream) {
      this.releaseMediaStream();
    }
  }

  // ── Whisper transcription via Supabase edge function ────────────────────
  async transcribeBlob(
    blob: Blob,
    supabaseUrl: string,
    accessToken: string,
    anonKey: string
  ): Promise<string> {
    const form = new FormData();
    let fileName = 'recording.webm';
    if (blob.type.includes('mp4') || blob.type.includes('m4a') || blob.type.includes('aac')) {
      fileName = 'recording.m4a';
    } else if (blob.type.includes('ogg')) {
      fileName = 'recording.ogg';
    } else if (blob.type.includes('wav')) {
      fileName = 'recording.wav';
    }
    form.append('audio', blob, fileName);

    const res = await fetch(`${supabaseUrl}/functions/v1/jarvis-transcribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: form,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Transcription failed (${res.status}): ${err}`);
    }

    const json = (await res.json()) as { text?: string; error?: string };
    if (json.error) throw new Error(json.error);
    return json.text?.trim() ?? '';
  }

  // ── Neural TTS: Google Cloud Text-to-Speech (Neural2) ───────────────────
  private async speakNeural(text: string, onEnd?: () => void): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!supabaseUrl) return false;

    this.ttsAbortController = new AbortController();
    const signal = this.ttsAbortController.signal;

    let accessToken = anonKey;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        accessToken = session.access_token;
      }
    } catch {
      // Proceed with anon key if no active session
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/jarvis-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        text,
        voice: 'daniel', // Refined male assistant voice
        languageCode: 'en',
        speakingRate: 1.0,
        pitch: -0.5,
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[JarvisVoice] Neural TTS edge function returned status ${res.status}:`, err);
      return false;
    }

    const data = (await res.json()) as { audioContent?: string };
    if (!data.audioContent) {
      console.warn('[JarvisVoice] Neural TTS response missing audioContent.');
      return false;
    }

    if (signal.aborted) return true;

    const ctx = this.ensureAudioContext();
    if (!ctx) return false;

    const audioData = base64ToArrayBuffer(data.audioContent);
    const audioBuffer = await ctx.decodeAudioData(audioData);

    if (signal.aborted) return true;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Connect source to destination so user hears TTS playback
    source.connect(ctx.destination);

    // Also feed source into analyser for orb visualizer, ensuring analyser itself NEVER routes to speakers
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        // ignore
      }
      source.connect(this.analyser);
    }

    this.activeAudioSource = source;
    this.isSpeaking = true;
    this.onOrbStateCallback?.('speaking');

    source.onended = () => {
      if (this.activeAudioSource === source) {
        this.activeAudioSource = null;
        this.isSpeaking = false;
        this.onOrbStateCallback?.('idle');
        onEnd?.();
      }
    };

    source.start(0);
    return true;
  }

  // ── Browser TTS Fallback (Patched for GC and 15s timeout) ────────────────
  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const scoreVoice = (v: SpeechSynthesisVoice): number => {
      let score = 0;
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();

      if (!lang.startsWith('en')) return -100;
      if (name.includes('natural') || name.includes('neural') || name.includes('online')) score += 60;
      if (lang.includes('en-gb') || lang.includes('en_gb')) score += 30;
      if (/ryan|george|daniel|oliver|guy|christopher|eric|arthur|brian|william/i.test(name)) score += 25;
      if (/male/i.test(name) && !/female/i.test(name)) score += 15;
      if (name.includes('google')) score += 10;
      if (name.includes('desktop')) score -= 25;

      return score;
    };

    const findVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      const scored = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
      this.selectedVoice = scored[0] || voices[0] || null;
    };

    findVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = findVoice;
    }
  }

  private cleanupBrowserSpeech() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    this.activeUtterance = null;
  }

  private stopBrowserSpeech() {
    if (this.activeUtterance && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.cleanupBrowserSpeech();
  }

  getActiveUtterance(): SpeechSynthesisUtterance | null {
    return this.activeUtterance;
  }

  private speakBrowser(cleanedText: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }

    this.stopBrowserSpeech();

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    if (this.selectedVoice) utterance.voice = this.selectedVoice;
    utterance.rate = 1.0;
    utterance.pitch = 0.95;

    // Retain strong reference on class instance to fix Chromium GC cutoff bug
    this.activeUtterance = utterance;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.onOrbStateCallback?.('speaking');

      // Fix Chromium 15-second speech freeze bug by pinging pause/resume
      if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = setInterval(() => {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);
    };

    const handleEnd = () => {
      this.cleanupBrowserSpeech();
      this.isSpeaking = false;
      this.onOrbStateCallback?.('idle');
      onEnd?.();
    };

    utterance.onend = handleEnd;
    utterance.onerror = (e) => {
      console.warn('[JarvisVoice] Browser fallback TTS error:', e);
      handleEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  // ── Unified Speak API ───────────────────────────────────────────────────
  speak(text: string, onEnd?: () => void) {
    // Reset previous audio silently without broadcasting idle
    this.stopSpeaking(false);

    const cleanedText = text
      .replace(/[*_#`~>[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedText) {
      this.isSpeaking = false;
      this.onOrbStateCallback?.('idle');
      onEnd?.();
      return;
    }

    // Immediately flag as speaking so store and visualizer stay in speaking mode
    this.isSpeaking = true;
    this.onOrbStateCallback?.('speaking');

    // Try Google Cloud Neural2 TTS first
    this.speakNeural(cleanedText, onEnd)
      .then((success) => {
        if (!success) {
          // Gracefully fall back to patched browser speech if Neural TTS key is not set or network fails
          // But do NOT fall back if playback was aborted by user interruption
          if (!this.ttsAbortController?.signal.aborted) {
            this.speakBrowser(cleanedText, onEnd);
          } else {
            this.isSpeaking = false;
            this.onOrbStateCallback?.('idle');
          }
        }
      })
      .catch((err) => {
        // If aborted, do NOT start browser fallback!
        if (err?.name === 'AbortError' || this.ttsAbortController?.signal.aborted) {
          this.isSpeaking = false;
          this.onOrbStateCallback?.('idle');
          return;
        }
        console.warn('[JarvisVoice] Neural TTS threw error, using browser fallback:', err);
        this.speakBrowser(cleanedText, onEnd);
      });
  }

  setOrbStateCallback(
    cb: (state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'success') => void
  ) {
    this.onOrbStateCallback = cb;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  stopSpeaking(notify = true) {
    // 1. Abort any active Neural TTS fetch request
    if (this.ttsAbortController) {
      this.ttsAbortController.abort();
      this.ttsAbortController = null;
    }

    // 2. Stop and disconnect active audio buffer playback
    if (this.activeAudioSource) {
      try {
        this.activeAudioSource.stop();
        this.activeAudioSource.disconnect();
      } catch {
        // Node might already be stopped
      }
      this.activeAudioSource = null;
    }

    // 3. Stop browser fallback speech
    this.stopBrowserSpeech();

    // 4. Ensure analyser is detached from any outputs
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        // ignore
      }
    }

    this.isSpeaking = false;
    if (notify) {
      this.onOrbStateCallback?.('idle');
    }
  }

  cleanup() {
    void this.stopRecording();
    this.stopSpeaking();
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }
}

export const jarvisVoice = new JarvisVoiceService();
