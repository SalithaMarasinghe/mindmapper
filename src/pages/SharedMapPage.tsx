import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { supabase } from '../lib/supabase';
import type { MindmapMeta, MindmapNode, NodeContent } from '../types';
import { DEFAULT_BRANCH_COLORS } from '../types';
import { buildFlowElements } from '../utils/treeLayout';

import { RootNode } from '../components/mindmap/RootNode';
import { BranchNode } from '../components/mindmap/BranchNode';
import { LeafNode } from '../components/mindmap/LeafNode';
import { QuickPreviewModal } from '../components/mindmap/QuickPreviewModal';

const nodeTypes = { root: RootNode, branch: BranchNode, leaf: LeafNode };

export function SharedMapPage() {
  const { token } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [mapMeta, setMapMeta] = useState<MindmapMeta | null>(null);
  const [ownerName, setOwnerName] = useState('Someone');
  const [nodes, setNodes] = useState<MindmapNode[]>([]);
  const [previewNode, setPreviewNode] = useState<MindmapNode | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [contentCache, setContentCache] = useState<Record<string, NodeContent>>({});

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      
      const { data: map, error: mapErr } = await supabase
        .from('mindmaps')
        .select('*')
        .eq('share_token', token)
        .single();
        
      if (mapErr || !map) {
        setError(true);
        setIsLoading(false);
        return;
      }
      
      const parsedMap: MindmapMeta = {
        id: map.id,
        userId: map.user_id,
        title: map.title,
        description: map.description || '',
        emoji: map.emoji,
        color: map.color,
        tags: map.tags || [],
        isPublic: map.is_public,
        shareToken: map.share_token,
        nodeCount: map.node_count || 0,
        completedCount: map.completed_count || 0,
        createdAt: map.created_at,
        updatedAt: map.updated_at
      };
      
      setMapMeta(parsedMap);

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', map.user_id)
        .maybeSingle();
      setOwnerName(profile?.display_name || 'Someone');

      const { data: nodesData } = await supabase
        .from('nodes')
        .select('*')
        .eq('map_id', map.id);

      if (nodesData) {
        const pNodes: MindmapNode[] = nodesData.map(n => ({
          id: n.id,
          mapId: n.map_id,
          label: n.label,
          parentId: n.parent_id,
          type: n.type,
          direction: n.direction,
          order: n.order_index,
          color: n.color || DEFAULT_BRANCH_COLORS[0],
          bgColor: n.bg_color || '#ffffff',
          emoji: n.emoji,
          position: n.position_x !== null ? { x: n.position_x, y: n.position_y } : undefined,
        }));
        setNodes(pNodes);
      }
      setIsLoading(false);
    }
    loadData();
  }, [token]);

  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => buildFlowElements(nodes), [nodes]);

  const readOnlyNodes = useMemo(() => flowNodes.map(n => ({
    ...n,
    data: {
      ...n.data,
      readOnly: true,
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); },
      onPreview: (node: MindmapNode) => {
        setPreviewNode(node);
        if (contentCache[node.id]) return;
        setPreviewLoading(true);
        supabase.from('node_content').select('*').eq('node_id', node.id).maybeSingle().then(({ data }) => {
          const parsed: NodeContent = {
            nodeId: node.id,
            mapId: node.mapId,
            richContent: data?.rich_content || [],
            definition: data?.definition || '',
            keyPoints: data?.key_points || [],
            mentalModel: data?.mental_model || '',
            goodExample: data?.good_example || '',
            badExample: data?.bad_example || '',
            notes: data?.notes || '',
            resources: data?.resources || [],
            isCompleted: data?.is_completed || false,
            completedAt: data?.completed_at || null,
            lastEdited: data?.last_edited || null,
            createdAt: data?.created_at || new Date().toISOString(),
          };
          setContentCache((prev) => ({ ...prev, [node.id]: parsed }));
        }).finally(() => setPreviewLoading(false));
      },
    }
  })), [flowNodes, contentCache]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-teal-500 animate-spin" /></div>;
  }

  if (error || !mapMeta) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">This link is no longer valid or has been removed.</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f8fafc]">
      <div className="bg-teal-700 text-white text-center py-2.5 text-sm font-bold shadow-sm z-50 px-4">
        👁 Viewing {mapMeta.title} — shared by {ownerName}
      </div>

      <main className="flex-1 relative">
        <ReactFlow
          nodes={readOnlyNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
        >
          <Background color="#ccd4e0" gap={16} size={2} />
          <Controls className="mb-4 ml-4" showInteractive={false} />
          <MiniMap 
            nodeColor={(n) => {
              if (n.type === 'root') return '#0f766e';
              if (n.type === 'branch') return (n.data?.node as MindmapNode)?.color || '#94a3b8';
              return '#f1f5f9';
            }}
            maskColor="rgba(248, 250, 252, 0.7)"
            className="rounded-lg shadow-sm border border-gray-200 mb-4 mr-4 bg-white/50"
          />
        </ReactFlow>
      </main>

      {previewNode && (
        <QuickPreviewModal
          node={previewNode}
          breadcrumb={(() => {
            const byId = new Map(nodes.map((n) => [n.id, n]));
            const chain: string[] = [];
            let current: MindmapNode | undefined = previewNode;
            while (current) {
              chain.unshift(current.label);
              current = current.parentId ? byId.get(current.parentId) : undefined;
            }
            return chain;
          })()}
          content={contentCache[previewNode.id] || null}
          isLoading={previewLoading}
          onClose={() => setPreviewNode(null)}
          showOpenButton={false}
        />
      )}
    </div>
  );
}
