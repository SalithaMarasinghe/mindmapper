import { useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Pin,
  Clock,
  Trash2,
  FolderGit2,
  Sparkles,
  BookOpen,
  Calendar,
} from 'lucide-react';
import { useNoteStore } from '../../store/noteStore';
import { useTimelineStore } from '../../store/timelineStore';
import { NoteBlockEditor } from './NoteBlockEditor';

export function NotesView() {
  const {
    notes,
    activeNoteId,
    isLoading,
    isSaving,
    lastSavedAt,
    searchQuery,
    selectedProjectId,
    fetchNotes,
    selectNote,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    setSearchQuery,
    setSelectedProjectId,
  } = useNoteStore();

  const { projects, fetchProjects } = useTimelineStore();

  useEffect(() => {
    void fetchNotes();
    if (projects.length === 0) {
      void fetchProjects();
    }
  }, [fetchNotes, projects.length, fetchProjects]);

  // Filtered notes by project and search query
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Project filter
    if (selectedProjectId !== 'all') {
      result = result.filter(
        (n) =>
          n.projectId === selectedProjectId ||
          (n.projectTag &&
            projects.find((p) => p.id === selectedProjectId)?.name.toLowerCase() ===
              n.projectTag.toLowerCase())
      );
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (n.projectTag && n.projectTag.toLowerCase().includes(q)) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [notes, selectedProjectId, searchQuery, projects]);

  // Split into pinned and regular notes
  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => n.isPinned),
    [filteredNotes]
  );
  const regularNotes = useMemo(
    () => filteredNotes.filter((n) => !n.isPinned),
    [filteredNotes]
  );

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || null,
    [notes, activeNoteId]
  );

  const handleCreateNew = async () => {
    let projectTag: string | undefined = undefined;
    let projectId: string | undefined = undefined;

    if (selectedProjectId !== 'all') {
      const proj = projects.find((p) => p.id === selectedProjectId);
      if (proj) {
        projectId = proj.id;
        projectTag = proj.name;
      }
    }

    await createNote({
      title: 'Untitled Note',
      content: '',
      projectId,
      projectTag,
    });
  };

  // Helper to extract clean snippet
  const getCleanSnippet = (content: string) => {
    if (!content) return 'Empty note';
    return content
      .replace(/[#*`_~>\-[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
  };

  return (
    <div className="flex-1 flex h-full min-h-0 bg-bg overflow-hidden">
      {/* ── Left Sidebar (Notes List & Navigation) ──────────────────────────── */}
      <div className="w-80 md:w-88 shrink-0 bg-panel border-r border-border flex flex-col h-full min-h-0 select-none shadow-xs">
        {/* Header & Quick Action */}
        <div className="p-4 border-b border-border flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-accent-dim text-accent border border-border">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-text tracking-tight">Notes</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface text-text-muted border border-border">
                {notes.length}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover text-xs font-semibold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Note</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes or #tags..."
              className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:border-accent transition shadow-2xs"
            />
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2.5 py-1 text-xs">
            <FolderGit2 className="w-3 h-3 text-text-muted shrink-0" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-text font-medium focus:outline-none cursor-pointer w-full text-xs"
            >
              <option value="all" className="bg-panel text-text">
                All Projects
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-panel text-text">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes Scrollable List */}
        <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1">
          {isLoading && notes.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">
              Loading notes...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="py-12 px-4 text-center flex flex-col items-center gap-2 text-text-muted">
              <BookOpen className="w-8 h-8 opacity-40" />
              <p className="text-xs font-medium">No notes found</p>
              <p className="text-[11px] text-text-muted/70">
                {searchQuery ? 'Try a different search term' : 'Click "+ New Note" to create your first note.'}
              </p>
            </div>
          ) : (
            <>
              {/* Pinned Notes Section */}
              {pinnedNotes.length > 0 && (
                <div className="flex flex-col gap-1 mb-2">
                  <div className="flex items-center gap-1 px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    <Pin className="w-2.5 h-2.5 text-amber-400 fill-current" />
                    <span>Pinned</span>
                  </div>
                  {pinnedNotes.map((note) => renderNoteCard(note))}
                </div>
              )}

              {/* Regular Notes Section */}
              {regularNotes.length > 0 && (
                <div className="flex flex-col gap-1">
                  {pinnedNotes.length > 0 && (
                    <div className="px-2 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Notes
                    </div>
                  )}
                  {regularNotes.map((note) => renderNoteCard(note))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right Main Editor Pane ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full min-h-0 bg-surface overflow-hidden">
        {activeNote ? (
          <NoteBlockEditor
            note={activeNote}
            onUpdate={updateNote}
            onDelete={deleteNote}
            onTogglePin={togglePin}
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted">
            <div className="p-4 rounded-2xl bg-surface-2 border border-border mb-3">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-base font-bold text-text mb-1">No Note Selected</h3>
            <p className="text-xs text-text-muted max-w-sm mb-4">
              Select an existing note from the sidebar or create a new Notion-style Markdown note to start drafting.
            </p>
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white hover:bg-accent-hover text-xs font-semibold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Note</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  function renderNoteCard(note: typeof notes[0]) {
    const isActive = note.id === activeNoteId;
    return (
      <div
        key={note.id}
        onClick={() => selectNote(note.id)}
        className={`group relative p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1.5 ${
          isActive
            ? 'bg-surface-2 border-accent/40 shadow-xs ring-1 ring-accent/20'
            : 'bg-surface/60 border-border/70 hover:bg-surface-2 hover:border-border'
        }`}
      >
        {/* Top row: Title & pin badge */}
        <div className="flex items-start justify-between gap-1.5">
          <h4
            className={`text-xs font-semibold truncate ${
              isActive ? 'text-accent' : 'text-text'
            }`}
          >
            {note.title || 'Untitled Note'}
          </h4>

          {note.isPinned && (
            <Pin className="w-3 h-3 text-amber-400 fill-current shrink-0 mt-0.5" />
          )}
        </div>

        {/* Content snippet */}
        <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
          {getCleanSnippet(note.content)}
        </p>

        {/* Bottom row: Project & Timestamp */}
        <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-text-muted/80">
          <div className="flex items-center gap-1.5 truncate">
            {note.projectTag && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-2 border border-border text-accent truncate max-w-[120px]">
                {note.projectTag}
              </span>
            )}
            {note.tags.length > 0 && (
              <span className="text-text-muted truncate">
                #{note.tags[0]}
                {note.tags.length > 1 ? ` +${note.tags.length - 1}` : ''}
              </span>
            )}
          </div>

          <span className="shrink-0 text-text-muted/60">
            {new Date(note.updatedAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    );
  }
}
