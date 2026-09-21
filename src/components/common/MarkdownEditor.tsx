import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  FileCode,
  Quote,
  Link,
  Eye,
  Edit3,
  Columns2,
  Sparkles,
} from 'lucide-react';
import { MarkdownViewer } from './MarkdownViewer';
import { htmlToMarkdown } from '../../utils/htmlToMarkdown';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  id?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write in Markdown or paste from AI chat...',
  minHeight = '180px',
  className = '',
  id,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<'write' | 'split' | 'preview'>('write');
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear notice after 4 seconds
  useEffect(() => {
    if (pasteNotice) {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => {
        setPasteNotice(null);
      }, 4000);
    }
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, [pasteNotice]);

  // Helper to wrap selected text or insert formatting at cursor
  const insertFormatting = useCallback(
    (prefix: string, suffix: string = '', defaultText: string = '') => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end) || defaultText;

      const replacement = `${prefix}${selectedText}${suffix}`;
      const newValue = value.substring(0, start) + replacement + value.substring(end);

      onChange(newValue);

      setTimeout(() => {
        textarea.focus();
        const cursorStart = start + prefix.length;
        const cursorEnd = cursorStart + selectedText.length;
        textarea.setSelectionRange(cursorStart, cursorEnd);
      }, 0);
    },
    [value, onChange]
  );

  // Helper to prefix the current line (e.g. for headings, lists, quotes, tasks)
  const prefixLine = useCallback(
    (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const beforeCursor = value.substring(0, start);

      const lastNewline = beforeCursor.lastIndexOf('\n');
      const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

      const currentLinePrefix = value.substring(lineStart, lineStart + prefix.length);

      if (currentLinePrefix === prefix) {
        const newValue = value.substring(0, lineStart) + value.substring(lineStart + prefix.length);
        onChange(newValue);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start - prefix.length, start - prefix.length);
        }, 0);
        return;
      }

      const newValue = value.substring(0, lineStart) + prefix + value.substring(lineStart);
      onChange(newValue);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }, 0);
    },
    [value, onChange]
  );

  // Smart Paste Handler: Converts rich HTML from ChatGPT/Claude/Gemini into Markdown
  // and automatically switches to Preview mode to immediately show formatted result!
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const clipboard = e.clipboardData;
      if (!clipboard) return;

      const html = clipboard.getData('text/html');
      const plain = clipboard.getData('text/plain');

      let markdownToInsert = '';
      let convertedFromHtml = false;

      // Check if rich HTML with actual structural elements is present
      const hasRichHtml =
        html &&
        /<(h[1-6]|ul|ol|li|pre|code|strong|b|em|i|blockquote|table|p|a|br)\b/i.test(html);

      if (hasRichHtml) {
        try {
          const converted = htmlToMarkdown(html);
          if (converted && converted.trim()) {
            markdownToInsert = converted;
            convertedFromHtml = true;
          }
        } catch (err) {
          console.warn('htmlToMarkdown failed, falling back to plainText:', err);
        }
      }

      if (!markdownToInsert) {
        markdownToInsert = plain;
      }

      if (!markdownToInsert) return;

      e.preventDefault();

      const textarea = textareaRef.current;
      let newValue = '';

      if (textarea && mode !== 'preview') {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        newValue = value.substring(0, start) + markdownToInsert + value.substring(end);
      } else {
        // If pasted in preview mode or when textarea not active
        newValue = value && value.trim() ? `${value}\n\n${markdownToInsert}` : markdownToInsert;
      }

      onChange(newValue);

      // Automatically switch to Preview mode so the user sees the rendered result immediately!
      setMode('preview');
      setPasteNotice(
        convertedFromHtml
          ? '✨ AI chat formatted & previewing as Markdown'
          : '✨ Pasted & previewing as Markdown'
      );
    },
    [value, onChange, mode]
  );

  // Keyboard shortcuts handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
      return;
    }

    // Ctrl/Cmd + B for Bold
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertFormatting('**', '**', 'bold text');
      return;
    }

    // Ctrl/Cmd + I for Italic
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertFormatting('*', '*', 'italic text');
      return;
    }

    // Ctrl/Cmd + K for Link
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      insertFormatting('[', '](url)', 'link text');
      return;
    }
  };

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  return (
    <div
      onPaste={handlePaste}
      tabIndex={mode === 'preview' ? 0 : undefined}
      className={`flex flex-col rounded-xl border border-[#2d3748] bg-[#0f1117] overflow-hidden focus-within:border-teal-500/70 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all ${className}`}
    >
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-1 px-3 py-2 bg-[#161b26] border-b border-[#2d3748] select-none">
        {/* Formatting Actions (Visible in write or split modes) */}
        <div className={`flex flex-wrap items-center gap-0.5 ${mode === 'preview' ? 'opacity-40 pointer-events-none' : ''}`}>
          <button
            type="button"
            title="Heading 1 (# )"
            onClick={() => prefixLine('# ')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Heading 2 (## )"
            onClick={() => prefixLine('## ')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Heading 3 (### )"
            onClick={() => prefixLine('### ')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-[#2d3748] mx-1" />

          <button
            type="button"
            title="Bold (**text**) (Ctrl+B)"
            onClick={() => insertFormatting('**', '**', 'bold')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Italic (*text*) (Ctrl+I)"
            onClick={() => insertFormatting('*', '*', 'italic')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Strikethrough (~~text~~)"
            onClick={() => insertFormatting('~~', '~~', 'strikethrough')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-[#2d3748] mx-1" />

          <button
            type="button"
            title="Bullet List (- )"
            onClick={() => prefixLine('- ')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Numbered List (1. )"
            onClick={() => prefixLine('1. ')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Task / Checklist (- [ ] )"
            onClick={() => prefixLine('- [ ] ')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-[#2d3748] mx-1" />

          <button
            type="button"
            title="Inline Code (`code`)"
            onClick={() => insertFormatting('`', '`', 'code')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Code Block (```)"
            onClick={() => insertFormatting('```\n', '\n```', 'code here')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <FileCode className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Blockquote (> )"
            onClick={() => prefixLine('> ')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Link ([title](url)) (Ctrl+K)"
            onClick={() => insertFormatting('[', '](https://)', 'link text')}
            className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-[#232936] transition-colors"
          >
            <Link className="w-4 h-4" />
          </button>
        </div>

        {/* View Mode Toggle: Write | Split | Preview */}
        <div className="flex items-center bg-[#0f1117] p-0.5 rounded-lg border border-[#2d3748] text-xs">
          <button
            type="button"
            onClick={() => setMode('write')}
            title="Write mode (edit markdown)"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              mode === 'write'
                ? 'bg-[#1e2433] text-teal-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Write
          </button>
          <button
            type="button"
            onClick={() => setMode('split')}
            title="Split view (editor + live preview)"
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              mode === 'split'
                ? 'bg-[#1e2433] text-teal-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            Split
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            title="Preview formatted markdown"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              mode === 'preview'
                ? 'bg-[#1e2433] text-teal-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>
      </div>

      {/* ── Auto-Paste Notification Banner ────────────────────────────── */}
      {pasteNotice && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-teal-950/40 border-b border-teal-800/40 text-xs text-teal-300 animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>{pasteNotice}</span>
          </div>
          {mode === 'preview' && (
            <button
              type="button"
              onClick={() => setMode('write')}
              className="text-xs font-semibold text-teal-400 hover:text-teal-200 underline underline-offset-2 flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" /> Edit raw text
            </button>
          )}
        </div>
      )}

      {/* ── Editor / Preview Area ────────────────────────────────────── */}
      {mode === 'write' && (
        <textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          style={{ minHeight }}
          className="w-full bg-transparent p-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-y leading-relaxed font-sans"
        />
      )}

      {mode === 'split' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#2d3748]" style={{ minHeight }}>
          <textarea
            id={id}
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            style={{ minHeight }}
            className="w-full bg-transparent p-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-y leading-relaxed font-sans"
          />
          <div
            style={{ minHeight }}
            className="w-full p-4 overflow-y-auto bg-[#0b0e14]/50"
          >
            <div className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mb-2">Live Preview</div>
            <MarkdownViewer
              content={value}
              emptyPlaceholder="Start typing on the left to see live Markdown preview."
            />
          </div>
        </div>
      )}

      {mode === 'preview' && (
        <div
          style={{ minHeight }}
          className="relative w-full p-4 overflow-y-auto bg-[#0b0e14]/50 group"
          onDoubleClick={() => setMode('write')}
        >
          {/* Quick Edit Overlay Button */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('write')}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#1e2433] hover:bg-[#2d3748] border border-[#2d3748] text-slate-300 hover:text-slate-100 rounded-md shadow-sm transition-all"
            >
              <Edit3 className="w-3 h-3 text-teal-400" />
              Edit
            </button>
          </div>

          <MarkdownViewer
            content={value}
            emptyPlaceholder="Nothing to preview yet. Switch back to Write mode to add content or paste from AI chat."
          />
        </div>
      )}

      {/* ── Footer Info Bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#121620] border-t border-[#2d3748]/50 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span>AI Chat paste supported</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-500 hidden sm:inline">Ctrl+V automatically formats to Markdown</span>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span>{wordCount} words</span>
          <span>{charCount} chars</span>
        </div>
      </div>
    </div>
  );
}
