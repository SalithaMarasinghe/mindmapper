import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { NodeContent, Resource } from '../types';
import { useMapsStore } from './mapsStore';
import { useAuthStore } from './authStore';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed';

interface ContentState {
  mapId: string | null;
  content: Record<string, NodeContent>;
  saveStatus: Record<string, SaveStatus>;
  isLoading: boolean;
  loadContent: (mapId: string) => Promise<void>;
  fetchNodeContent: (nodeId: string, mapId: string) => Promise<NodeContent>;
  getOrCreateContent: (nodeId: string, mapId: string) => Promise<NodeContent>;
  updateContent: (nodeId: string, updates: Partial<NodeContent>) => void;
  markComplete: (nodeId: string) => Promise<void>;
  markIncomplete: (nodeId: string) => Promise<void>;
  addKeyPoint: (nodeId: string, text: string, index?: number) => void;
  removeKeyPoint: (nodeId: string, pointId: string) => void;
  updateKeyPoint: (nodeId: string, pointId: string, text: string) => void;
  addResource: (nodeId: string, resource: Resource) => void;
  removeResource: (nodeId: string, resourceId: string) => void;
  retrySave: (nodeId: string) => void;
}

const emptyContent = (nodeId: string, mapId: string): NodeContent => ({
  nodeId,
  mapId,
  richContent: [],
  definition: '',
  keyPoints: [],
  mentalModel: '',
  goodExample: '',
  badExample: '',
  notes: '',
  resources: [],
  isCompleted: false,
  completedAt: null,
  lastEdited: new Date().toISOString(),
  createdAt: new Date().toISOString()
});

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useContentStore = create<ContentState>((set, get) => ({
  mapId: null,
  content: {},
  saveStatus: {},
  isLoading: false,

  loadContent: async (mapId) => {
    set({ mapId, isLoading: true });
    try {
      const { data, error } = await supabase.from('node_content').select('*').eq('map_id', mapId);
      if (error && error.code !== '42P01') throw error;
      
      const record: Record<string, NodeContent> = {};
      const status: Record<string, SaveStatus> = {};
      
      if (data) {
        data.forEach((row: {
          node_id: string;
          map_id: string;
          rich_content: unknown[] | null;
          definition: string | null;
          key_points: NodeContent['keyPoints'] | null;
          mental_model: string | null;
          good_example: string | null;
          bad_example: string | null;
          notes: string | null;
          resources: Resource[] | null;
          is_completed: boolean | null;
          completed_at: string | null;
          last_edited: string | null;
          created_at: string;
        }) => {
          record[row.node_id] = {
            nodeId: row.node_id,
            mapId: row.map_id,
            richContent: row.rich_content || [],
            definition: row.definition || '',
            keyPoints: row.key_points || [],
            mentalModel: row.mental_model || '',
            goodExample: row.good_example || '',
            badExample: row.bad_example || '',
            notes: row.notes || '',
            resources: row.resources || [],
            isCompleted: row.is_completed || false,
            completedAt: row.completed_at,
            lastEdited: row.last_edited,
            createdAt: row.created_at
          };
          status[row.node_id] = 'saved';
        });
      }
      set({ content: record, saveStatus: status, isLoading: false });
    } catch(err) {
      console.error('Failed to load content', err);
      set({ isLoading: false });
    }
  },

  fetchNodeContent: async (nodeId, mapId) => {
    const existing = get().content[nodeId];
    if (existing) return existing;

    try {
      const { data, error } = await supabase
        .from('node_content')
        .select('*')
        .eq('node_id', nodeId)
        .maybeSingle();

      if (error && error.code !== '42P01') throw error;

      if (!data) {
        const fresh = emptyContent(nodeId, mapId);
        set((state) => ({
          content: { ...state.content, [nodeId]: fresh },
          saveStatus: { ...state.saveStatus, [nodeId]: 'saved' },
        }));
        return fresh;
      }

      const mapped: NodeContent = {
        nodeId: data.node_id,
        mapId: data.map_id,
        richContent: data.rich_content || [],
        definition: data.definition || '',
        keyPoints: data.key_points || [],
        mentalModel: data.mental_model || '',
        goodExample: data.good_example || '',
        badExample: data.bad_example || '',
        notes: data.notes || '',
        resources: data.resources || [],
        isCompleted: data.is_completed || false,
        completedAt: data.completed_at,
        lastEdited: data.last_edited,
        createdAt: data.created_at,
      };

      set((state) => ({
        content: { ...state.content, [nodeId]: mapped },
        saveStatus: { ...state.saveStatus, [nodeId]: 'saved' },
      }));

      return mapped;
    } catch (error) {
      console.error('Failed to fetch node content', error);
      const fresh = emptyContent(nodeId, mapId);
      set((state) => ({
        content: { ...state.content, [nodeId]: fresh },
        saveStatus: { ...state.saveStatus, [nodeId]: 'saved' },
      }));
      return fresh;
    }
  },

  getOrCreateContent: async (nodeId, mapId) => {
    const existing = get().content[nodeId];
    if (existing) return existing;

    const newRec = emptyContent(nodeId, mapId);
    set(state => ({ 
      content: { ...state.content, [nodeId]: newRec },
      saveStatus: { ...state.saveStatus, [nodeId]: 'saved' }
    }));

    const { user } = useAuthStore.getState();
    if (!user) return newRec;

    const insertPayload = { 
      node_id: nodeId, 
      map_id: mapId,
      user_id: user.id
    };
    supabase.from('node_content').insert(insertPayload).then(({ error }) => {
      if(error && error.code !== '23505' && error.code !== '42P01') console.error('Error creating content:', error);
    });
    
    return newRec;
  },

  updateContent: (nodeId, updates) => {
    set(state => {
      const curr = state.content[nodeId] || emptyContent(nodeId, state.mapId || '');
      return {
        content: { ...state.content, [nodeId]: { ...curr, ...updates, lastEdited: new Date().toISOString() } },
        saveStatus: { ...state.saveStatus, [nodeId]: 'unsaved' }
      };
    });

    const existingTimer = saveTimers.get(nodeId);
    if (existingTimer) clearTimeout(existingTimer);
    
    const timer = setTimeout(async () => {
      const { retrySave } = get();
      retrySave(nodeId);
    }, 500);

    saveTimers.set(nodeId, timer);
  },

  retrySave: async (nodeId) => {
    const curr = get().content[nodeId];
    if (!curr) return;

    set(state => ({ saveStatus: { ...state.saveStatus, [nodeId]: 'saving' } }));
    
    const dbUpdates: {
      last_edited: string;
      rich_content: unknown[];
      definition: string;
      mental_model: string;
      good_example: string;
      bad_example: string;
      notes: string;
      key_points: NodeContent['keyPoints'];
      resources: Resource[];
    } = { 
      last_edited: new Date().toISOString(),
      rich_content: curr.richContent || [],
      definition: curr.definition,
      mental_model: curr.mentalModel,
      good_example: curr.goodExample,
      bad_example: curr.badExample,
      notes: curr.notes,
      key_points: curr.keyPoints,
      resources: curr.resources
    };

    const { error } = await supabase.from('node_content').update(dbUpdates).eq('node_id', nodeId);
    
    if (error && error.code !== '42P01') {
      set(state => ({ saveStatus: { ...state.saveStatus, [nodeId]: 'failed' } }));
      console.error('Save failed', error);
    } else {
      set(state => ({ saveStatus: { ...state.saveStatus, [nodeId]: 'saved' } }));
      saveTimers.delete(nodeId);
    }
  },

  markComplete: async (nodeId) => {
    set(state => {
      const curr = state.content[nodeId];
      if (!curr) return state;
      return { content: { ...state.content, [nodeId]: { ...curr, isCompleted: true, completedAt: new Date().toISOString() } } };
    });
    
    await supabase.from('node_content').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('node_id', nodeId);
    useMapsStore.getState().fetchMaps(); 
  },

  markIncomplete: async (nodeId) => {
    set(state => {
      const curr = state.content[nodeId];
      if (!curr) return state;
      return { content: { ...state.content, [nodeId]: { ...curr, isCompleted: false, completedAt: null } } };
    });
    await supabase.from('node_content').update({ is_completed: false, completed_at: null }).eq('node_id', nodeId);
    useMapsStore.getState().fetchMaps();
  },

  addKeyPoint: (nodeId, text, index) => {
    const curr = get().content[nodeId];
    if (!curr) return;
    const newPoints = [...curr.keyPoints];
    const newPoint = { id: Date.now().toString(), text, order: index ?? curr.keyPoints.length };
    
    if (index !== undefined) {
      newPoints.splice(index, 0, newPoint);
    } else {
      newPoints.push(newPoint);
    }
    
    // Re-order all points to be safe
    newPoints.forEach((p, i) => p.order = i);
    get().updateContent(nodeId, { keyPoints: newPoints });
  },

  removeKeyPoint: (nodeId, pointId) => {
    const curr = get().content[nodeId];
    if (!curr) return;
    const newPoints = curr.keyPoints.filter(p => p.id !== pointId);
    get().updateContent(nodeId, { keyPoints: newPoints });
  },

  updateKeyPoint: (nodeId, pointId, text) => {
    const curr = get().content[nodeId];
    if (!curr) return;
    const newPoints = curr.keyPoints.map(p => p.id === pointId ? { ...p, text } : p);
    get().updateContent(nodeId, { keyPoints: newPoints });
  },

  addResource: (nodeId, resource) => {
    const curr = get().content[nodeId];
    if (!curr) return;
    const newRes = [...curr.resources, resource];
    get().updateContent(nodeId, { resources: newRes });
  },

  removeResource: (nodeId, resourceId) => {
    const curr = get().content[nodeId];
    if (!curr) return;
    const newRes = curr.resources.filter(r => r.id !== resourceId);
    get().updateContent(nodeId, { resources: newRes });
  }
}));
