// Jarvis Voice & Audio Engine
// STT: MediaRecorder → Groq Whisper (via Supabase edge function)
// TTS: Web Speech Synthesis API
// Visualizer: Web Audio API frequency analyser

export class JarvisVoiceService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isSpeaking = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private onOrbStateCallback:
    | ((state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'success') => void)
    | null = null;

  // ── MediaRecorder state ─────────────────────────────────────────────────
  private mediaRecorder: MediaRecorder | null = null;
  private recordingChunks: Blob[] = [];
  private recordingStream: MediaStream | null = null;
  isRecording = false;

  constructor() {
    this.initVoices();
  }

  // ── TTS Voice Selection ─────────────────────────────────────────────────
  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const scoreVoice = (v: SpeechSynthesisVoice): number => {
      let score = 0;
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();

      // Only English voices
      if (!lang.startsWith('en')) return -100;

      // Microsoft / Google Online Natural voices are state-of-the-art
      if (name.includes('natural') || name.includes('neural') || name.includes('online')) {
        score += 60;
      }

      // British English gives that iconic Jarvis tone
      if (lang.includes('en-gb') || lang.includes('en_gb')) {
        score += 30;
      }

      // Calm / polished male voices
      if (/ryan|george|daniel|oliver|guy|christopher|eric|arthur|brian|william/i.test(name)) {
        score += 25;
      }

      // Male voice indicator
      if (/male/i.test(name) && !/female/i.test(name)) {
        score += 15;
      }

      // Prefer Google high-quality voices if natural not found
      if (name.includes('google')) {
        score += 10;
      }

      // Avoid legacy robotic Windows desktop voices (e.g. David, Mark, Hazel)
      if (name.includes('desktop')) {
        score -= 25;
      }

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

  // ── Web Audio Analyser (for orb visualizer) ─────────────────────────────
  async initAudioAnalyzer(stream?: MediaStream): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.analyser) return true;

    try {
      const s = stream || (await navigator.mediaDevices.getUserMedia({ audio: true, video: false }));
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(s);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);
      return true;
    } catch (err) {
      console.warn('[JarvisVoice] Microphone analyser init failed:', err);
      return false;
    }
  }

  getLiveAudioLevel(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    return Math.min(1, sum / dataArray.length / 128);
  }

  // ── MediaRecorder: Start Recording ─────────────────────────────────────
  async startRecording(): Promise<boolean> {
    // Immediately interrupt and kill any active speech narration
    this.stopSpeaking();
    if (this.isRecording) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.recordingStream = stream;
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

      // Wire analyser to this stream so the orb reacts
      void this.initAudioAnalyzer(stream);

      return true;
    } catch (err) {
      console.error('[JarvisVoice] Failed to start recording:', err);
      return false;
    }
  }

  // ── MediaRecorder: Stop and return audio blob ───────────────────────────
  stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.isRecording = false;
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recordingChunks, { type: mimeType });
        this.recordingChunks = [];
        this.isRecording = false;

        // Release mic tracks
        this.recordingStream?.getTracks().forEach((t) => t.stop());
        this.recordingStream = null;
        this.mediaRecorder = null;

        // Reset analyser so it doesn't hold a dead stream
        this.analyser = null;

        resolve(blob);
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.isRecording = false;
        resolve(null);
      }
    });
  }

  // ── Whisper transcription via Supabase edge function ────────────────────
  async transcribeBlob(
    blob: Blob,
    supabaseUrl: string,
    accessToken: string,
    anonKey: string
  ): Promise<string> {
    const form = new FormData();
    form.append('audio', blob, 'recording.webm');

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

  // ── TTS: Speak with Jarvis persona ──────────────────────────────────────
  speak(text: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }

    window.speechSynthesis.cancel();

    const cleanedText = text
      .replace(/[*_#`~>[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedText) {
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    if (this.selectedVoice) utterance.voice = this.selectedVoice;
    utterance.rate = 1.0;
    utterance.pitch = 0.95;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.onOrbStateCallback?.('speaking');
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.onOrbStateCallback?.('idle');
      onEnd?.();
    };

    utterance.onerror = (e) => {
      console.warn('[JarvisVoice] TTS error:', e);
      this.isSpeaking = false;
      this.onOrbStateCallback?.('idle');
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  setOrbStateCallback(
    cb: (state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'success') => void
  ) {
    this.onOrbStateCallback = cb;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.onOrbStateCallback?.('idle');
  }

  cleanup() {
    void this.stopRecording();
    this.stopSpeaking();
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const jarvisVoice = new JarvisVoiceService();
