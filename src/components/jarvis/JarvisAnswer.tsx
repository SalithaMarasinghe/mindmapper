import { useMemo, useState } from 'react';
import { Globe, Sparkles, Copy, Check } from 'lucide-react';
import { marked, type Tokens } from 'marked';
import type { SearchSource } from '../../types';

interface JarvisAnswerProps {
  content: string;
  timestamp?: string;
  engineeredPrompt?: string;
  searchSources?: SearchSource[];
  onCopyPrompt?: (text: string) => void;
  isCopied?: boolean;
}

// Custom marked renderer for minimal, elegant content blocks
function renderMinimalMarkdown(content: string): string {
  if (!content) return '';

  const renderer = new marked.Renderer();

  // 1. Content-fit tables with horizontal scroll wrapper & subtle row dividers
  renderer.table = function (token: Tokens.Table) {
    const defaultHtml = marked.Renderer.prototype.table.call(this, token);
    return `<div class="table-container my-3 overflow-x-auto max-w-full">${defaultHtml}</div>`;
  };

  // 2. Code blocks with hairline border, 10px radius, horizontal scroll, and hover copy button
  renderer.code = function ({ text, lang }: Tokens.Code) {
    const language = (lang || '').match(/\S*/)?.[0] || '';
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const encoded = encodeURIComponent(text);

    return `<div class="code-block-wrapper relative group my-3 rounded-[10px] overflow-hidden border border-border/40 bg-surface-2/40">
      <div class="flex items-center justify-between px-3 py-1.5 bg-surface-2/80 text-[11px] font-mono text-text-muted border-b border-border/30">
        <span>${language || 'code'}</span>
        <button type="button" class="copy-code-btn opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-[11px] text-text-secondary hover:text-text cursor-pointer" data-code="${encoded}">
          Copy
        </button>
      </div>
      <pre class="p-3 overflow-x-auto text-[13px] font-mono leading-relaxed text-text m-0"><code>${escaped}</code></pre>
    </div>`;
  };

  try {
    return marked.parse(content, {
      renderer,
      async: false,
      breaks: true,
      gfm: true,
    }) as string;
  } catch {
    return content;
  }
}

export function JarvisAnswer({
  content,
  timestamp: _timestamp,
  engineeredPrompt,
  searchSources,
  onCopyPrompt,
  isCopied,
}: JarvisAnswerProps) {
  const [isAnswerCopied, setIsAnswerCopied] = useState(false);
  const renderedHtml = useMemo(() => renderMinimalMarkdown(content), [content]);

  const handleCopyAnswer = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setIsAnswerCopied(true);
      setTimeout(() => setIsAnswerCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setIsAnswerCopied(true);
      setTimeout(() => setIsAnswerCopied(false), 2000);
    }
  };

  // Event delegation for code block copy buttons
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('.copy-code-btn') as HTMLElement | null;
    if (target && target.dataset.code) {
      const code = decodeURIComponent(target.dataset.code);
      navigator.clipboard?.writeText(code);
      const originalText = target.innerText;
      target.innerText = 'Copied!';
      setTimeout(() => {
        target.innerText = originalText;
      }, 1800);
    }
  };

  return (
    <article className="w-full">
      {/* ── Unboxed Assistant Content (Body 15px, Line Height 1.65, Softened Text) ── */}
      <div
        onClick={handleContainerClick}
        className="text-[15px] leading-[1.65] text-text/90 break-words
          [&_p]:my-3
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2.5 [&_ul]:space-y-1
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2.5 [&_ol]:space-y-1
          [&_li]:text-text/85
          [&_strong]:text-text [&_strong]:font-semibold
          [&_em]:text-text-secondary [&_em]:italic
          [&_code]:bg-surface-2 [&_code]:text-text [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-[4px] [&_code]:font-mono [&_code]:text-[13px]
          [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3.5 [&_blockquote]:italic [&_blockquote]:text-text-muted [&_blockquote]:my-3
          [&_a]:text-accent [&_a]:underline hover:[&_a]:opacity-80
          [&_h1]:text-[17px] [&_h1]:font-semibold [&_h1]:text-text [&_h1]:mt-4 [&_h1]:mb-1.5
          [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-text [&_h2]:mt-3.5 [&_h2]:mb-1
          [&_h3]:text-[14px] [&_h3]:font-medium [&_h3]:text-text [&_h3]:mt-3 [&_h3]:mb-1
          [&_hr]:border-border/40 [&_hr]:my-4
          [&_th]:border-b [&_th]:border-border/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-text-secondary [&_th]:text-[12px] [&_th]:font-semibold [&_th]:bg-transparent
          [&_td]:border-b [&_td]:border-border/25 [&_td]:px-3 [&_td]:py-2 [&_td]:text-[13px]"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

      {/* ── Answer Actions & Sources Row ───────────────────────────────── */}
      <footer className="mt-3 pt-2 flex items-center justify-between flex-wrap gap-2 text-xs border-t border-border/20">
        <button
          type="button"
          onClick={handleCopyAnswer}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11px] font-medium text-text-secondary hover:text-text bg-surface-2/50 hover:bg-surface-2 border border-border/40 transition-colors cursor-pointer"
          title="Copy answer"
          aria-label="Copy answer to clipboard"
        >
          {isAnswerCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>

        {searchSources && searchSources.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted ml-auto">
            <span className="text-[11px] text-text-secondary font-medium flex items-center gap-1">
              <Globe className="w-3 h-3 text-text-muted" /> Sources:
            </span>
            {searchSources.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-text underline decoration-border-strong/60 transition-colors truncate max-w-[200px]"
                title={source.title}
              >
                {source.title}
              </a>
            ))}
          </div>
        )}
      </footer>

      {/* ── Context-Engineered Prompt Block ───────────────────────────── */}
      {engineeredPrompt && (
        <section className="mt-4 pt-3 border-t border-border/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              Context-Engineered Prompt
            </span>
            {onCopyPrompt && (
              <button
                onClick={() => onCopyPrompt(engineeredPrompt)}
                className="px-2.5 py-1 rounded-[6px] bg-surface-2 border border-border/50 text-[11px] text-text-secondary hover:text-text transition-colors flex items-center gap-1 cursor-pointer"
                aria-label="Copy context-engineered prompt"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {isCopied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div className="bg-surface-2/40 rounded-[10px] border border-border/40 p-3 font-mono text-[13px] leading-relaxed text-text whitespace-pre-wrap max-h-[300px] overflow-y-auto">
            {engineeredPrompt}
          </div>
        </section>
      )}
    </article>
  );
}
