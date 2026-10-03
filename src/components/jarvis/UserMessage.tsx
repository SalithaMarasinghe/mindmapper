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
      <div className="bg-surface-2/80 border border-border/30 rounded-[20px] rounded-br-[6px] px-4 py-2.5 max-w-[80%] text-text shadow-sm">
        {(isVoice || hasContext) && (
          <div className="text-[11px] text-text-muted mb-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {isVoice && <Mic className="w-3 h-3 text-text-muted" />}
              {hasContext && (
                <span className="text-accent text-[10px] bg-accent/10 rounded-full px-1.5 py-0.5">
                  +context
                </span>
              )}
            </div>
            {timestamp && <span className="font-mono text-[10px] text-text-muted/70">{timestamp}</span>}
          </div>
        )}
        <div className="whitespace-pre-wrap text-[15px] leading-[1.6] text-text/95 break-words">
          {content}
        </div>
      </div>
    </div>
  );
}
