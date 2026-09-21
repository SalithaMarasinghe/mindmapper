import { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownViewerProps {
  content?: string | null;
  className?: string;
  emptyPlaceholder?: string;
}

export function MarkdownViewer({
  content,
  className = '',
  emptyPlaceholder,
}: MarkdownViewerProps) {
  const html = useMemo(() => {
    if (!content || !content.trim()) return null;
    try {
      return marked.parse(content, {
        gfm: true,
        breaks: true,
      }) as string;
    } catch (err) {
      console.error('Failed to parse markdown:', err);
      return null;
    }
  }, [content]);

  if (!content || !content.trim()) {
    if (emptyPlaceholder) {
      return <p className="text-xs text-slate-500 italic">{emptyPlaceholder}</p>;
    }
    return null;
  }

  if (!html) {
    return <p className={`text-slate-300 text-sm whitespace-pre-wrap ${className}`}>{content}</p>;
  }

  return (
    <div
      className={`notion-markdown text-sm text-slate-200 leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
