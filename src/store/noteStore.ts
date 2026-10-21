import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Note } from '../types';

interface NoteState {
  notes: Note[];
  activeNoteId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  searchQuery: string;
  selectedProjectId: string | 'all';

  // Actions
  fetchNotes: () => Promise<void>;
  selectNote: (id: string | null) => void;
  createNote: (initial?: Partial<Pick<Note, 'title' | 'content' | 'projectId' | 'projectTag' | 'tags'>>) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'projectId' | 'projectTag' | 'tags' | 'isPinned' | 'isArchived'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedProjectId: (projectId: string | 'all') => void;
}

function mapDbNote(row: any): Note {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title ?? 'Untitled',
    content: row.content ?? '',
    projectId: row.project_id ?? null,
    projectTag: row.project_tag ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isPinned: Boolean(row.is_pinned),
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  isLoading: false,
  isSaving: false,
  lastSavedAt: null,
  searchQuery: '',
  selectedProjectId: 'all',

  fetchNotes: async () => {
    set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ notes: [], isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(mapDbNote);
      set((state) => {
        // If current activeNoteId doesn't exist anymore or isn't set, select the first note if available
        let newActiveId = state.activeNoteId;
        if (!newActiveId && mapped.length > 0) {
          newActiveId = mapped[0].id;
        } else if (newActiveId && !mapped.some((n) => n.id === newActiveId)) {
          newActiveId = mapped[0]?.id || null;
        }
        return { notes: mapped, activeNoteId: newActiveId, isLoading: false };
      });
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      set({ isLoading: false });
    }
  },

  selectNote: (id: string | null) => {
    set({ activeNoteId: id });
  },

  createNote: async (initial = {}) => {
    set({ isSaving: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const now = new Date().toISOString();
      const insertPayload = {
        user_id: user.id,
        title: initial.title?.trim() || 'Untitled Note',
        content: initial.content ?? '',
        project_id: initial.projectId || null,
        project_tag: initial.projectTag || null,
        tags: initial.tags || [],
        is_pinned: false,
        is_archived: false,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('notes')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      const created = mapDbNote(data);
      set((state) => ({
        notes: [created, ...state.notes],
        activeNoteId: created.id,
        isSaving: false,
        lastSavedAt: new Date(),
      }));

      return created;
    } catch (err) {
      set({ isSaving: false });
      throw err;
    }
  },

  updateNote: async (id: string, updates) => {
    set({ isSaving: true });
    try {
      const now = new Date().toISOString();
      const dbUpdates: any = { updated_at: now };

      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.content !== undefined) dbUpdates.content = updates.content;
      if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
      if (updates.projectTag !== undefined) dbUpdates.project_tag = updates.projectTag;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.isPinned !== undefined) dbUpdates.is_pinned = updates.isPinned;
      if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;

      // Optimistic update locally
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, ...updates, updatedAt: now } : n
        ),
      }));

      const { error } = await supabase
        .from('notes')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      set({ isSaving: false, lastSavedAt: new Date() });
    } catch (err) {
      console.error('Failed to update note:', err);
      set({ isSaving: false });
      throw err;
    }
  },

  deleteNote: async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => {
        const remaining = state.notes.filter((n) => n.id !== id);
        let nextActive = state.activeNoteId;
        if (state.activeNoteId === id) {
          nextActive = remaining[0]?.id || null;
        }
        return { notes: remaining, activeNoteId: nextActive };
      });
    } catch (err) {
      console.error('Failed to delete note:', err);
      throw err;
    }
  },

  togglePin: async (id: string) => {
    const currentNote = get().notes.find((n) => n.id === id);
    if (!currentNote) return;
    const newPinned = !currentNote.isPinned;
    await get().updateNote(id, { isPinned: newPinned });
    // Re-sort: pinned on top, then updated_at desc
    set((state) => ({
      notes: [...state.notes].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    }));
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setSelectedProjectId: (projectId: string | 'all') => {
    set({ selectedProjectId: projectId });
  },
}));
