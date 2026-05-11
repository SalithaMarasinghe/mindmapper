import { create } from 'zustand';
import { offlineStore } from '../lib/offlineStore';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface OfflineState {
  offlineMapIds: string[];
  isSyncing: boolean;
  init: () => Promise<void>;
  toggleOffline: (mapId: string) => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  offlineMapIds: [],
  isSyncing: false,

  init: async () => {
    const ids = await offlineStore.getOfflineMaps();
    set({ offlineMapIds: ids });
  },

  toggleOffline: async (mapId: string) => {
    const { offlineMapIds } = get();
    const isOffline = offlineMapIds.includes(mapId);

    if (isOffline) {
      await offlineStore.removeMapOffline(mapId);
      set({ offlineMapIds: offlineMapIds.filter(id => id !== mapId) });
      toast.success('Removed from offline access');
    } else {
      set({ isSyncing: true });
      try {
        // Fetch everything from Supabase
        const { data: mapMeta } = await supabase.from('mindmaps').select('*').eq('id', mapId).single();
        const { data: nodes } = await supabase.from('nodes').select('*').eq('map_id', mapId);
        const { data: contentRows } = await supabase.from('node_content').select('*').eq('map_id', mapId);

        if (!mapMeta || !nodes) throw new Error('Failed to fetch map data');

        const formattedMeta = {
          id: mapMeta.id,
          userId: mapMeta.user_id,
          title: mapMeta.title,
          description: mapMeta.description,
          emoji: mapMeta.emoji,
          color: mapMeta.color,
          tags: mapMeta.tags || [],
          isPublic: mapMeta.is_public || false,
          shareToken: mapMeta.share_token,
          nodeCount: mapMeta.node_count || 0,
          completedCount: mapMeta.completed_count || 0,
          createdAt: mapMeta.created_at,
          updatedAt: mapMeta.updated_at,
        };

        const formattedNodes = nodes.map(n => ({
          id: n.id,
          mapId: n.map_id,
          label: n.label,
          parentId: n.parent_id,
          type: n.type,
          order: n.order_index,
          color: n.color,
          bgColor: n.bg_color,
          emoji: n.emoji,
          position: n.position_x ? { x: n.position_x, y: n.position_y } : undefined
        }));

        const contentMap: Record<string, any> = {};
        if (contentRows) {
          for (const c of contentRows) {
            contentMap[c.node_id] = {
              nodeId: c.node_id,
              mapId: c.map_id,
              definition: c.definition,
              keyPoints: c.key_points,
              mentalModel: c.mental_model,
              goodExample: c.good_example,
              badExample: c.bad_example,
              notes: c.notes,
              resources: c.resources,
              isCompleted: c.is_completed,
              completedAt: c.completed_at,
              lastEdited: c.last_edited,
              createdAt: c.created_at
            };
          }
        }

        await offlineStore.saveMapOffline(formattedMeta, formattedNodes, contentMap);
        set({ offlineMapIds: [...offlineMapIds, mapId] });
        toast.success('Available offline');
      } catch (e) {
        console.error(e);
        toast.error('Failed to save offline');
      } finally {
        set({ isSyncing: false });
      }
    }
  }
}));

// Initialize store
useOfflineStore.getState().init();
