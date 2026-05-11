import { get, set, del } from 'idb-keyval';
import type { MindmapMeta, MindmapNode, NodeContent } from '../types';

const OFFLINE_MAPS_KEY = 'offline_maps';

export const offlineStore = {
  // Get list of map IDs that are available offline
  getOfflineMaps: async (): Promise<string[]> => {
    return (await get<string[]>(OFFLINE_MAPS_KEY)) || [];
  },

  // Check if a map is available offline
  isMapOffline: async (mapId: string): Promise<boolean> => {
    const maps = await offlineStore.getOfflineMaps();
    return maps.includes(mapId);
  },

  // Save map metadata, nodes, and content for offline use
  saveMapOffline: async (
    mapMeta: MindmapMeta, 
    nodes: MindmapNode[], 
    content: Record<string, NodeContent>
  ) => {
    // Save map components
    await set(`map_meta_${mapMeta.id}`, mapMeta);
    await set(`map_nodes_${mapMeta.id}`, nodes);
    await set(`map_content_${mapMeta.id}`, content);

    // Update list of offline maps
    const offlineMaps = await offlineStore.getOfflineMaps();
    if (!offlineMaps.includes(mapMeta.id)) {
      offlineMaps.push(mapMeta.id);
      await set(OFFLINE_MAPS_KEY, offlineMaps);
    }
  },

  // Remove a map from offline storage
  removeMapOffline: async (mapId: string) => {
    await del(`map_meta_${mapId}`);
    await del(`map_nodes_${mapId}`);
    await del(`map_content_${mapId}`);

    const offlineMaps = await offlineStore.getOfflineMaps();
    const updatedMaps = offlineMaps.filter(id => id !== mapId);
    await set(OFFLINE_MAPS_KEY, updatedMaps);
  },

  // Retrieve map metadata
  getMapMeta: async (mapId: string): Promise<MindmapMeta | undefined> => {
    return await get<MindmapMeta>(`map_meta_${mapId}`);
  },

  // Retrieve map nodes
  getMapNodes: async (mapId: string): Promise<MindmapNode[] | undefined> => {
    return await get<MindmapNode[]>(`map_nodes_${mapId}`);
  },

  // Retrieve map content
  getMapContent: async (mapId: string): Promise<Record<string, NodeContent> | undefined> => {
    return await get<Record<string, NodeContent>>(`map_content_${mapId}`);
  }
};
