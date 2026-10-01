import { Mic } from 'lucide-react';

interface UserMessageProps {
  content: string;
  timestamp: string;
  isVoice?: boolean;
  hasContext?: boolean;
}

export function UserMessage({ content, timestamp, isVoice, hasContext }: UserMessageProps) {
  return (
    <div className="flex justify-end w-full">
      <div className="bg-surface-2 rounded-[16px] rounded-br-[4px] px-4 py-3 max-w-[75%] text-sm text-text">
        <div className="text-[11px] text-text-muted mb-1.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">You</span>
            {isVoice && <Mic className="w-3 h-3 text-text-muted" />}
            {hasContext && (
              <span className="text-accent text-[10px] bg-accent/10 rounded-full px-1.5 py-0.5">
                +context
              </span>
            )}
          </div>
          <span className="font-mono">{timestamp}</span>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
          {content}
        </div>
      </div>
    </div>
  );
}
