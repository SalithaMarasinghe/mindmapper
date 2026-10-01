import { Globe } from 'lucide-react';

interface StreamHeaderProps {
  messageCount: number;
  isWebSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  onNewSession: () => void;
}

export function StreamHeader({
  messageCount,
  isWebSearchEnabled,
  onToggleWebSearch,
  onNewSession,
}: StreamHeaderProps) {
  return (
    <header className="px-5 py-2.5 border-b border-border bg-bg shrink-0 flex items-center justify-between">
      <div className="flex items-center">
        <h2 className="text-sm font-medium text-text">Conversation</h2>
        <span className="text-text-muted text-xs ml-2 bg-surface-2 px-1.5 py-0.5 rounded-full">
          {messageCount}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleWebSearch}
          aria-label="Toggle web search"
          className={`rounded-full px-3 py-1 text-xs border transition-colors duration-200 cursor-pointer flex items-center gap-1.5 ${
            isWebSearchEnabled
              ? 'bg-surface-2 text-accent border-accent/30'
              : 'bg-surface text-text-muted border-border hover:text-text-secondary'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Web search
        </button>
        {messageCount > 0 && (
          <button
            onClick={onNewSession}
            className="text-xs text-text-muted hover:text-text px-2 py-1 rounded-[8px] hover:bg-surface transition-all duration-200"
          >
            New session
          </button>
        )}
      </div>
    </header>
  );
}
