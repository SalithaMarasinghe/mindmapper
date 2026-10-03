import { create } from 'zustand';
import { jarvisVoice } from '../services/jarvisVoice';
import { wakeWordService, type WakeWordEngineType } from '../services/wakeWordService';
import { useAssistantStore } from './assistantStore';
import { supabase } from '../lib/supabase';
import type { AssistantProposal, SearchSource } from '../types';
import { toast } from 'react-hot-toast';

export type OrbVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success';
export type JarvisOperatingMode = 'cockpit' | 'prompt_engineer' | 'technical_qa';

// Resilient clipboard copy with textarea fallback
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('[Clipboard] writeText failed, using fallback:', err);
  }

  try {
    if (typeof document === 'undefined') return false;
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(el);
    return successful;
  } catch (err) {
    console.error('[Clipboard] Fallback execCommand copy failed:', err);
    return false;
  }
}

// Live semantic turn-taking state (Adaptive Semantic VAD)
let activeInterimRecognizer: any = null;
let latestInterimTranscript = '';
let isTrailingThoughtIncomplete = false;

const INCOMPLETE_CONNECTORS = new Set([
  'and', 'or', 'where', 'if', 'because', 'but', 'so', 'that', 'like', 'to',
  'about', 'which', 'then', 'when', 'with', 'as', 'for', 'who', 'whom',
  'whose', 'since', 'although', 'while', 'whether', 'how', 'what', 'why',
  'find', 'is', 'are', 'was', 'were', 'the', 'a', 'an', 'in', 'on', 'at',
  'into', 'from', 'by', 'after', 'before', 'between', 'during', 'through'
]);

function stopActiveInterimRecognizer() {
  if (activeInterimRecognizer) {
    try {
      activeInterimRecognizer.abort();
    } catch {
      // ignore
    }
    activeInterimRecognizer = null;
  }
}

// ── Live Barge-In / Speech Interruption Engine ──────────────────────────────
// Allows the user to interrupt Jarvis at any moment during spoken answers.
let bargeInRecognizer: any = null;
let bargeInGraceTimer: ReturnType<typeof setTimeout> | null = null;
let isBargeInActive = false;

function stopBargeInListener() {
  isBargeInActive = false;
  if (bargeInGraceTimer) {
    clearTimeout(bargeInGraceTimer);
    bargeInGraceTimer = null;
  }
  if (bargeInRecognizer) {
    try {
      bargeInRecognizer.abort();
    } catch {
      // ignore
    }
    bargeInRecognizer = null;
  }
}

function isLikelySpeakerEcho(detectedText: string, spokenText: string): boolean {
  if (!detectedText || !spokenText) return false;
  const detectedNorm = detectedText.toLowerCase().trim();
  const spokenNorm = spokenText.toLowerCase().trim();

  // If detected words are a direct substring of what Jarvis is vocalizing, it's speaker echo
  if (spokenNorm.includes(detectedNorm)) {
    return true;
  }

  // Token-level check: if sequential words match the vocalized text
  const detectedWords = detectedNorm.split(/\s+/).filter(Boolean);
  if (detectedWords.length >= 2 && spokenNorm.includes(detectedWords.join(' '))) {
    return true;
  }

  return false;
}

function startBargeInListener() {
  stopBargeInListener();

  const state = useJarvisStore.getState();
  // Enable natural voice barge-in when in Voice Mode OR Hands-Free mode
  if (!state.voiceModeOpen && !state.isHandsFree) return;
  if (state.micMuted) return;

  isBargeInActive = true;
  let canInterrupt = false;

  // 350ms grace window so initial audio playback onset does not trigger false interruption
  bargeInGraceTimer = setTimeout(() => {
    canInterrupt = true;
  }, 350);

  const SpeechRec =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  if (SpeechRec) {
    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (e: any) => {
        if (!isBargeInActive || !canInterrupt) return;
        const current = useJarvisStore.getState();
        if (!current.isSpeaking && current.orbState !== 'speaking') return;

        let detected = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          detected += (e.results[i][0]?.transcript || '') + ' ';
        }
        const trimmed = detected.trim();
        if (!trimmed) return;

        // Filter out speaker echo if the device speaker leaked into the mic
        if (isLikelySpeakerEcho(trimmed, current.lastSpokenText)) {
          console.debug('[JarvisStore] Ignoring detected speech (likely speaker echo):', trimmed);
          return;
        }

        console.log('[JarvisStore] 🛑 Natural user speech interrupted Jarvis (Barge-In):', trimmed);
        stopBargeInListener();
        jarvisVoice.stopSpeaking();

        // Seed with what the user just spoke so no initial words are lost
        latestInterimTranscript = trimmed;
        useJarvisStore.setState({
          isSpeaking: false,
          transcript: trimmed,
          orbState: 'listening',
          statusMessage: 'Listening to you...',
        });

        // Immediately begin full recording of the user's new question
        void current.toggleRecording();
      };

      rec.onerror = (err: any) => {
        if (err.error !== 'no-speech' && err.error !== 'aborted') {
          console.debug('[JarvisStore] Barge-in recognizer notice:', err.error);
        }
      };

      rec.onend = () => {
        // If TTS playback is still active and barge-in hasn't triggered, restart recognizer
        if (isBargeInActive && useJarvisStore.getState().isSpeaking) {
          try {
            rec.start();
          } catch {
            // ignore
          }
        }
      };

      rec.start();
      bargeInRecognizer = rec;
    } catch (err) {
      console.warn('[JarvisStore] Could not start SpeechRecognition for barge-in:', err);
    }
  }
}

// Sentient speech sanitizer: converts raw written markdown into natural spoken speech
export function distillSpeechFromMarkdown(text: string): string {
  if (!text) return '';

  // 1. Remove code blocks and inline code
  let clean = text.replace(/```[\s\S]*?```/g, '');
  clean = clean.replace(/`([^`]+)`/g, '$1');

  // 2. Remove markdown tables
  clean = clean.replace(/^\|[^\r\n]+\|$/gm, '');
  clean = clean.replace(/\|/g, ' ');

  // 3. Remove URLs, links, images
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  clean = clean.replace(/https?:\/\/\S+/g, '');
  clean = clean.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // 4. Detect structured weather bullet points
  const conditionMatch = clean.match(/(?:Condition|Current condition):\s*\*?\*?\s*([^\n\r]+)/i);
  const tempMatch = clean.match(/(?:Temperature):\s*\*?\*?\s*([^\n\r]+)/i);
  const feelsLikeMatch = clean.match(/(?:Feels like):\s*\*?\*?\s*([^\n\r]+)/i);
  const rainMatch = clean.match(/(?:Precipitation):\s*\*?\*?\s*([^\n\r]+)/i);

  if (conditionMatch || tempMatch) {
    const cond = conditionMatch ? conditionMatch[1].replace(/[*_~`—–-].*$/, '').trim() : '';
    const temp = tempMatch ? tempMatch[1].replace(/\([^)]*\)/g, '').replace(/[*_~`]/g, '').trim() : '';
    const feels = feelsLikeMatch ? feelsLikeMatch[1].replace(/\([^)]*\)/g, '').replace(/[*_~`]/g, '').trim() : '';
    const rain = rainMatch ? rainMatch[1].replace(/\([^)]*\)/g, '').replace(/[*_~`]/g, '').trim() : '';

    let summary = `It's currently ${cond.toLowerCase() || 'clear'} and around ${temp || 'warm'} in Colombo, sir.`;
    if (feels) summary += ` With humidity it feels closer to ${feels}.`;
    if (rain && (rain.includes('0') || rain.toLowerCase().includes('no rain') || rain.toLowerCase().includes('mist') || rain.toLowerCase().includes('drizzle'))) {
      if (rain.toLowerCase().includes('drizzle') || rain.toLowerCase().includes('mist')) {
        summary += ` Expect a light drizzle right now.`;
      } else {
        summary += ` No rain expected right now.`;
      }
    }
    return summary;
  }

  // 5. CRITICAL: Completely strip all markdown headings (# Heading, ## Subheading, etc.) so they are never read out loud!
  clean = clean.replace(/^#{1,6}\s+[^\r\n]*/gm, '');

  // 6. Strip blockquotes
  clean = clean.replace(/^>\s+[^\r\n]*/gm, '');

  // 7. Strip list bullets and numeric list markers (e.g. "1. ", "- ", "* ")
  clean = clean.replace(/^[ \t]*[-*+]\s+/gm, '');
  clean = clean.replace(/^[ \t]*\d+\.\s+/gm, '');

  // 8. Remove parentheticals with timestamps, dates, or approx signs
  clean = clean.replace(/\([^)]*?(?:observed|local time|\d{4}-\d{2}-\d{2}|≈|approx)[^)]*?\)/gi, '');

  // 9. Strip bold, italic, strikethrough, hashtags, angle brackets
  clean = clean.replace(/[*_#~>]/g, '');

  // 10. Normalize whitespace
  clean = clean.replace(/\s+/g, ' ').trim();

  // 11. Handle ultra-short greetings / check-ins (e.g., "Hey there, I am all set.")
  if (
    /^(hey|hi|hello|good morning|good afternoon|good evening|hey there)[^.!?]*$/i.test(clean) ||
    clean.toLowerCase() === 'hey there, i am all set.' ||
    clean.toLowerCase() === 'i am all set.' ||
    clean.toLowerCase() === 'all set.'
  ) {
    return 'Hey there, Salitha! All systems are online and ready. What would you like to work on today?';
  }

  // 12. Extract complete sentences for fluid, conversational audio playback (2-4 sentences, up to ~480 chars)
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    let speech = '';
    let count = 0;
    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      // Skip bullet-like fragments or table remnants that don't look like sentences
      if (trimmed.length < 15 && count > 0) continue;
      if (count >= 4) break;
      if (speech && (speech + ' ' + trimmed).length > 480) break;
      speech = speech ? speech + ' ' + trimmed : trimmed;
      count++;
    }

    if (speech) {
      // If the response is a deep technical or conceptual explanation (> 250 chars),
      // conclude with an invitation to view the screen unless already mentioned.
      const hasScreenPointer = /\b(on your screen|details below|breakdown below|take a look|for your review|proposal below|screen)\b/i.test(speech);
      if (text.length > 250 && !hasScreenPointer && speech.length <= 420) {
        speech += " I've placed the full breakdown on your screen, sir.";
      }
      return speech;
    }
  }

  return clean.slice(0, 350).trim();
}

interface JarvisState {
  isOpen: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  isSpeaking: boolean;
  orbState: OrbVisualState;
  audioLevel: number;
  transcript: string;
  pastedText: string;
  statusMessage: string;
  activeProposal: AssistantProposal | null;
  activeMessageId: string | null;
  isMuted: boolean;
  isSubmitting: boolean;

  // Prompt Studio state
  activePromptDocument: string | null;
  promptHistory: string[];
  mode: JarvisOperatingMode;
  lastCopiedAt: number | null;

  // Web Search state
  isWebSearchEnabled: boolean;
  lastSearchSources: SearchSource[];

  // Hands-Free wake-word state
  isHandsFree: boolean;
  isWakeWordLoading: boolean;
  wakeWordError: string | null;
  wakeWordEngine: WakeWordEngineType;
  setWakeWordEngine: (engine: WakeWordEngineType) => Promise<void>;
  toggleHandsFree: () => Promise<void>;

  // Voice Mode state
  voiceModeOpen: boolean;
  micMuted: boolean;
  lastSpokenText: string;
  openVoiceMode: () => void;
  closeVoiceMode: () => void;
  toggleVoiceMode: () => void;
  setMicMuted: (muted: boolean) => void;
  toggleMicMute: () => void;

  openHUD: (greet?: boolean) => void;
  closeHUD: () => void;
  setTranscript: (text: string) => void;
  setPastedText: (text: string) => void;
  setMode: (mode: JarvisOperatingMode) => void;
  setActivePromptDocument: (doc: string | null) => void;
  copyPromptToClipboard: (text?: string) => Promise<boolean>;
  clearPrompt: () => void;
  toggleMute: () => void;
  stopSpeaking: () => void;
  toggleRecording: () => Promise<void>;
  toggleWebSearch: () => void;
  setWebSearch: (enabled: boolean) => void;
  submitCommand: (manualText?: string) => Promise<void>;
  approveProposal: (updatedProposal?: AssistantProposal) => Promise<void>;
  rejectProposal: () => void;
}

export const useJarvisStore = create<JarvisState>((set, get) => {
  // Sync TTS orb state callback and pulse visualizer during speech
  jarvisVoice.setOrbStateCallback((orbState) => {
    set({ orbState, isSpeaking: orbState === 'speaking' });
    if (orbState === 'speaking') {
      startBargeInListener();
      const pollSpeakingAudio = () => {
        if (get().orbState !== 'speaking') {
          set({ audioLevel: 0 });
          return;
        }
        const level = jarvisVoice.getLiveAudioLevel();
        set({ audioLevel: level });
        requestAnimationFrame(pollSpeakingAudio);
      };
      requestAnimationFrame(pollSpeakingAudio);
    } else if (orbState === 'idle') {
      stopBargeInListener();
      // If Voice Mode is active and mic is not muted, seamlessly resume listening for continuous dialogue!
      if (get().voiceModeOpen && !get().micMuted && !get().isRecording && !get().isTranscribing && !get().isSubmitting) {
        setTimeout(() => {
          if (get().voiceModeOpen && !get().micMuted && !get().isRecording && !get().isTranscribing && !get().isSubmitting && !get().isSpeaking) {
            void get().toggleRecording();
          }
        }, 350);
      } else if (get().isHandsFree && !get().isRecording && !get().isTranscribing && !get().isSubmitting) {
        // Automatically re-arm wake word detection once speech playback is done
        void wakeWordService.resume();
        set({ statusMessage: "Hands-Free active · Say 'Hey Jarvis'" });
      }
    }
  });

  // Hook openWakeWord listener to start hands-free voice command capture
  wakeWordService.addListener({
    onDetected: (keyword, score) => {
      console.log(`[JarvisStore] 🎯 Wake word triggered (${keyword}, score: ${score.toFixed(3)})`);
      const state = get();
      if (state.isRecording || state.isTranscribing || state.isSubmitting) {
        console.log('[JarvisStore] Ignoring wake word because system is active.');
        return;
      }
      if (state.isSpeaking) {
        stopBargeInListener();
        jarvisVoice.stopSpeaking();
      }
      // Trigger recording immediately
      void get().toggleRecording();
    },
    onStateChange: ({ isLoading, error, engineType }) => {
      set({ isWakeWordLoading: isLoading, wakeWordError: error, wakeWordEngine: engineType });
    },
  });

  return {
    isOpen: false,
    isRecording: false,
    isTranscribing: false,
    isSpeaking: false,
    orbState: 'idle',
    audioLevel: 0,
    transcript: '',
    pastedText: '',
    statusMessage: 'Press the mic to start speaking',
    activeProposal: null,
    activeMessageId: null,
    isMuted: false,
    isSubmitting: false,

    // Voice Mode overlay state
    voiceModeOpen: false,
    micMuted: false,
    lastSpokenText: '',
    openVoiceMode: () => {
      set({ voiceModeOpen: true, transcript: '' });
      if (!get().isRecording && !get().isSpeaking && !get().isSubmitting) {
        void get().toggleRecording();
      }
    },
    closeVoiceMode: () => {
      stopBargeInListener();
      set({ voiceModeOpen: false });
      if (get().isRecording) {
        void get().toggleRecording();
      }
      if (get().isSpeaking) {
        get().stopSpeaking();
      }
    },
    toggleVoiceMode: () => {
      if (get().voiceModeOpen) {
        get().closeVoiceMode();
      } else {
        get().openVoiceMode();
      }
    },
    setMicMuted: (muted: boolean) => {
      set({ micMuted: muted });
      if (muted) {
        stopBargeInListener();
        if (get().isRecording) {
          void get().toggleRecording();
        }
      } else if (!muted && !get().isRecording && get().voiceModeOpen) {
        void get().toggleRecording();
      }
    },
    toggleMicMute: () => {
      get().setMicMuted(!get().micMuted);
    },

    // Hands-Free wake-word state
    isHandsFree: false,
    isWakeWordLoading: false,
    wakeWordError: null,
    wakeWordEngine: wakeWordService.getEngineType(),

    setWakeWordEngine: async (engine: WakeWordEngineType) => {
      await wakeWordService.setEngineType(engine);
      set({ wakeWordEngine: engine });
      toast.success(
        engine === 'browser'
          ? 'Switched to Browser Speech (Instant, detects any accent) ⚡'
          : 'Switched to Local Neural Model (100% Private, On-Device) 🔒'
      );
    },

    activePromptDocument: null,
    promptHistory: [],
    mode: 'cockpit',
    lastCopiedAt: null,
    isWebSearchEnabled: true,
    lastSearchSources: [],

    toggleHandsFree: async () => {
      const current = get().isHandsFree;
      if (current) {
        await wakeWordService.stopListening();
        set({
          isHandsFree: false,
          statusMessage: 'Hands-Free disabled · Press mic to speak',
        });
        toast('Hands-Free mode turned off');
      } else {
        set({ isWakeWordLoading: true, statusMessage: 'Loading wake-word engine...' });
        const ok = await wakeWordService.startListening();
        set({ isWakeWordLoading: false });
        if (ok) {
          set({
            isHandsFree: true,
            statusMessage: "Hands-Free active · Say 'Hey Jarvis'",
          });
          toast.success("Hands-Free active! Say 'Hey Jarvis' anytime 🎧");
        } else {
          set({
            isHandsFree: false,
            statusMessage: 'Could not access microphone for hands-free',
          });
          toast.error('Could not activate hands-free mode. Check mic permission.');
        }
      }
    },

    toggleWebSearch: () => set((s) => ({ isWebSearchEnabled: !s.isWebSearchEnabled })),
    setWebSearch: (enabled: boolean) => set({ isWebSearchEnabled: enabled }),

    // ── Open HUD ──────────────────────────────────────────────────────────
    openHUD: (greet = true) => {
      set({
        isOpen: true,
        orbState: 'idle',
        statusMessage: 'Press the mic or start speaking, sir',
        transcript: '',
        pastedText: '',
        activeProposal: null,
        isRecording: false,
        isTranscribing: false,
      });

      if (greet && !get().isMuted) {
        jarvisVoice.speak('Hello sir, how can I help you today?');
      }
    },

    // ── Close HUD ─────────────────────────────────────────────────────────
    closeHUD: () => {
      jarvisVoice.stopSpeaking();
      if (get().isRecording) {
        void jarvisVoice.stopRecording();
      }
      set({
        isOpen: false,
        isSpeaking: false,
        orbState: 'idle',
        statusMessage: 'Press the mic to start speaking',
        transcript: '',
        pastedText: '',
        activeProposal: null,
        activeMessageId: null,
        isSubmitting: false,
        isRecording: false,
        isTranscribing: false,
      });
    },

    setTranscript: (transcript: string) => set({ transcript }),
    setPastedText: (pastedText: string) => set({ pastedText }),
    setMode: (mode: JarvisOperatingMode) => set({ mode }),
    setActivePromptDocument: (activePromptDocument: string | null) => set({ activePromptDocument }),
    clearPrompt: () => set({ activePromptDocument: null }),

    copyPromptToClipboard: async (text?: string) => {
      const target = text || get().activePromptDocument;
      if (!target) return false;
      const ok = await copyToClipboard(target);
      if (ok) {
        set({ lastCopiedAt: Date.now() });
        toast.success('Prompt copied to clipboard! 📋');
      } else {
        toast.error('Could not access clipboard.');
      }
      return ok;
    },

    toggleMute: () => {
      const isMuted = !get().isMuted;
      set({ isMuted });
      if (isMuted) jarvisVoice.stopSpeaking();
    },

    stopSpeaking: () => {
      stopBargeInListener();
      jarvisVoice.stopSpeaking();
      set({ isSpeaking: false, orbState: 'idle', statusMessage: 'Narration paused' });
    },

    // ── Toggle push-to-talk recording ─────────────────────────────────────
    toggleRecording: async () => {
      if (get().isSubmitting || get().isTranscribing) return;

      if (get().isRecording) {
        // ── STOP → Transcribe ──────────────────────────────────────────
        stopActiveInterimRecognizer();
        set({ isRecording: false, isTranscribing: true, orbState: 'thinking', statusMessage: 'Transcribing...' });

        const blob = await jarvisVoice.stopRecording();

        if (!blob || blob.size < 1000) {
          const fallback = latestInterimTranscript.trim();
          latestInterimTranscript = '';
          isTrailingThoughtIncomplete = false;
          if (fallback) {
            set({ transcript: fallback, isTranscribing: false, orbState: 'idle' });
            void get().submitCommand(fallback);
            return;
          }
          set({ isTranscribing: false, orbState: 'idle', statusMessage: 'Recording too short — try again' });
          if (get().isHandsFree) void wakeWordService.resume();
          return;
        }

        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error('Session expired.');

          const text = await jarvisVoice.transcribeBlob(
            blob,
            import.meta.env.VITE_SUPABASE_URL as string,
            session.access_token,
            import.meta.env.VITE_SUPABASE_ANON_KEY as string
          );

          // Resilient fallback to real-time interim transcript if Whisper returned blank
          const finalTranscript = (text || latestInterimTranscript).trim();
          latestInterimTranscript = '';
          isTrailingThoughtIncomplete = false;

          if (!finalTranscript) {
            set({ isTranscribing: false, orbState: 'idle', statusMessage: 'Could not hear anything — try again' });
            if (get().isHandsFree) void wakeWordService.resume();
            return;
          }

          set({
            transcript: finalTranscript,
            isTranscribing: false,
            orbState: 'idle',
            statusMessage: 'Transcribed! Processing...',
          });

          // Auto-submit when speech ends
          void get().submitCommand(finalTranscript);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Transcription failed';
          console.error('[Jarvis] Transcription error:', err);

          // Resilient fallback to live interim speech if Whisper endpoint failed
          const fallback = latestInterimTranscript.trim();
          latestInterimTranscript = '';
          isTrailingThoughtIncomplete = false;
          if (fallback) {
            set({ transcript: fallback, isTranscribing: false, orbState: 'idle' });
            void get().submitCommand(fallback);
            return;
          }

          toast.error(msg);
          set({ isTranscribing: false, orbState: 'idle', statusMessage: 'Transcription failed — try again' });
          if (get().isHandsFree) void wakeWordService.resume();
        }
      } else {
        // ── START recording ────────────────────────────────────────────
        // Immediately interrupt and kill any active speech narration & barge-in listener!
        stopBargeInListener();
        jarvisVoice.stopSpeaking();
        wakeWordService.pause();
        stopActiveInterimRecognizer();

        const initialSeed = latestInterimTranscript.trim();
        isTrailingThoughtIncomplete = false;

        set({
          isSpeaking: false,
          transcript: initialSeed,
          statusMessage: get().isHandsFree
            ? 'Listening... say your command'
            : 'Listening... press mic or pause when done',
        });

        // Start browser interim speech recognizer if supported for live words & semantic VAD
        const SpeechRec =
          typeof window !== 'undefined'
            ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
            : null;

        if (SpeechRec) {
          try {
            const rec = new SpeechRec();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = 'en-US';

            rec.onresult = (e: any) => {
              let accumulated = '';
              for (let i = 0; i < e.results.length; i++) {
                accumulated += (e.results[i][0]?.transcript || '') + ' ';
              }
              const trimmed = accumulated.trim();
              if (trimmed) {
                const fullText =
                  initialSeed && !trimmed.toLowerCase().includes(initialSeed.toLowerCase())
                    ? `${initialSeed} ${trimmed}`
                    : trimmed;
                latestInterimTranscript = fullText;
                set({ transcript: fullText });

                // Semantic turn-completion check:
                const tokens = fullText.toLowerCase().replace(/[.,!?;:]/g, ' ').trim().split(/\s+/);
                const lastWord = tokens[tokens.length - 1];
                isTrailingThoughtIncomplete = Boolean(lastWord && INCOMPLETE_CONNECTORS.has(lastWord));
              }
            };

            rec.onerror = (err: any) => {
              console.debug('[Jarvis] Interim recognition notice:', err?.error);
            };

            rec.start();
            activeInterimRecognizer = rec;
          } catch (recErr) {
            console.warn('[Jarvis] Could not start interim SpeechRecognition:', recErr);
          }
        }

        const ok = await jarvisVoice.startRecording();
        if (!ok) {
          stopActiveInterimRecognizer();
          toast.error('Microphone access denied. Please allow mic permissions.');
          set({ statusMessage: 'Microphone access denied' });
          if (get().isHandsFree) void wakeWordService.resume();
          return;
        }

        set({
          isRecording: true,
          orbState: 'listening',
          statusMessage: get().isHandsFree
            ? 'Listening... pause when done speaking'
            : 'Listening... press mic or pause when done',
        });

        // Adaptive silence monitor state
        let speechDetected = false;
        let silenceStart = 0;
        let ambientCalibrated = false;
        let ambientFloor = 0.01;
        const calibrationSamples: number[] = [];
        const BASE_SILENCE_TIMEOUT_MS = 2800; // 2.8s baseline pause buffer (comfortably room for breathing/thinking)
        const EXTENDED_SILENCE_TIMEOUT_MS = 4800; // ~5s if paused on incomplete connector ("where", "and", etc.)
        const INITIAL_WAIT_MS = 8000;    // 8s timeout if no speech at all after wake word
        const MAX_RECORDING_MS = 60000;  // 60s (1 full minute) safety limit for complex prompts
        const startedAt = Date.now();

        // Poll audio level for orb visualizer and adaptive silence detection
        const pollAudio = () => {
          if (!get().isRecording) return;
          const level = jarvisVoice.getLiveAudioLevel();
          const rms = jarvisVoice.getLiveRMS();
          set({ audioLevel: level });

          const now = Date.now();

          // Calibrate ambient noise floor during first 250ms
          if (!ambientCalibrated) {
            calibrationSamples.push(rms);
            if (now - startedAt > 200 && calibrationSamples.length >= 3) {
              const avg = calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length;
              ambientFloor = Math.max(0.006, avg);
              ambientCalibrated = true;
              console.log('[Jarvis] Ambient noise floor calibrated:', ambientFloor.toFixed(4));
            }
          }

          const speechThreshold = Math.max(0.018, ambientFloor * 2.0);
          const silenceTargetMs = isTrailingThoughtIncomplete ? EXTENDED_SILENCE_TIMEOUT_MS : BASE_SILENCE_TIMEOUT_MS;

          // 1. Check if user is speaking
          if (rms > speechThreshold) {
            if (!speechDetected) {
              console.log(`[Jarvis] Speech activity detected (RMS: ${rms.toFixed(4)} > ${speechThreshold.toFixed(4)})`);
              speechDetected = true;
            }
            silenceStart = 0; // reset silence counter while user speaks
            set({
              statusMessage: get().isHandsFree
                ? 'Listening... pause when done speaking'
                : 'Listening... press mic or pause when done',
            });
          } else if (speechDetected) {
            // 2. User spoke and is now quiet / thinking
            if (silenceStart === 0) {
              silenceStart = now;
            } else {
              const elapsedSilence = now - silenceStart;

              // Conversational holding status: inform user we are holding floor
              if (elapsedSilence > 1200) {
                if (isTrailingThoughtIncomplete) {
                  set({ statusMessage: 'Holding floor... take your time, sir' });
                } else if (get().isHandsFree) {
                  set({ statusMessage: 'Finishing up...' });
                }
              }

              // Auto-submit after silenceTargetMs in hands-free mode (or silenceTargetMs + 1000ms in manual mode)
              const triggerTimeout = get().isHandsFree ? silenceTargetMs : (silenceTargetMs + 1000);
              if (elapsedSilence >= triggerTimeout) {
                console.log(`[Jarvis] Silence detected (${triggerTimeout}ms, incomplete=${isTrailingThoughtIncomplete}), auto-submitting utterance...`);
                void get().toggleRecording();
                return;
              }
            }
          } else if (get().isHandsFree) {
            // 3. User said "Hey Jarvis" but has not said a command yet
            if (now - startedAt >= INITIAL_WAIT_MS) {
              console.log('[Jarvis] Hands-free initial wait timeout (no command spoken)');
              void jarvisVoice.stopRecording();
              stopActiveInterimRecognizer();
              set({
                isRecording: false,
                orbState: 'idle',
                statusMessage: "Didn't hear a command. Say 'Hey Jarvis' when ready.",
              });
              if (get().isHandsFree) {
                void wakeWordService.resume();
              }
              return;
            }
          }

          // 4. Safety maximum recording time cutoff (60 seconds)
          if (now - startedAt >= MAX_RECORDING_MS) {
            console.log('[Jarvis] Max recording time reached (60s), auto-submitting...');
            void get().toggleRecording();
            return;
          }

          requestAnimationFrame(pollAudio);
        };
        requestAnimationFrame(pollAudio);
      }
    },

    // ── Submit Command to AI ───────────────────────────────────────────────
    submitCommand: async (manualText?: string) => {
      // Immediately stop any existing speech playback or active interim recognizer!
      stopActiveInterimRecognizer();
      jarvisVoice.stopSpeaking();
      set({ isSpeaking: false });

      const text = (manualText !== undefined ? manualText : get().transcript).trim();
      const pasted = get().pastedText.trim();

      if (!text && !pasted) {
        toast('Record a voice command or enter instructions.');
        return;
      }

      set({
        isSubmitting: true,
        orbState: 'thinking',
        statusMessage: 'Analyzing & crafting, sir...',
      });

      let fullMessage = text;
      if (pasted) {
        fullMessage = fullMessage
          ? `${fullMessage}\n\n--- Pasted Content / Logs ---\n${pasted}`
          : `Please process the following data:\n\n${pasted}`;
      }

      const isPromptIntent =
        get().mode === 'prompt_engineer' ||
        /\b(prompt|prompts|context engineer|context engineering|system prompt|agent prompt)\b/i.test(
          fullMessage
        );

      const isTechQaIntent =
        get().mode === 'technical_qa' ||
        /^(explain|how does|what is|difference between|compare|architecture of)\b/i.test(fullMessage.trim());

      const options = {
        mode: isPromptIntent ? ('prompt_engineer' as const) : isTechQaIntent ? ('technical_qa' as const) : undefined,
        promptRefinementTarget: isPromptIntent ? (get().activePromptDocument || undefined) : undefined,
        enableSearch: get().isWebSearchEnabled,
      };

      try {
        const assistantStore = useAssistantStore.getState();
        await assistantStore.sendMessage(fullMessage, options);

        const latestMessages = useAssistantStore.getState().messages;
        const lastMsg = latestMessages[latestMessages.length - 1];

        if (!lastMsg || lastMsg.role !== 'assistant') {
          throw new Error('No response received from assistant');
        }

        if (lastMsg.searchSources && lastMsg.searchSources.length > 0) {
          set({ lastSearchSources: lastMsg.searchSources });
        }

        // 1. Check if an engineered prompt was returned
        if (lastMsg.engineeredPrompt) {
          const promptDoc = lastMsg.engineeredPrompt;
          set((s) => ({
            isSubmitting: false,
            orbState: 'success',
            statusMessage: 'Prompt context-engineered and copied!',
            activePromptDocument: promptDoc,
            promptHistory: [promptDoc, ...s.promptHistory],
            lastCopiedAt: Date.now(),
          }));

          // Automatically copy to clipboard!
          void get().copyPromptToClipboard(promptDoc);

          if (!get().isMuted) {
            jarvisVoice.speak('Prompt context-engineered and copied to your clipboard, sir.');
          }
          return;
        }

        const proposals = lastMsg.proposals || [];
        const hasPending = proposals.some((p) => p.status === 'pending');
        const autoExecuted = proposals.filter((p) => p.status === 'auto_executed');

        if (hasPending) {
          const targetProp = proposals.find((p) => p.status === 'pending') || null;
          set({
            isSubmitting: false,
            activeProposal: targetProp,
            activeMessageId: lastMsg.id,
            orbState: 'idle',
            statusMessage: 'Ready for your review',
            transcript: '',
          });
          if (!get().isMuted) {
            const rawContent = (lastMsg.content || '').trim();
            const payload = (targetProp?.payload || {}) as Record<string, unknown>;

            const finishedProp = autoExecuted.find((p) => p.type === 'finish_task');
            if (finishedProp) {
              const fPayload = (finishedProp.payload || {}) as Record<string, unknown>;
              const fTitle = typeof fPayload.taskTitle === 'string' ? fPayload.taskTitle : 'Task';
              jarvisVoice.speak(
                `I've marked "${fTitle}" as completed and moved it to Done. I've also drafted the work journal entry below for your review.`
              );
            } else if (
              rawContent &&
              !rawContent.toLowerCase().startsWith('i have drafted') &&
              !rawContent.toLowerCase().startsWith("i've drafted") &&
              rawContent.length > 30
            ) {
              const cleanSpeech = lastMsg.speechText || distillSpeechFromMarkdown(rawContent);
              const alreadyMentionsReview = /\b(for your review|details below|on your screen|proposal below|screen)\b/i.test(cleanSpeech);
              jarvisVoice.speak(
                alreadyMentionsReview ? cleanSpeech : `${cleanSpeech} I've prepared the details below for your review.`
              );
            } else {
              let voiceMsg = "I've drafted the details for your review.";
              if (targetProp?.type === 'create_work_event') {
                const title = typeof payload.title === 'string' ? payload.title : '';
                voiceMsg = title
                  ? `I've drafted the work journal entry for "${title}". Take a quick look.`
                  : "I've drafted the work journal entry for your review.";
              } else if (targetProp?.type === 'create_tasks') {
                const tasks = (payload.tasks as Array<{ title?: string }>) || [];
                voiceMsg =
                  tasks.length > 1
                    ? `I've prepared ${tasks.length} new tasks for your To Do board. Please take a look.`
                    : "I've prepared the task for your To Do board. Please take a look.";
              } else if (targetProp?.type === 'create_meeting_event') {
                const title = typeof payload.title === 'string' ? payload.title : 'meeting';
                voiceMsg = `I've drafted the summary and action items for the ${title}. Ready when you are.`;
              } else if (targetProp?.type === 'update_project') {
                const name = typeof payload.projectName === 'string' ? payload.projectName : 'project';
                voiceMsg = `I've prepared the status update for ${name}. Please review.`;
              }
              jarvisVoice.speak(voiceMsg);
            }
          }
        } else if (autoExecuted.length > 0) {
          const firstExec = autoExecuted[0];
          const payload = (firstExec.payload || {}) as Record<string, unknown>;
          let execVoice = 'Action completed successfully.';
          if (firstExec.type === 'start_task') {
            const title = typeof payload.taskTitle === 'string' ? payload.taskTitle : 'Task';
            execVoice = `Started "${title}". Timer is running.`;
          } else if (firstExec.type === 'pause_task' || firstExec.type === 'pause_all') {
            execVoice = 'Task paused. Enjoy your break.';
          } else if (firstExec.type === 'resume_task' || firstExec.type === 'resume_last_paused') {
            const title = typeof payload.taskTitle === 'string' ? payload.taskTitle : 'Task';
            execVoice = `Resumed "${title}". Timer running.`;
          } else if (firstExec.type === 'finish_task') {
            const title = typeof payload.taskTitle === 'string' ? payload.taskTitle : 'Task';
            execVoice = `Marked "${title}" as completed.`;
          }
          set({
            isSubmitting: false,
            orbState: 'success',
            statusMessage: execVoice,
            lastSpokenText: execVoice,
            transcript: '',
          });
          if (!get().isMuted) jarvisVoice.speak(execVoice);
        } else {
          if (!get().isMuted && lastMsg.content) {
            const speechToSpeak = lastMsg.speechText || distillSpeechFromMarkdown(lastMsg.content);
            set({
              isSubmitting: false,
              orbState: 'speaking',
              statusMessage: 'Answer ready',
              lastSpokenText: speechToSpeak,
              transcript: '',
            });
            jarvisVoice.speak(speechToSpeak);
          } else {
            set({
              isSubmitting: false,
              orbState: 'idle',
              statusMessage: 'Answer ready',
              transcript: '',
            });
            if (get().isHandsFree) void wakeWordService.resume();
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Execution failed';
        console.error('[Jarvis] Submit error:', err);
        toast.error(msg);
        set({ isSubmitting: false, orbState: 'idle', statusMessage: 'An error occurred, sir.' });
        if (!get().isMuted) {
          jarvisVoice.speak('I encountered an issue processing that request, sir.');
        } else if (get().isHandsFree) {
          void wakeWordService.resume();
        }
      }
    },

    // ── Approve Proposal ──────────────────────────────────────────────────
    approveProposal: async (updatedProposal?: AssistantProposal) => {
      const { activeProposal, activeMessageId } = get();
      const proposalToExecute = updatedProposal || activeProposal;
      if (!proposalToExecute || !activeMessageId) return;

      set({ isSubmitting: true, orbState: 'thinking', statusMessage: 'Writing changes...' });

      try {
        const assistantStore = useAssistantStore.getState();
        await assistantStore.executeProposal(activeMessageId, proposalToExecute);

        // Natural, sentient voice response & feedback
        let voiceText = 'All done. The changes have been saved.';
        let toastText = 'Action successfully logged! 🚀';
        const payload = (proposalToExecute.payload || {}) as Record<string, unknown>;

        switch (proposalToExecute.type) {
          case 'create_work_event': {
            const title = typeof payload.title === 'string' ? payload.title : '';
            voiceText = title
              ? `I've logged your work on ${title} into the Work Journal.`
              : 'Your work journal entry has been logged.';
            toastText = title
              ? `Logged "${title}" in Work Journal!`
              : 'Logged entry in Work Journal!';
            break;
          }
          case 'create_tasks': {
            const tasks = (payload.tasks as Array<{ title?: string }>) || [];
            if (tasks.length === 1 && tasks[0].title) {
              voiceText = `I have added "${tasks[0].title}" to your To Do list.`;
              toastText = `Created "${tasks[0].title}" in To Do!`;
            } else if (tasks.length > 1) {
              voiceText = `I have added ${tasks.length} new tasks to your To Do board.`;
              toastText = `Created ${tasks.length} tasks in To Do!`;
            } else {
              voiceText = 'The tasks have been added to your Kanban To Do list.';
              toastText = 'Tasks added to To Do!';
            }
            break;
          }
          case 'create_meeting_event': {
            const title = typeof payload.title === 'string' ? payload.title : 'meeting';
            const hasTasks = Array.isArray(payload.actionItems) && payload.actionItems.length > 0;
            voiceText = hasTasks
              ? `I've logged the ${title} meeting and added your action items to Kanban.`
              : `Logged the ${title} meeting into your journal.`;
            toastText = `Logged meeting "${title}"!`;
            break;
          }
          case 'update_project': {
            const name = typeof payload.projectName === 'string' ? payload.projectName : 'project';
            const status = typeof payload.status === 'string' ? payload.status : 'completed';
            voiceText = `I've updated ${name} and marked it as ${status}.`;
            toastText = `Project "${name}" marked as ${status}! 🏆`;
            break;
          }
          case 'create_project': {
            const name = typeof payload.name === 'string' ? payload.name : 'project';
            voiceText = `Project ${name} has been added to your initiatives.`;
            toastText = `Created project "${name}"! 🚀`;
            break;
          }
          case 'finish_task': {
            const title = typeof payload.taskTitle === 'string' ? payload.taskTitle : 'Task';
            voiceText = `Marked ${title} as completed and moved it to Done.`;
            toastText = `Completed "${title}"!`;
            break;
          }
          case 'start_task': {
            const title = typeof payload.taskTitle === 'string' ? payload.taskTitle : 'Task';
            voiceText = `Started working on ${title}. Timer is running.`;
            toastText = `Started "${title}"!`;
            break;
          }
          case 'pause_task':
          case 'pause_all': {
            voiceText = 'Tasks paused. Enjoy your break.';
            toastText = 'Tasks paused for a break. ☕';
            break;
          }
          default:
            voiceText = proposalToExecute.summary
              ? `${proposalToExecute.summary} completed.`
              : 'Action successfully completed.';
            toastText = proposalToExecute.summary || 'Action completed!';
        }

        set({
          isSubmitting: false,
          orbState: 'success',
          statusMessage: voiceText,
          activeProposal: null,
          activeMessageId: null,
        });

        if (!get().isMuted) {
          jarvisVoice.speak(voiceText);
        }

        toast.success(toastText);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Approval failed';
        console.error('[Jarvis] Approval error:', err);
        toast.error(msg);
        set({ isSubmitting: false, orbState: 'idle', statusMessage: 'Failed to write changes.' });
      }
    },

    // ── Reject Proposal ───────────────────────────────────────────────────
    rejectProposal: () => {
      const { activeProposal, activeMessageId } = get();
      if (activeProposal && activeMessageId) {
        void useAssistantStore.getState().rejectProposal(activeMessageId, activeProposal.id);
      }
      set({ activeProposal: null, activeMessageId: null, orbState: 'idle', statusMessage: 'Action cancelled.' });
      if (!get().isMuted) jarvisVoice.speak('Action cancelled, sir.');
      setTimeout(() => {
        if (get().isOpen) get().closeHUD();
      }, 1000);
    },
  };
});

