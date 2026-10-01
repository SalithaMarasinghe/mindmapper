import { useRef, useEffect } from 'react';
import { Mic, Send } from 'lucide-react';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onMicClick: () => void;
  isDisabled: boolean;
  isRecording: boolean;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onMicClick,
  isDisabled,
  isRecording,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="bg-panel border-t border-border px-4 py-3 shrink-0">
      <div className="max-w-5xl mx-auto">
        <div className="bg-surface rounded-[16px] border border-border flex items-end px-3 py-2 gap-2 focus-within:border-border-strong transition-all duration-200 ease-out">
          <button
            onClick={onMicClick}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            className={`p-1.5 rounded-full transition-colors duration-200 ease-out mb-0.5 shrink-0 ${
              isRecording
                ? 'text-accent bg-accent/10'
                : 'text-text-muted hover:text-text hover:bg-surface-2'
            }`}
          >
            <Mic className="w-5 h-5" />
          </button>
          
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            placeholder="Ask Jarvis anything..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted resize-none focus:outline-none min-h-[20px] max-h-[120px] leading-relaxed py-1.5"
          />
          
          <button
            onClick={onSubmit}
            disabled={isDisabled || !value.trim()}
            aria-label="Send message"
            className="w-8 h-8 rounded-full bg-text text-bg flex items-center justify-center shrink-0 mb-0.5 disabled:opacity-30 hover:opacity-90 active:scale-95 transition-all duration-200 ease-out"
          >
            <Send className="w-4 h-4 ml-[-2px]" />
          </button>
        </div>
        <div className="text-[11px] text-text-muted mt-1.5 px-1 text-center">
          Press Enter to send &middot; Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
