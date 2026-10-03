import { Globe, Plus } from 'lucide-react';
import { ActiveProjectSelector } from '../layout/ActiveProjectSelector';
import { JarvisOrb } from './JarvisOrb';
import { useJarvisStore } from '../../store/jarvisStore';
import { isVoiceInputEnabled } from '../../lib/jarvisFlags';

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
  const { orbState, toggleVoiceMode } = useJarvisStore();

  return (
    <header className="px-5 py-2.5 border-b border-border/20 bg-bg shrink-0 flex items-center justify-between z-20">
      {/* Left: Jarvis Wordmark + Minimal Project Selector */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span className="font-semibold text-text text-sm tracking-tight shrink-0">
          Jarvis
        </span>
        <span className="text-text-muted/30 text-xs select-none">/</span>
        <ActiveProjectSelector compact variant="minimal" />
      </div>

      {/* Center: Small Orb (hidden when voice input is disabled) */}
      {isVoiceInputEnabled() && (
        <div className="flex items-center justify-center shrink-0">
          <JarvisOrb
            size={42}
            state={orbState}
            onClick={toggleVoiceMode}
          />
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center justify-end gap-2.5 flex-1 min-w-0">
        <button
          onClick={onToggleWebSearch}
          aria-label="Toggle web search"
          className={`rounded-full px-2.5 py-1 text-xs border transition-colors duration-200 cursor-pointer flex items-center gap-1.5 ${
            isWebSearchEnabled
              ? 'bg-surface-2 text-accent border-accent/30'
              : 'bg-surface text-text-muted border-border hover:text-text-secondary'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Web search</span>
        </button>
        {messageCount > 0 && (
          <button
            onClick={onNewSession}
            className="text-xs text-text-muted hover:text-text p-1.5 rounded-[8px] hover:bg-surface transition-all duration-200 cursor-pointer"
            title="New session"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
