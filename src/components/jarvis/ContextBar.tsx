import { useState, type MouseEvent } from 'react';
import { ClipboardPaste, X } from 'lucide-react';
import { useJarvisStore } from '../../store/jarvisStore';

export function ContextBar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const pastedText = useJarvisStore((s) => s.pastedText);
  const setPastedText = useJarvisStore((s) => s.setPastedText);

  const lineCount = pastedText ? pastedText.split('\n').length : 0;

  const handlePasteClick = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setPastedText(pastedText ? `${pastedText}\n${text}` : text);
          setIsExpanded(true);
        }
      }
    } catch (err) {
      console.warn('Clipboard read failed', err);
    }
  };

  const handleClear = (e: MouseEvent) => {
    e.stopPropagation();
    setPastedText('');
    setIsExpanded(false);
  };

  return (
    <div className="relative mt-2">
      {isExpanded && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-bg border border-border rounded-[8px] p-2.5 shadow-lg z-10">
          <textarea
            className="w-full h-32 text-xs text-text font-mono resize-none bg-transparent outline-none"
            placeholder="Paste terminal output, git diff, or documentation here…"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
        </div>
      )}

      <div
        className="bg-surface rounded-[8px] border border-border px-3 py-2 flex items-center justify-between text-xs cursor-pointer transition-colors hover:border-border-strong"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 text-text-secondary">
          <ClipboardPaste className="w-3.5 h-3.5" />
          <span>
            {lineCount > 0 ? `Context: ${lineCount} lines` : 'No context attached'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {lineCount > 0 && (
            <button
              onClick={handleClear}
              className="text-text-muted hover:text-text transition-colors p-0.5 rounded"
              aria-label="Clear context"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handlePasteClick}
            className="text-accent text-xs hover:underline cursor-pointer"
          >
            Paste clipboard
          </button>
        </div>
      </div>
    </div>
  );
}
