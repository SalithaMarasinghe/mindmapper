/**
 * Zero-overhead latency telemetry for the Jarvis voice & chat pipeline.
 * Flag-guarded behind VITE_FF_LATENCY_DEBUG (default: OFF).
 *
 * Can be enabled via:
 * 1. .env: VITE_FF_LATENCY_DEBUG=true
 * 2. DevTools Console: localStorage.setItem('VITE_FF_LATENCY_DEBUG', 'true')
 */

export type LatencyMarkName =
  | 'speech-end'
  | 'stt-done'
  | 'chat-request-sent'
  | 'chat-response-received'
  | 'tts-response-received'
  | 'first-audio-frame';

export interface MarkOptions {
  startTime?: number;
  serverTiming?: string | null;
}

class JarvisTelemetryService {
  private serverTimings: Record<string, string> = {};
  private hasLoggedThisTurn = false;
  private currentTurnId = 0;

  isEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return (
        import.meta.env.VITE_FF_LATENCY_DEBUG === 'true' ||
        window.localStorage?.getItem('VITE_FF_LATENCY_DEBUG') === 'true'
      );
    } catch {
      return false;
    }
  }

  startTurn(): void {
    if (!this.isEnabled()) return;
    this.currentTurnId++;
    this.hasLoggedThisTurn = false;
    this.clearMarks();
  }

  mark(name: LatencyMarkName, options?: MarkOptions): void {
    if (!this.isEnabled()) return;
    try {
      const markName = `jarvis-${name}`;
      // 1. Skip if the mark already exists in the current turn
      if (this.hasMark(name)) return;

      if (options?.startTime !== undefined && typeof performance.mark === 'function') {
        try {
          performance.mark(markName, { startTime: options.startTime });
        } catch {
          // Fallback if browser doesn't support custom startTime parameter
          performance.mark(markName);
        }
      } else {
        performance.mark(markName);
      }

      if (options?.serverTiming) {
        this.serverTimings[name] = options.serverTiming;
      }
    } catch {
      // ignore
    }
  }

  setServerTiming(name: LatencyMarkName, timing: string | null | undefined): void {
    if (!this.isEnabled() || !timing) return;
    this.serverTimings[name] = timing;
  }

  hasMark(name: LatencyMarkName): boolean {
    if (!this.isEnabled()) return false;
    try {
      return performance.getEntriesByName(`jarvis-${name}`).length > 0;
    } catch {
      return false;
    }
  }

  private getDuration(startMark: LatencyMarkName, endMark: LatencyMarkName): number | null {
    try {
      const startEntries = performance.getEntriesByName(`jarvis-${startMark}`);
      const endEntries = performance.getEntriesByName(`jarvis-${endMark}`);
      if (startEntries.length === 0 || endEntries.length === 0) return null;
      const start = startEntries[startEntries.length - 1].startTime;
      const end = endEntries[endEntries.length - 1].startTime;
      return Number((end - start).toFixed(1));
    } catch {
      return null;
    }
  }

  logTurnSummary(): void {
    if (!this.isEnabled() || this.hasLoggedThisTurn) return;
    this.hasLoggedThisTurn = true;

    try {
      const isVoice = this.hasMark('speech-end');
      if (isVoice) {
        const totalTtfa = this.getDuration('speech-end', 'first-audio-frame');
        const sttDur = this.getDuration('speech-end', 'stt-done');
        const clientPrepDur = this.getDuration('stt-done', 'chat-request-sent');
        const chatRtt = this.getDuration('chat-request-sent', 'chat-response-received');
        const ttsRtt = this.getDuration('chat-response-received', 'tts-response-received');
        const audioPrepDur = this.getDuration('tts-response-received', 'first-audio-frame');

        const sttServerTiming = this.serverTimings['stt-done'] || 'none';
        const chatServerTiming = this.serverTimings['chat-response-received'] || 'none';
        const ttsServerTiming = this.serverTimings['tts-response-received'] || 'none';

        console.log(
          `%c[Jarvis Latency]%c Turn #${this.currentTurnId} TTFA: ${totalTtfa ?? 'n/a'}ms | SpeechEnd->STT: ${sttDur ?? 'n/a'}ms [Server: ${sttServerTiming}] | ClientPrep: ${clientPrepDur ?? 'n/a'}ms | ChatRTT: ${chatRtt ?? 'n/a'}ms [Server: ${chatServerTiming}] | TTSRTT: ${ttsRtt ?? 'n/a'}ms [Server: ${ttsServerTiming}] | AudioDecode: ${audioPrepDur ?? 'n/a'}ms`,
          'color: #00d2ff; font-weight: bold;',
          'color: inherit;'
        );
      } else {
        const chatRtt = this.getDuration('chat-request-sent', 'chat-response-received');
        const chatServerTiming = this.serverTimings['chat-response-received'] || 'none';
        console.log(
          `%c[Jarvis Latency]%c Turn #${this.currentTurnId} Text ChatRTT: ${chatRtt ?? 'n/a'}ms [Server: ${chatServerTiming}]`,
          'color: #00d2ff; font-weight: bold;',
          'color: inherit;'
        );
      }
    } catch (err) {
      console.warn('[JarvisTelemetry] Failed to log turn summary:', err);
    }
  }

  clearMarks(): void {
    if (!this.isEnabled()) return;
    try {
      const markNames: LatencyMarkName[] = [
        'speech-end',
        'stt-done',
        'chat-request-sent',
        'chat-response-received',
        'tts-response-received',
        'first-audio-frame',
      ];
      markNames.forEach((m) => performance.clearMarks(`jarvis-${m}`));
      this.serverTimings = {};
    } catch {
      // ignore
    }
  }
}

export const jarvisTelemetry = new JarvisTelemetryService();
