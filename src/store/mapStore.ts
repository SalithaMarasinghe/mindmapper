import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { MindmapNode, NodeDirection, NodeType, Waypoint, EdgeWaypoints } from '../types';
import { useAuthStore } from './authStore';

interface MapState {
  mapId: string | null;
  nodes: MindmapNode[];
  edgeWaypoints: EdgeWaypoints;
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
  updateEdgeWaypoints: (edgeId: string, waypoints: Waypoint[]) => Promise<void>;
  saveEdgeWaypoints: (waypoints: EdgeWaypoints) => Promise<void>;
  saveBatchChanges: (nodeUpdates: any[], edgeWaypoints: EdgeWaypoints) => Promise<void>;
  supportsDirection: boolean;
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
  emoji: n.emoji ?? undefined,
  position: (n.position_x !== null && n.position_y !== null) ? { x: n.position_x, y: n.position_y } : undefined,
}));

export const useMapStore = create<MapState>((set, get) => ({
  mapId: null,
  nodes: [],
  edgeWaypoints: {},
  isLoading: false,
  supportsDirection: true,

  loadMap: async (mapId) => {
    set({ mapId, isLoading: true });
    
    try {
      // Fetch nodes
      const { data: nodesData, error: nodesError } = await supabase
        .from('nodes')
        .select('*')
        .eq('map_id', mapId);

      // Fetch waypoints from mindmaps table
      const { data: mapData } = await supabase
        .from('mindmaps')
        .select('edge_waypoints')
        .eq('id', mapId)
        .single();

      if (nodesError && nodesError.code !== '42P01') { 
        console.error('Error fetching nodes:', nodesError);
      }

      const waypoints = mapData?.edge_waypoints as EdgeWaypoints || {};
      set({ edgeWaypoints: waypoints });

      if (!nodesData || nodesData.length === 0) {
        // ... (existing root node creation logic)
        const { data: mapRow, error: mapMetaError } = await supabase
          .from('mindmaps')
          .select('title,user_id')
          .eq('id', mapId)
          .single();

        if (mapMetaError) {
          console.error('Error fetching map for root node creation:', mapMetaError);
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

      set({ nodes: formatNodes(nodesData) });
    } catch (e) {
      console.error('Failed to load map nodes:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  addNode: async (parentId, label, type, color = '#333333', position, direction) => {
    // ... (existing addNode logic)
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
        set({ supportsDirection: false });
      } else {
        console.error('Failed to add node:', error);
        throw error;
      }
    }

    await get().loadMap(mapId);
  },

  updateNode: async (nodeId, updates) => {
    // ... (existing updateNode logic)
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
    const { mapId, supportsDirection } = get();
    if (!mapId || updates.length === 0) return;

    await Promise.all(
      updates.map(async (item) => {
        const payload: any = {
          position_x: item.position.x,
          position_y: item.position.y,
        };
        
        // Only include direction if we think the server supports it
        if (supportsDirection && item.direction) {
          payload.direction = item.direction;
        }

        const { error } = await supabase
          .from('nodes')
          .update(payload)
          .eq('id', item.id);

        if (error) {
          const message = error.message.toLowerCase();
          const missingCol = error.code === '42703' || message.includes('direction') || error.code === 'PGRST204';
          
          if (missingCol && supportsDirection) {
            set({ supportsDirection: false });
            // Retry without direction
            delete payload.direction;
            await supabase.from('nodes').update(payload).eq('id', item.id);
          } else {
            console.error('Failed to save node position:', error);
          }
        }
      })
    );

    // Only fetch nodes again, not the full map to avoid expensive waypoint fetches
    const { data: refreshedNodes, error: refreshError } = await supabase
      .from('nodes')
      .select('*')
      .eq('map_id', mapId);
    if (!refreshError) {
      set({ nodes: formatNodes(refreshedNodes || []) });
    }
  },

  deleteNode: async (nodeId) => {
    // ... (existing deleteNode logic)
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
      
      // Cleanup associated waypoints for deleted children
      const { edgeWaypoints } = get();
      const newWaypoints = { ...edgeWaypoints };
      let changed = false;
      Object.keys(newWaypoints).forEach(key => {
        if (childIds.some(id => key.includes(id)) || key.includes(nodeId)) {
          delete newWaypoints[key];
          changed = true;
        }
      });
      if (changed) {
        await supabase.from('mindmaps').update({ edge_waypoints: newWaypoints }).eq('id', mapId);
        set({ edgeWaypoints: newWaypoints });
      }
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
  },

  updateEdgeWaypoints: async (edgeId, waypoints) => {
    const { mapId, edgeWaypoints } = get();
    if (!mapId) return;

    const newWaypoints = {
      ...edgeWaypoints,
      [edgeId]: waypoints,
    };

    const { error } = await supabase
      .from('mindmaps')
      .update({ edge_waypoints: newWaypoints })
      .eq('id', mapId);

    if (error) {
      console.error('Failed to update edge waypoints:', error);
      throw error;
    }

    set({ edgeWaypoints: newWaypoints });
  },

  saveEdgeWaypoints: async (edgeWaypoints) => {
    const { mapId } = get();
    if (!mapId) return;

    const { error } = await supabase
      .from('mindmaps')
      .update({ edge_waypoints: edgeWaypoints })
      .eq('id', mapId);

    if (error) {
      console.error('Failed to save batch edge waypoints:', error);
      throw error;
    }

    set({ edgeWaypoints });
  },

  saveBatchChanges: async (nodeUpdates, newEdgeWaypoints) => {
    const { mapId, nodes, supportsDirection } = get();
    if (!mapId) return;

    // Optimistic Update: Update state immediately to prevent flicker
    const optimisticNodes = nodes.map(n => {
      const update = nodeUpdates.find(u => u.id === n.id);
      if (update) {
        return {
          ...n,
          position: update.position,
          direction: update.direction || n.direction
        };
      }
      return n;
    });

    set({ nodes: optimisticNodes, edgeWaypoints: newEdgeWaypoints });

    // Persist to Supabase in background
    try {
      const nodePromises = nodeUpdates.map(async (item) => {
        const updateObj: any = {
          position_x: item.position.x,
          position_y: item.position.y
        };
        if (supportsDirection && item.direction) {
          updateObj.direction = item.direction;
        }
        
        const { error } = await supabase.from('nodes').update(updateObj).eq('id', item.id);
        if (error) {
          const message = error.message.toLowerCase();
          const isMissingCol = error.code === '42703' || message.includes('direction') || error.code === 'PGRST204';
          
          if (isMissingCol && supportsDirection) {
            set({ supportsDirection: false });
            delete updateObj.direction;
            return supabase.from('nodes').update(updateObj).eq('id', item.id);
          }
          throw error;
        }
      });

      const waypointPromise = supabase
        .from('mindmaps')
        .update({ edge_waypoints: newEdgeWaypoints })
        .eq('id', mapId);

      const combinedResults = await Promise.allSettled([...nodePromises, waypointPromise]);
      const failures = combinedResults.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        console.error('Batch save partial failures:', failures);
      }
      
      // Finally, re-fetch once to ensure ground truth
      const { data: refreshedNodes } = await supabase
        .from('nodes')
        .select('*')
        .eq('map_id', mapId);
      
      if (refreshedNodes) {
        set({ nodes: formatNodes(refreshedNodes) });
      }
    } catch (err) {
      console.error('Batch save failed:', err);
      // Fallback: reload fully if something went wrong
      get().loadMap(mapId);
    }
  }
}));

