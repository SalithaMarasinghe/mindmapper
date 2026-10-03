import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Plus, VolumeX } from 'lucide-react';

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onMicClick: () => void;
  isDisabled: boolean;
  isRecording: boolean;
  isSpeaking?: boolean;
  placeholder?: string;
  onAttach?: (file: File) => void;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onMicClick,
  isDisabled,
  isRecording,
  isSpeaking = false,
  placeholder = 'Ask Jarvis...',
  onAttach,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isDisabled && value.trim()) {
        onSubmit();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttach) {
      onAttach(file);
    }
    // Reset file input value so same file can be re-attached if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const hasText = Boolean(value.trim());

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none z-30 flex flex-col justify-end pb-[max(env(safe-area-inset-bottom,0px),16px)] pt-10 bg-gradient-to-t from-bg via-bg/85 to-transparent transition-all duration-300 ease-in-out">
      <div className="max-w-[720px] mx-auto w-full px-4 flex items-end gap-2.5 pointer-events-auto">
        {/* Hidden file input for + attach */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* ── Center Pill Dock ── */}
        <div className="flex-1 min-w-0 bg-surface-2/90 backdrop-blur-md rounded-[26px] border border-border/60 hover:border-border-strong focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20 flex items-end px-2 py-1.5 shadow-lg transition-all">
          {/* + Attach Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file or context"
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text hover:bg-surface transition-colors cursor-pointer shrink-0 mb-0.5"
            title="Attach file or context"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Text Input (auto-expanding textarea) */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            placeholder={isRecording ? 'Listening to voice...' : placeholder}
            className="flex-1 bg-transparent text-[15px] text-text placeholder:text-text-muted/60 resize-none focus:outline-none min-h-[24px] max-h-[120px] leading-relaxed px-2 py-1"
          />

          {/* Round Send Button (prominent only when there is text) */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isDisabled || !hasText}
            aria-label="Send message"
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mb-0.5 transition-all duration-200 cursor-pointer ${
              hasText
                ? 'bg-text text-bg hover:opacity-90 active:scale-95 shadow-sm scale-100 opacity-100'
                : 'text-text-muted/20 bg-surface/30 cursor-default opacity-40 scale-90'
            }`}
          >
            <Send className="w-3.5 h-3.5 ml-[-1px]" />
          </button>
        </div>

        {/* ── Separate Round Mic Button (Red Live State on Recording) ── */}
        <button
          type="button"
          onClick={onMicClick}
          disabled={isDisabled}
          aria-label={isRecording ? 'Stop recording' : 'Start voice dictation'}
          title={isRecording ? 'Stop recording' : 'Dictate with voice'}
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer shadow-md mb-0.5 ${
            isRecording
              ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/40 scale-105'
              : isSpeaking
              ? 'bg-surface-2 text-accent border border-accent/40'
              : 'bg-surface-2/90 backdrop-blur-md border border-border/60 text-text-muted hover:text-text hover:border-border-strong active:scale-95'
          }`}
        >
          {isRecording ? (
            <MicOff className="w-5 h-5 text-white" />
          ) : isSpeaking ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
