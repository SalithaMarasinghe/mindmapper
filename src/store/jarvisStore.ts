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
  approveProposal: () => Promise<void>;
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
            statusMessage: 'Ready for your approval, sir.',
          });
          if (!get().isMuted) jarvisVoice.speak('I have drafted the entry for your approval, sir.');
        } else if (autoExecuted.length > 0) {
          set({ isSubmitting: false, orbState: 'success', statusMessage: 'Action completed!' });
          if (!get().isMuted) jarvisVoice.speak('The action has been executed, sir.');
          setTimeout(() => {
            if (get().isOpen) get().closeHUD();
          }, 1800);
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
    approveProposal: async () => {
      const { activeProposal, activeMessageId } = get();
      if (!activeProposal || !activeMessageId) return;

      set({ isSubmitting: true, orbState: 'thinking', statusMessage: 'Writing changes...' });

      try {
        const assistantStore = useAssistantStore.getState();
        await assistantStore.executeProposal(activeMessageId, activeProposal);

        set({ isSubmitting: false, orbState: 'success', statusMessage: 'Changes committed successfully!', activeProposal: null, activeMessageId: null });

        if (!get().isMuted) {
          jarvisVoice.speak('The changes are successfully written, sir.');
        }

        toast.success('Changes successfully written! 🚀');
        setTimeout(() => {
          if (get().isOpen) get().closeHUD();
        }, 1800);
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

