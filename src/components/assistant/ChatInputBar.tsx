import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowUp, CornerDownLeft } from 'lucide-react';
import { QuickActionChips } from './QuickActionChips';

interface ChatInputBarProps {
  text?: string;
  setText: (val: string) => void;
  onSendMessage: (text: string) => void;
  disabled: boolean;
}

export function ChatInputBar({
  text = '',
  setText,
  onSendMessage,
  disabled,
}: ChatInputBarProps) {
  const currentText = text ?? '';
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = currentText.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="border-t border-[#111111] bg-[#000000]/90 backdrop-blur-md px-4 py-3 shrink-0">
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* Quick prompt chips */}
        <div className="overflow-x-auto pb-1 scrollbar-thin">
          <QuickActionChips
            onSelect={(prompt) => {
              setText(prompt);
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
            }}
            disabled={disabled}
          />
        </div>

        {/* Input box */}
        <div className="relative flex items-end gap-2 bg-[#0a0a0a] border border-[#161616] rounded-2xl p-2 focus-within:border-teal-500/50 focus-within:ring-1 focus-within:ring-teal-500/30 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={currentText}
            onChange={(e) => {
              setText(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask anything, start a task, log notes, or paste updates..."
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none focus:outline-none px-3 py-1.5 max-h-48 leading-relaxed"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !currentText.trim()}
            className="w-9 h-9 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:bg-[#0a0a0a] disabled:text-slate-600 text-slate-950 flex items-center justify-center shrink-0 transition-all shadow-sm disabled:cursor-not-allowed cursor-pointer"
            title="Send message (Enter)"
          >
            <ArrowUp className="w-5 h-5 font-bold" />
          </button>
        </div>

        <div className="flex items-center justify-between px-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <span>Actions require confirmation before saving to database</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <CornerDownLeft className="w-3 h-3" />
            <span>Enter to send, Shift+Enter for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
}
