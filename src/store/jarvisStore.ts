import { create } from 'zustand';
import { jarvisVoice } from '../services/jarvisVoice';
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
  // Sync TTS orb state callback
  jarvisVoice.setOrbStateCallback((orbState) => {
    set({ orbState, isSpeaking: orbState === 'speaking' });
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

    activePromptDocument: null,
    promptHistory: [],
    mode: 'cockpit',
    lastCopiedAt: null,
    isWebSearchEnabled: false,
    lastSearchSources: [],

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
        }
      } else {
        // ── START recording ────────────────────────────────────────────
        // Immediately interrupt and kill any active speech narration!
        jarvisVoice.stopSpeaking();
        set({ isSpeaking: false, transcript: '', statusMessage: 'Listening...' });

        const ok = await jarvisVoice.startRecording();
        if (!ok) {
          toast.error('Microphone access denied. Please allow mic permissions.');
          set({ statusMessage: 'Microphone access denied' });
          return;
        }

        set({ isRecording: true, orbState: 'listening', statusMessage: 'Listening... press mic again to stop' });

        // Poll audio level for orb visualizer while recording
        const pollAudio = () => {
          if (!get().isRecording) return;
          const level = jarvisVoice.getLiveAudioLevel();
          set({ audioLevel: level });
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

            if (
              rawContent &&
              !rawContent.toLowerCase().startsWith('i have drafted') &&
              !rawContent.toLowerCase().startsWith("i've drafted") &&
              rawContent.length > 30
            ) {
              const cleanText = rawContent.replace(/[#*`_~]/g, '').slice(0, 260).trim();
              jarvisVoice.speak(`${cleanText}... I've prepared the details below for your review.`);
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
          set({ isSubmitting: false, orbState: 'speaking', statusMessage: 'Answer ready' });
          if (!get().isMuted && lastMsg.content) {
            jarvisVoice.speak(lastMsg.content.slice(0, 300));
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Execution failed';
        console.error('[Jarvis] Submit error:', err);
        toast.error(msg);
        set({ isSubmitting: false, orbState: 'idle', statusMessage: 'An error occurred, sir.' });
        if (!get().isMuted) jarvisVoice.speak('I encountered an issue processing that request, sir.');
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

