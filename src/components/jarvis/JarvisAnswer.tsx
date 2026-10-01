import { Globe, ExternalLink, Sparkles, Copy, Check } from 'lucide-react';
import type { SearchSource } from '../../types';

interface JarvisAnswerProps {
  content: string;
  timestamp: string;
  engineeredPrompt?: string;
  searchSources?: SearchSource[];
  onCopyPrompt?: (text: string) => void;
  isCopied?: boolean;
}

export function JarvisAnswer({
  content,
  timestamp,
  engineeredPrompt,
  searchSources,
  onCopyPrompt,
  isCopied,
}: JarvisAnswerProps) {
  return (
    <article className="max-w-4xl w-full">
      <header className="text-[11px] text-text-muted mb-2 flex items-center gap-2">
        <span className="font-medium text-text">Jarvis</span>
        <span className="font-mono">{timestamp}</span>
      </header>
      
      <div className="text-sm text-text leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </div>

      {searchSources && searchSources.length > 0 && (
        <section className="mt-4 border-t border-border pt-3">
          <h3 className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            Web sources ({searchSources.length})
          </h3>
          <div className="inline-flex gap-2 flex-wrap">
            {searchSources.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-[8px] bg-surface border border-border hover:border-border-strong text-xs text-text-secondary hover:text-text transition-all duration-200 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="max-w-[200px] truncate">{source.title}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {engineeredPrompt && (
        <section className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs text-text-secondary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Context-engineered prompt
            </h3>
            {onCopyPrompt && (
              <button
                onClick={() => onCopyPrompt(engineeredPrompt)}
                className="px-3 py-1 rounded-[8px] bg-surface border border-border text-xs text-text-secondary hover:text-text transition-all duration-200 flex items-center gap-1.5"
                aria-label="Copy context-engineered prompt"
              >
                {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {isCopied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div className="bg-surface rounded-[8px] border border-border p-3 font-mono text-xs text-text whitespace-pre-wrap max-h-[300px] overflow-y-auto mt-2">
            {engineeredPrompt}
          </div>
        </section>
      )}
    </article>
  );
}
