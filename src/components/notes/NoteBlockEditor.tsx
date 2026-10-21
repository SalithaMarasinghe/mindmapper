import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import {
  Copy,
  Check,
  Download,
  Pin,
  Trash2,
  FolderGit2,
  Sparkles,
  Code,
  Clock,
  X,
  Plus,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { Note } from '../../types';
import { useTimelineStore } from '../../store/timelineStore';

interface NoteBlockEditorProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTogglePin: (id: string) => Promise<void>;
  isSaving: boolean;
  lastSavedAt: Date | null;
}

export function NoteBlockEditor({
  note,
  onUpdate,
  onDelete,
  onTogglePin,
  isSaving,
  lastSavedAt,
}: NoteBlockEditorProps) {
  const { projects, fetchProjects } = useTimelineStore();
  const [title, setTitle] = useState(note.title);
  const [viewMode, setViewMode] = useState<'block' | 'markdown'>('block');
  const [rawMarkdown, setRawMarkdown] = useState(note.content);
  const [isCopied, setIsCopied] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Keep title and rawMarkdown in sync when note id changes
  useEffect(() => {
    setTitle(note.title);
    setRawMarkdown(note.content);
  }, [note.id, note.title, note.content]);

  // Load projects if not loaded
  useEffect(() => {
    if (projects.length === 0) {
      void fetchProjects();
    }
  }, [projects.length, fetchProjects]);

  // Debounced auto-save timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (updates: Partial<Note>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void onUpdate(note.id, updates);
      }, 750);
    },
    [note.id, onUpdate]
  );

  // Initialize BlockNote editor
  const editor = useCreateBlockNote();

  // Load note markdown into editor when note.id changes
  const loadedNoteIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (editor && loadedNoteIdRef.current !== note.id) {
      loadedNoteIdRef.current = note.id;
      try {
        const blocks = editor.tryParseMarkdownToBlocks(note.content || '');
        editor.replaceBlocks(editor.document, blocks.length > 0 ? blocks : [{ type: 'paragraph' }]);
      } catch (err) {
        console.error('Failed to parse markdown to blocks:', err);
      }
    }
  }, [editor, note.id, note.content]);

  // Handle changes in BlockNote
  const handleEditorChange = useCallback(() => {
    if (!editor) return;
    try {
      const md = editor.blocksToMarkdownLossy(editor.document);
      setRawMarkdown(md);
      debouncedSave({ content: md });
    } catch (err) {
      console.error('Failed to serialize blocks to markdown:', err);
    }
  }, [editor, debouncedSave]);

  // Handle title edit
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSave({ title: newTitle.trim() || 'Untitled Note' });
  };

  // Handle raw markdown edit (when in markdown mode)
  const handleRawMarkdownChange = (newMd: string) => {
    setRawMarkdown(newMd);
    debouncedSave({ content: newMd });
    // Also sync back to BlockNote
    if (editor) {
      try {
        const blocks = editor.tryParseMarkdownToBlocks(newMd);
        editor.replaceBlocks(editor.document, blocks.length > 0 ? blocks : [{ type: 'paragraph' }]);
      } catch (err) {
        console.error('Failed to sync raw markdown to blocks:', err);
      }
    }
  };

  // Copy Markdown to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawMarkdown);
      setIsCopied(true);
      toast.success('Markdown copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard.');
    }
  };

  // Download .md file
  const handleDownload = () => {
    const filename = `${(title || 'note').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    const blob = new Blob([rawMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  // Project Association Change
  const handleProjectChange = (projId: string) => {
    if (projId === 'none') {
      void onUpdate(note.id, { projectId: null, projectTag: null });
    } else {
      const proj = projects.find((p) => p.id === projId);
      if (proj) {
        void onUpdate(note.id, { projectId: proj.id, projectTag: proj.name });
      }
    }
  };

  // Tags management
  const handleAddTag = () => {
    const trimmed = newTagInput.trim().toLowerCase().replace(/^#/, '');
    if (!trimmed) return;
    if (!note.tags.includes(trimmed)) {
      const updatedTags = [...note.tags, trimmed];
      void onUpdate(note.id, { tags: updatedTags });
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = note.tags.filter((t) => t !== tagToRemove);
    void onUpdate(note.id, { tags: updatedTags });
  };

  // Check if dark theme
  const isDark = useMemo(() => {
    return document.documentElement.classList.contains('dark');
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-surface overflow-hidden">
      {/* ── Top Header Toolbar ──────────────────────────────────────────────── */}
      <div className="bg-panel border-b border-border px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Left: Metadata & Project tag */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Dropdown */}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2.5 py-1 text-xs">
            <FolderGit2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <select
              value={note.projectId || 'none'}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="bg-transparent text-text font-medium focus:outline-none cursor-pointer pr-1 text-xs"
            >
              <option value="none" className="bg-panel text-text">
                No Project (General)
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-panel text-text">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags list */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-2 text-text-muted border border-border"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-red-400 transition"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}

            {isAddingTag ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTag();
                    if (e.key === 'Escape') setIsAddingTag(false);
                  }}
                  autoFocus
                  placeholder="tag name..."
                  className="px-2 py-0.5 rounded-md text-xs bg-surface border border-border text-text w-24 focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="p-1 text-accent hover:text-accent-hover"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingTag(true)}
                className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text px-1.5 py-0.5 rounded hover:bg-surface-2 transition"
                title="Add tag"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Tag</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions, View Mode Toggle & Save Status */}
        <div className="flex items-center gap-2">
          {/* Save Status */}
          <div className="flex items-center gap-1.5 text-[11px] text-text-muted mr-1">
            {isSaving ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Saved{lastSavedAt ? ` ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
              </>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('block')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                viewMode === 'block'
                  ? 'bg-surface-2 text-text font-semibold shadow-2xs'
                  : 'text-text-muted hover:text-text'
              }`}
              title="Notion-style interactive block editor"
            >
              <Sparkles className="w-3 h-3 text-accent" />
              <span>Block Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('markdown')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition ${
                viewMode === 'markdown'
                  ? 'bg-surface-2 text-text font-semibold shadow-2xs'
                  : 'text-text-muted hover:text-text'
              }`}
              title="Raw Markdown view & editor"
            >
              <Code className="w-3 h-3 text-text-muted" />
              <span>Raw Markdown</span>
            </button>
          </div>

          {/* Pin toggle */}
          <button
            type="button"
            onClick={() => void onTogglePin(note.id)}
            className={`p-1.5 rounded-lg border transition ${
              note.isPinned
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
            title={note.isPinned ? 'Unpin note' : 'Pin note to top'}
          >
            <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-current' : ''}`} />
          </button>

          {/* Copy Markdown */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-surface border border-border text-text-muted hover:text-text transition shadow-2xs"
            title="Copy full Markdown content"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download Markdown */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-lg bg-surface border border-border text-text-muted hover:text-text transition shadow-2xs"
            title="Download as .md file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Delete note */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete note "${note.title}"?`)) {
                void onDelete(note.id);
              }
            }}
            className="p-1.5 rounded-lg bg-surface border border-border text-text-muted hover:text-red-400 hover:border-red-500/30 transition shadow-2xs"
            title="Delete this note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Document Body ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 flex flex-col">
        <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col">
          {/* Document Title Header */}
          <div className="mb-6">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled Note"
              className="w-full text-3xl font-extrabold text-text bg-transparent border-none outline-none focus:outline-none tracking-tight placeholder:text-text-muted/40"
            />
            <div className="flex items-center gap-3 text-xs text-text-muted mt-2 border-b border-border/50 pb-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {new Date(note.updatedAt).toLocaleDateString()} at{' '}
                {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {note.projectTag && (
                <>
                  <span>•</span>
                  <span className="text-accent font-medium">{note.projectTag}</span>
                </>
              )}
            </div>
          </div>

          {/* Editor Content Area */}
          <div className="flex-1 flex flex-col min-h-[400px]">
            {viewMode === 'block' ? (
              <div className="blocknote-wrapper flex-1 bg-transparent">
                {editor && (
                  <BlockNoteView
                    editor={editor}
                    theme={isDark ? 'dark' : 'light'}
                    onChange={handleEditorChange}
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <textarea
                  value={rawMarkdown}
                  onChange={(e) => handleRawMarkdownChange(e.target.value)}
                  placeholder="Write your markdown here..."
                  className="w-full flex-1 min-h-[500px] p-4 font-mono text-sm bg-panel border border-border rounded-xl text-text focus:outline-none focus:border-accent transition resize-none leading-relaxed"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
