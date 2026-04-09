import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { MindmapNode, NodeDirection, NodeType } from '../types';
import { useAuthStore } from './authStore';

interface MapState {
  mapId: string | null;
  nodes: MindmapNode[];
  isLoading: boolean;
  loadMap: (mapId: string) => Promise<void>;
  addNode: (
    parentId: string | null,
    label: string,
    type: NodeType,
    color?: string,
    position?: { x: number; y: number },
    direction?: NodeDirection
  ) => Promise<void>;
  updateNode: (nodeId: string, updates: Partial<MindmapNode>) => Promise<void>;
  saveNodePositions: (updates: Array<{ id: string; position: { x: number; y: number }; direction?: NodeDirection }>) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  moveNode: (nodeId: string, newParentId: string | null) => Promise<void>;
}

type DbNodeRow = {
  id: string;
  map_id: string;
  label: string;
  parent_id: string | null;
  type: NodeType;
  order_index: number | null;
  color: string | null;
  bg_color: string | null;
  emoji?: string | null;
  direction?: NodeDirection | null;
  position_x: number | null;
  position_y: number | null;
};

const formatNodes = (data: DbNodeRow[]): MindmapNode[] => data.map((n) => ({
  id: n.id,
  mapId: n.map_id,
  label: n.label,
  parentId: n.parent_id,
  type: n.type,
  direction: n.direction ?? undefined,
  order: n.order_index ?? 0,
  color: n.color ?? '',
  bgColor: n.bg_color ?? '',
  emoji: n.emoji,
  position: n.position_x !== null ? { x: n.position_x, y: n.position_y } : undefined,
}));

export const useMapStore = create<MapState>((set, get) => ({
  mapId: null,
  nodes: [],
  isLoading: false,

  loadMap: async (mapId) => {
    set({ mapId, isLoading: true });
    
    try {
      const { data, error } = await supabase
        .from('nodes')
        .select('*')
        .eq('map_id', mapId);

      if (error && error.code !== '42P01') { 
        console.error('Error fetching nodes:', error);
      }

      if (!data) {
        set({ nodes: [] });
        return;
      }

      if (data.length === 0) {
        const { data: mapRow, error: mapError } = await supabase
          .from('mindmaps')
          .select('title,user_id')
          .eq('id', mapId)
          .single();

        if (mapError) {
          console.error('Error fetching map for root node creation:', mapError);
          set({ nodes: [] });
          return;
        }

        const { user } = useAuthStore.getState();
        const ownerId = mapRow?.user_id || user?.id;

        if (!ownerId) {
          set({ nodes: [] });
          return;
        }

        const { error: insertError } = await supabase.from('nodes').insert({
          map_id: mapId,
          user_id: ownerId,
          label: mapRow?.title || 'Main Idea',
          type: 'root',
          parent_id: null,
          order_index: 0,
          color: '#0f766e',
          bg_color: '',
        });

        if (insertError && insertError.code !== '42P01') {
          console.error('Error creating root node:', insertError);
          set({ nodes: [] });
          return;
        }

        const { data: refreshedNodes, error: refreshError } = await supabase
          .from('nodes')
          .select('*')
          .eq('map_id', mapId);

        if (refreshError && refreshError.code !== '42P01') {
          console.error('Error re-fetching nodes after root creation:', refreshError);
          set({ nodes: [] });
          return;
        }

        set({ nodes: formatNodes(refreshedNodes || []) });
        return;
      }

      set({ nodes: formatNodes(data) });
    } catch (e) {
      console.error('Failed to load map nodes:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  addNode: async (parentId, label, type, color = '#333333', position, direction) => {
    const { mapId } = get();
    if (!mapId) return;
    
    const { user } = useAuthStore.getState();
    if (!user) return;
    
    const newNode = {
      map_id: mapId,
      user_id: user.id,
      parent_id: parentId,
      label,
      type,
      color,
      bg_color: '',
      order_index: 0,
      position_x: position?.x ?? null,
      position_y: position?.y ?? null,
      direction: direction ?? null,
    };

    const { error } = await supabase.from('nodes').insert(newNode);

    if (error) {
      // Backward compatibility for schemas that don't yet have direction column.
      if (error.code === '42703' || error.message.toLowerCase().includes('direction')) {
        const fallbackNode = {
          map_id: mapId,
          user_id: user.id,
          parent_id: parentId,
          label,
          type,
          color,
          bg_color: '',
          order_index: 0,
          position_x: position?.x ?? null,
          position_y: position?.y ?? null,
        };

        const { error: fallbackError } = await supabase.from('nodes').insert(fallbackNode);
        if (fallbackError) {
          console.error('Failed to add node (fallback):', fallbackError);
          throw fallbackError;
        }
      } else {
        console.error('Failed to add node:', error);
        throw error;
      }
    }

    await get().loadMap(mapId);
  },

  updateNode: async (nodeId, updates) => {
    const { mapId } = get();
    if (!mapId) return;

    const dbUpdates: Partial<Record<'label' | 'color' | 'bg_color' | 'emoji', string | null> & {
      position_x: number | null;
      position_y: number | null;
    }> = {};
    if (updates.label !== undefined) dbUpdates.label = updates.label;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.bgColor !== undefined) dbUpdates.bg_color = updates.bgColor;
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if (updates.position !== undefined) {
      dbUpdates.position_x = updates.position.x;
      dbUpdates.position_y = updates.position.y;
    }
    
    const { error } = await supabase.from('nodes').update(dbUpdates).eq('id', nodeId);
    if (error) {
      console.error('Failed to update node:', error);
      throw error;
    }

    if (updates.direction) {
      const { error: directionError } = await supabase
        .from('nodes')
        .update({ direction: updates.direction })
        .eq('id', nodeId);

      if (directionError) {
        const message = directionError.message.toLowerCase();
        const missingDirectionColumn = directionError.code === '42703' || message.includes('direction');
        if (!missingDirectionColumn) {
          console.error('Failed to update node direction:', directionError);
          throw directionError;
        }
      }
    }

    await get().loadMap(mapId);
  },

  saveNodePositions: async (updates) => {
    const { mapId } = get();
    if (!mapId || updates.length === 0) return;

    await Promise.all(
      updates.map(async (item) => {
        const { error } = await supabase
          .from('nodes')
          .update({
            position_x: item.position.x,
            position_y: item.position.y,
          })
          .eq('id', item.id);

        if (error) {
          console.error('Failed to save node position:', error);
          return;
        }

        if (item.direction) {
          const { error: directionError } = await supabase
            .from('nodes')
            .update({ direction: item.direction })
            .eq('id', item.id);

          if (directionError) {
            const message = directionError.message.toLowerCase();
            const missingDirectionColumn = directionError.code === '42703' || message.includes('direction');
            if (!missingDirectionColumn) {
              console.error('Failed to save node direction:', directionError);
            }
          }
        }
      })
    );

    await get().loadMap(mapId);
  },

  deleteNode: async (nodeId) => {
    const { mapId } = get();
    if (!mapId) return;
    
    // Check if it's a branch and delete its leaf children first
    const { data: children } = await supabase
      .from('nodes')
      .select('id')
      .eq('parent_id', nodeId);
      
    if (children && children.length > 0) {
      const childIds = children.map(c => c.id);
      await supabase.from('nodes').delete().in('id', childIds);
    }

    const { error } = await supabase.from('nodes').delete().eq('id', nodeId);
    if (!error) {
      await get().loadMap(mapId);
    }
  },

  moveNode: async (nodeId, newParentId) => {
    const { mapId } = get();
    if (!mapId) return;
    
    const { error } = await supabase.from('nodes').update({ parent_id: newParentId }).eq('id', nodeId);
    if (!error) {
      await get().loadMap(mapId);
    }
  }
}));
