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

// Sentient speech sanitizer: converts raw written markdown into natural spoken speech
export function distillSpeechFromMarkdown(text: string): string {
  if (!text) return '';

  // 1. Remove code blocks and inline code
  let clean = text.replace(/```[\s\S]*?```/g, '');
  clean = clean.replace(/`([^`]+)`/g, '$1');

  // 2. Remove URLs, links, images
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  clean = clean.replace(/https?:\/\/\S+/g, '');
  clean = clean.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // 3. Detect structured weather bullet points
  const conditionMatch = clean.match(/-\s*\*\*Condition:\*\*\s*([^\n\r]+)/i);
  const tempMatch = clean.match(/-\s*\*\*Temperature:\*\*\s*([^\n\r]+)/i);
  const feelsLikeMatch = clean.match(/-\s*\*\*Feels Like:\*\*\s*([^\n\r]+)/i);
  const rainMatch = clean.match(/-\s*\*\*Precipitation:\*\*\s*([^\n\r]+)/i);

  if (conditionMatch || tempMatch) {
    const cond = conditionMatch ? conditionMatch[1].replace(/[—–-].*$/, '').trim() : '';
    const temp = tempMatch ? tempMatch[1].replace(/\([^)]*\)/g, '').trim() : '';
    const feels = feelsLikeMatch ? feelsLikeMatch[1].replace(/\([^)]*\)/g, '').trim() : '';
    const rain = rainMatch ? rainMatch[1].replace(/\([^)]*\)/g, '').trim() : '';

    let summary = `It's currently ${cond.toLowerCase() || 'clear'} and around ${temp || 'warm'} in Colombo, sir.`;
    if (feels) summary += ` With humidity it feels closer to ${feels}.`;
    if (rain && (rain.includes('0') || rain.toLowerCase().includes('no rain'))) {
      summary += ` No rain expected right now.`;
    }
    return summary;
  }

  // 4. Remove parentheticals with timestamps, dates, or approx signs
  clean = clean.replace(/\([^)]*?(?:observed|local time|\d{4}-\d{2}-\d{2}|≈|approx)[^)]*?\)/gi, '');

  // 5. Strip list bullets, asterisks, hashtags, quotes
  clean = clean.replace(/^[ \t]*[-*+]\s+/gm, '');
  clean = clean.replace(/[*_#~>]/g, '');
  clean = clean.replace(/\s+/g, ' ').trim();

  // 6. Extract first 1-2 complete sentences
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    let speech = sentences[0].trim();
    if (sentences[1] && (speech + ' ' + sentences[1].trim()).length <= 220) {
      speech += ' ' + sentences[1].trim();
    }
    return speech;
  }

  return clean.slice(0, 200).trim();
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
      // Automatically re-arm wake word detection once speech playback is done
      if (get().isHandsFree && !get().isRecording && !get().isTranscribing && !get().isSubmitting) {
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
    isWebSearchEnabled: false,
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
      jarvisVoice.stopSpeaking();
      set({ isSpeaking: false, orbState: 'idle', statusMessage: 'Narration paused' });
    },

    // ── Toggle push-to-talk recording ─────────────────────────────────────
    toggleRecording: async () => {
      if (get().isSubmitting || get().isTranscribing) return;

      if (get().isRecording) {
        // ── STOP → Transcribe ──────────────────────────────────────────
        set({ isRecording: false, isTranscribing: true, orbState: 'thinking', statusMessage: 'Transcribing...' });

        const blob = await jarvisVoice.stopRecording();

        if (!blob || blob.size < 1000) {
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

          if (!text) {
            set({ isTranscribing: false, orbState: 'idle', statusMessage: 'Could not hear anything — try again' });
            if (get().isHandsFree) void wakeWordService.resume();
            return;
          }

          set({
            transcript: text,
            isTranscribing: false,
            orbState: 'idle',
            statusMessage: 'Transcribed! Press Send to process.',
          });

          // If in prompt engineer mode or in cockpit, auto-submit when speech ends
          void get().submitCommand(text);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Transcription failed';
          console.error('[Jarvis] Transcription error:', err);
          toast.error(msg);
          set({ isTranscribing: false, orbState: 'idle', statusMessage: 'Transcription failed — try again' });
          if (get().isHandsFree) void wakeWordService.resume();
        }
      } else {
        // ── START recording ────────────────────────────────────────────
        // Immediately interrupt and kill any active speech narration!
        jarvisVoice.stopSpeaking();
        wakeWordService.pause();
        set({
          isSpeaking: false,
          transcript: '',
          statusMessage: get().isHandsFree ? 'Listening... say your command' : 'Listening...',
        });

        const ok = await jarvisVoice.startRecording();
        if (!ok) {
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
            : 'Listening... press mic again to stop',
        });

        // Hands-free silence monitor state
        let speechDetected = false;
        let silenceStart = 0;
        let ambientCalibrated = false;
        let ambientFloor = 0.01;
        const calibrationSamples: number[] = [];
        const SILENCE_TIMEOUT_MS = 1400; // 1.4s of quiet after speech finishes triggers auto-submit
        const INITIAL_WAIT_MS = 6000;    // 6s timeout if no speech at all after wake word
        const MAX_RECORDING_MS = 12000;  // 12s safety limit for hands-free utterance
        const startedAt = Date.now();

        // Poll audio level for orb visualizer and hands-free silence detection
        const pollAudio = () => {
          if (!get().isRecording) return;
          const level = jarvisVoice.getLiveAudioLevel();
          const rms = jarvisVoice.getLiveRMS();
          set({ audioLevel: level });

          // If hands-free is active, monitor voice activity & silence using Time-Domain RMS
          if (get().isHandsFree) {
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

            // 1. Check if user is speaking
            if (rms > speechThreshold) {
              if (!speechDetected) {
                console.log(`[Jarvis] Speech activity detected (RMS: ${rms.toFixed(4)} > ${speechThreshold.toFixed(4)})`);
                speechDetected = true;
              }
              silenceStart = 0; // reset silence counter while user speaks
            } else if (speechDetected) {
              // 2. User spoke and is now quiet
              if (silenceStart === 0) {
                silenceStart = now;
              } else if (now - silenceStart >= SILENCE_TIMEOUT_MS) {
                console.log(`[Jarvis] Hands-free silence detected (${SILENCE_TIMEOUT_MS}ms), auto-submitting utterance...`);
                void get().toggleRecording();
                return;
              }
            } else {
              // 3. User said "Hey Jarvis" but has not said a command yet
              if (now - startedAt >= INITIAL_WAIT_MS) {
                console.log('[Jarvis] Hands-free initial wait timeout (no command spoken)');
                void jarvisVoice.stopRecording();
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

            // 4. Safety maximum recording time cutoff (12 seconds)
            if (now - startedAt >= MAX_RECORDING_MS) {
              console.log('[Jarvis] Hands-free max recording time reached (12s), auto-submitting...');
              void get().toggleRecording();
              return;
            }
          }

          requestAnimationFrame(pollAudio);
        };
        requestAnimationFrame(pollAudio);
      }
    },

    // ── Submit Command to AI ───────────────────────────────────────────────
    submitCommand: async (manualText?: string) => {
      // Immediately stop any existing speech playback!
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
              jarvisVoice.speak(`${cleanSpeech}... I've prepared the details below for your review.`);
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
          set({ isSubmitting: false, orbState: 'success', statusMessage: execVoice });
          if (!get().isMuted) jarvisVoice.speak(execVoice);
        } else {
          if (!get().isMuted && lastMsg.content) {
            set({ isSubmitting: false, orbState: 'speaking', statusMessage: 'Answer ready' });
            const speechToSpeak = lastMsg.speechText || distillSpeechFromMarkdown(lastMsg.content);
            jarvisVoice.speak(speechToSpeak);
          } else {
            set({ isSubmitting: false, orbState: 'idle', statusMessage: 'Answer ready' });
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

