import { create } from 'zustand';
import { jarvisVoice } from '../services/jarvisVoice';
import { useAssistantStore } from './assistantStore';
import { supabase } from '../lib/supabase';
import type { AssistantProposal } from '../types';
import { toast } from 'react-hot-toast';

export type OrbVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success';

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

  openHUD: (greet?: boolean) => void;
  closeHUD: () => void;
  setTranscript: (text: string) => void;
  setPastedText: (text: string) => void;
  toggleMute: () => void;
  toggleRecording: () => Promise<void>;
  submitCommand: (manualText?: string) => Promise<void>;
  approveProposal: () => Promise<void>;
  rejectProposal: () => void;
}

export const useJarvisStore = create<JarvisState>((set, get) => {
  // Sync TTS orb state callback
  jarvisVoice.setOrbStateCallback((orbState) => {
    if (get().isOpen) set({ orbState });
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
    statusMessage: 'Press the mic to start recording',
    activeProposal: null,
    activeMessageId: null,
    isMuted: false,
    isSubmitting: false,

    // ── Open HUD ──────────────────────────────────────────────────────────
    openHUD: (greet = true) => {
      set({
        isOpen: true,
        orbState: 'idle',
        statusMessage: 'Press the mic to start recording',
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
      // Stop any ongoing recording
      if (get().isRecording) {
        void jarvisVoice.stopRecording();
      }
      set({
        isOpen: false,
        orbState: 'idle',
        statusMessage: 'Press the mic to start recording',
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

    toggleMute: () => {
      const isMuted = !get().isMuted;
      set({ isMuted });
      if (isMuted) window.speechSynthesis?.cancel();
    },

    // ── Toggle push-to-talk recording ─────────────────────────────────────
    toggleRecording: async () => {
      if (get().isSubmitting || get().isTranscribing) return;

      if (get().isRecording) {
        // ── STOP → Transcribe ──────────────────────────────────────────
        set({ isRecording: false, isTranscribing: true, orbState: 'thinking', statusMessage: 'Transcribing...' });

        const blob = await jarvisVoice.stopRecording();

        if (!blob || blob.size < 1000) {
          // Too short / empty
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
            statusMessage: 'Transcribed! Review and press Send.',
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Transcription failed';
          console.error('[Jarvis] Transcription error:', err);
          toast.error(msg);
          set({ isTranscribing: false, orbState: 'idle', statusMessage: 'Transcription failed — try again' });
        }
      } else {
        // ── START recording ────────────────────────────────────────────
        set({ transcript: '', statusMessage: 'Starting microphone...' });

        const ok = await jarvisVoice.startRecording();
        if (!ok) {
          toast.error('Microphone access denied. Please allow mic permissions and try again.');
          set({ statusMessage: 'Microphone access denied' });
          return;
        }

        set({ isRecording: true, orbState: 'listening', statusMessage: 'Recording... press mic again to stop' });

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
      const text = (manualText !== undefined ? manualText : get().transcript).trim();
      const pasted = get().pastedText.trim();

      if (!text && !pasted) {
        toast('Record a voice command or paste data first.');
        return;
      }

      set({
        isSubmitting: true,
        orbState: 'thinking',
        statusMessage: 'Analyzing & compiling changes, sir...',
      });

      let fullMessage = text;
      if (pasted) {
        fullMessage = fullMessage
          ? `${fullMessage}\n\n--- Pasted Content / Logs ---\n${pasted}`
          : `Please process and log the following data:\n\n${pasted}`;
      }

      try {
        const assistantStore = useAssistantStore.getState();
        await assistantStore.sendMessage(fullMessage);

        const latestMessages = useAssistantStore.getState().messages;
        const lastMsg = latestMessages[latestMessages.length - 1];

        if (!lastMsg || lastMsg.role !== 'assistant') {
          throw new Error('No response received from assistant');
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
          setTimeout(() => get().closeHUD(), 1800);
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

        set({ isSubmitting: false, orbState: 'success', statusMessage: 'Changes committed successfully!' });

        if (!get().isMuted) {
          jarvisVoice.speak('The changes are successfully written, sir.');
        }

        toast.success('Changes successfully written! 🚀');
        setTimeout(() => get().closeHUD(), 1800);
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
      setTimeout(() => get().closeHUD(), 1000);
    },
  };
});
