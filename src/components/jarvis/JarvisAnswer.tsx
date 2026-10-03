import { useMemo } from 'react';
import { Globe, ExternalLink, Sparkles, Copy, Check } from 'lucide-react';
import { marked } from 'marked';
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
  const renderedHtml = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content, {
        async: false,
        breaks: true,
        gfm: true,
      }) as string;
    } catch {
      return content;
    }
  }, [content]);

  return (
    <article className="max-w-4xl w-full">
      <header className="text-[11px] text-text-muted mb-2 flex items-center gap-2">
        <span className="font-medium text-text">Jarvis</span>
        <span className="font-mono">{timestamp}</span>
      </header>
      
      {/* ── Rich Markdown Renderer ────────────────────────────────────────── */}
      <div
        className="text-sm text-text leading-relaxed break-words space-y-2
          [&_p]:my-1.5 
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1 
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1 
          [&_li]:text-text-secondary 
          [&_strong]:text-text [&_strong]:font-semibold
          [&_em]:text-text-muted [&_em]:italic
          [&_code]:bg-surface-2 [&_code]:text-accent [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs
          [&_pre]:bg-surface [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-2 [&_pre]:border [&_pre]:border-border
          [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-text-muted [&_blockquote]:my-2
          [&_a]:text-accent [&_a]:underline hover:[&_a]:text-accent/80
          [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-text [&_h1]:mt-3 [&_h1]:mb-1
          [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-text [&_h2]:mt-2.5 [&_h2]:mb-1
          [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-text [&_h3]:mt-2 [&_h3]:mb-0.5
          [&_hr]:border-border [&_hr]:my-3
          [&_table]:w-full [&_table]:border-collapse [&_table]:my-2.5 [&_table]:text-xs
          [&_th]:border [&_th]:border-border [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:bg-surface [&_th]:text-left [&_th]:font-semibold
          [&_td]:border [&_td]:border-border [&_td]:px-2.5 [&_td]:py-1.5"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

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
