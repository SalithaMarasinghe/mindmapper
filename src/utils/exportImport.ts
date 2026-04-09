import { supabase } from '../lib/supabase';
import { nanoid } from 'nanoid';
import type { MindmapMeta, NodeContent, ExportedMap } from '../types';

export const exportSingleMap = async (mapId: string, mapTitle: string = 'map'): Promise<void> => {
  const { data: meta } = await supabase.from('mindmaps').select('*').eq('id', mapId).single();
  if (!meta) throw new Error('Map metadata not found.');

  const { data: nodes } = await supabase.from('nodes').select('*').eq('map_id', mapId);
  const { data: contentRows } = await supabase.from('node_content').select('*').eq('map_id', mapId);

  const formattedMeta: MindmapMeta = {
    id: meta.id,
    userId: meta.user_id,
    title: meta.title,
    description: meta.description || '',
    emoji: meta.emoji,
    color: meta.color,
    tags: meta.tags || [],
    isPublic: meta.is_public,
    shareToken: meta.share_token,
    nodeCount: meta.node_count || 0,
    completedCount: meta.completed_count || 0,
    createdAt: meta.created_at,
    updatedAt: meta.updated_at
  };

  const formattedNodes = (nodes || []).map(n => ({
    id: n.id,
    mapId: n.map_id,
    label: n.label,
    parentId: n.parent_id,
    type: n.type,
    order: n.order_index,
    color: n.color || '#94a3b8',
    bgColor: n.bg_color || '#ffffff',
    emoji: n.emoji,
    position: n.position_x ? { x: n.position_x, y: n.position_y } : undefined
  }));

  const contentMap: Record<string, NodeContent> = {};
  if (contentRows) {
    for (const c of contentRows) {
      contentMap[c.node_id] = {
        nodeId: c.node_id,
        mapId: c.map_id,
        definition: c.definition || '',
        keyPoints: c.key_points || [],
        mentalModel: c.mental_model || '',
        goodExample: c.good_example || '',
        badExample: c.bad_example || '',
        notes: c.notes || '',
        resources: c.resources || [],
        isCompleted: c.is_completed || false,
        completedAt: c.completed_at,
        lastEdited: c.last_edited,
        createdAt: c.created_at
      };
    }
  }

  const exportData: ExportedMap = {
    exportVersion: '2.0.0',
    exportedAt: new Date().toISOString(),
    meta: formattedMeta,
    nodes: formattedNodes,
    content: contentMap
  };

  const safeTitle = mapTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  downloadJsonBlob(exportData, `${safeTitle}-${getDatestamp()}.json`);
};

export const exportAllMaps = async (): Promise<void> => {
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) throw new Error('Authentication required for global export.');
  
  const userId = userResp.user.id;
  const { data: maps } = await supabase.from('mindmaps').select('*').eq('user_id', userId);
  if (!maps) throw new Error('Could not retrieve mindmaps.');

  const mappedExports: ExportedMap[] = [];

  for (const m of maps) {
    const { data: nodes } = await supabase.from('nodes').select('*').eq('map_id', m.id);
    const { data: contentRows } = await supabase.from('node_content').select('*').eq('map_id', m.id);
    
    const formattedMeta: MindmapMeta = {
      id: m.id,
      userId: m.user_id,
      title: m.title,
      description: m.description || '',
      emoji: m.emoji,
      color: m.color,
      tags: m.tags || [],
      isPublic: m.is_public,
      shareToken: m.share_token,
      nodeCount: m.node_count || 0,
      completedCount: m.completed_count || 0,
      createdAt: m.created_at,
      updatedAt: m.updated_at
    };

    const formattedNodes = (nodes || []).map(n => ({
      id: n.id,
      mapId: n.map_id,
      label: n.label,
      parentId: n.parent_id,
      type: n.type,
      order: n.order_index,
      color: n.color || '#94a3b8',
      bgColor: n.bg_color || '#ffffff',
      emoji: n.emoji,
      position: n.position_x ? { x: n.position_x, y: n.position_y } : undefined
    }));

    const contentMap: Record<string, NodeContent> = {};
    if (contentRows) {
      for (const c of contentRows) {
        contentMap[c.node_id] = {
          nodeId: c.node_id,
          mapId: c.map_id,
          definition: c.definition || '',
          keyPoints: c.key_points || [],
          mentalModel: c.mental_model || '',
          goodExample: c.good_example || '',
          badExample: c.bad_example || '',
          notes: c.notes || '',
          resources: c.resources || [],
          isCompleted: c.is_completed || false,
          completedAt: c.completed_at,
          lastEdited: c.last_edited,
          createdAt: c.created_at
        };
      }
    }

    mappedExports.push({
      exportVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      meta: formattedMeta,
      nodes: formattedNodes,
      content: contentMap
    });
  }

  const globalBundle = {
    exportVersion: '2.0.0',
    exportedAt: new Date().toISOString(),
    maps: mappedExports
  };

  downloadJsonBlob(globalBundle, `mindmap-backup-${getDatestamp()}.json`);
};

export const importMaps = async (file: File): Promise<{ imported: number, errors: string[] }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        let imports: ExportedMap[] = [];
        if (parsed.exportVersion && parsed.maps && Array.isArray(parsed.maps)) {
           // It's a global backup bundle
           imports = parsed.maps;
        } else if (parsed.exportVersion && parsed.meta && parsed.nodes) {
           // It's a single map
           imports = [parsed as ExportedMap];
        } else {
           throw new Error("Invalid generic JSON structure. Did not match expected schema bounds.");
        }

        const { data: userResp } = await supabase.auth.getUser();
        if (!userResp.user) throw new Error('Authentication required prior to payload injection.');
        const userId = userResp.user.id;

        let finalCount = 0;
        const errors: string[] = [];

        for (const item of imports) {
          const newMapId = nanoid();
          const nodeIDMap: Record<string, string> = {}; // Old nodeId -> New nodeId

          try {
             // 1. Insert Meta
             await supabase.from('mindmaps').insert({
               id: newMapId,
               user_id: userId,
               title: item.meta.title + ' (Imported)',
               description: item.meta.description,
               emoji: item.meta.emoji,
               color: item.meta.color,
               tags: item.meta.tags,
               node_count: item.meta.nodeCount,
               completed_count: item.meta.completedCount,
               is_public: false, // Reset explicitly for safety
               share_token: null
             });

             // 2. Map new logic IDs and reconstruct Parent trees implicitly sequentially
             for (const node of item.nodes) {
               nodeIDMap[node.id] = nanoid();
             }

             const mappedNodes = item.nodes.map(n => ({
               id: nodeIDMap[n.id],
               map_id: newMapId,
               label: n.label,
               parent_id: n.parentId ? nodeIDMap[n.parentId] : null,
               type: n.type,
               order_index: n.order,
               color: n.color,
               bg_color: n.bgColor,
               emoji: n.emoji,
               position_x: n.position?.x,
               position_y: n.position?.y
             }));

             if (mappedNodes.length > 0) {
               await supabase.from('nodes').insert(mappedNodes);
             }

             // 3. Remap payload blocks targeting content stores natively
             const contentArray = Object.values(item.content);
             const mappedContent = contentArray.map(c => ({
               node_id: nodeIDMap[c.nodeId],
               map_id: newMapId,
               definition: c.definition,
               key_points: c.keyPoints,
               mental_model: c.mentalModel,
               good_example: c.goodExample,
               bad_example: c.badExample,
               notes: c.notes,
               resources: c.resources,
               is_completed: c.isCompleted,
               completed_at: c.completedAt
             }));

             if (mappedContent.length > 0) {
               await supabase.from('node_content').insert(mappedContent);
             }

             finalCount++;
          } catch (err: any) {
             console.error('Failed processing map injection:', err);
             errors.push(err.message || 'Unknown processing error inside iter loop.');
          }
        }

        resolve({ imported: finalCount, errors });
      } catch (err: any) {
        resolve({ imported: 0, errors: [err.message || 'File parsing invalid.'] });
      }
    };
    reader.onerror = () => resolve({ imported: 0, errors: ['Failed strictly allocating File reader streams natively.'] });
    reader.readAsText(file);
  });
};

function downloadJsonBlob(data: any, defaultFilename: string) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFilename;
  a.click();
  
  URL.revokeObjectURL(url);
}

function getDatestamp() {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}
