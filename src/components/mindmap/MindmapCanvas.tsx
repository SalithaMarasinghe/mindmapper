import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Link2Off, Share2, FileDown, Loader2 } from 'lucide-react';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background, 
  useReactFlow,
  useNodesState,
  type Node,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'react-hot-toast';

import { AppHeader } from '../layout/AppHeader';
import { CanvasToolbar } from './CanvasToolbar';
import { NodeContextMenu } from './NodeContextMenu';
import { QuickPreviewModal } from './QuickPreviewModal';
import { RootNode } from './RootNode';
import { BranchNode } from './BranchNode';
import { LeafNode } from './LeafNode';
import { WaypointEdge } from './WaypointEdge';

import { useMapStore } from '../../store/mapStore';
import { useMapsStore } from '../../store/mapsStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useContentStore } from '../../store/contentStore';
import { supabase } from '../../lib/supabase';
import { nanoid } from 'nanoid';
import { buildFlowElements, computeMindmapLayout, estimateNodeWidth } from '../../utils/treeLayout';
import type { MindmapNode, NodeType, NodeDirection, LayoutPattern } from '../../types';
import { DEFAULT_BRANCH_COLORS } from '../../types';
import { exportMindmapToPDF } from '../../utils/exportPDF';

const nodeTypes = {
  root: RootNode,
  branch: BranchNode,
  leaf: LeafNode
};

const SIDE_GAP_Y = 170;
const STACK_GAP = 70;
const STACK_GAP_HORIZONTAL = 260;

export function MindmapCanvas() {
  const { mapId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { fitView, setViewport } = useReactFlow();
  
  const edgeTypes = useMemo(() => ({
    waypoint: WaypointEdge,
    default: WaypointEdge
  }), []);
  
  const { 
    nodes, 
    loadMap, 
    addNode, 
    updateNode, 
    deleteNode, 
    edgeWaypoints,
    saveBatchChanges 
  } = useMapStore();
  const { getMapById, fetchMaps } = useMapsStore();
  const { getViewport, saveViewport, isReadOnly, getLayoutPattern, setLayoutPattern } = useSettingsStore();
  const { loadContent, content, fetchNodeContent } = useContentStore();

  const activeLayoutPattern = mapId ? getLayoutPattern(mapId) : 'radial';

  const [menuInfo, setMenuInfo] = useState<{ x: number, y: number, node: MindmapNode } | null>(null);
  const [paneMenuInfo, setPaneMenuInfo] = useState<{ x: number; y: number } | null>(null);
  const [previewNode, setPreviewNode] = useState<MindmapNode | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch map meta
  const mapMeta = getMapById(mapId || '');

  useEffect(() => {
    if (!mapId) return;
    if (!mapMeta) fetchMaps();
    loadMap(mapId);
    loadContent(mapId);
  }, [mapId, loadMap, loadContent, fetchMaps, mapMeta]);

  const hasInitViewportRef = useRef(false);
  const shouldFocusRoot = ((location.state as { focusRoot?: boolean } | null)?.focusRoot) === true;
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const lastBaseNodesRef = useRef<string>('');

  useEffect(() => {
    if (!hasInitViewportRef.current && nodes.length > 0 && mapId) {
      if (shouldFocusRoot) {
        setTimeout(() => { fitView({ duration: 500, padding: 0.2 }); }, 50);
        navigate(location.pathname, { replace: true, state: {} });
      } else {
        const saved = getViewport(mapId);
        if (saved) {
          setViewport(saved);
        } else {
          setTimeout(() => { fitView({ duration: 500, padding: 0.2 }); }, 50);
        }
      }
      hasInitViewportRef.current = true;
    }
  }, [nodes.length, mapId, getViewport, setViewport, fitView, shouldFocusRoot, navigate, location.pathname]);

  const onMoveEnd = useCallback((_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    if (mapId) saveViewport(mapId, viewport);
  }, [mapId, saveViewport]);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: MindmapNode) => {
    e.preventDefault();
    if (useSettingsStore.getState().isReadOnly) return;
    setMenuInfo({ x: e.clientX, y: e.clientY, node });
    setPaneMenuInfo(null);
  }, []);

  const { nodes: baseFlowNodes } = useMemo(
    () => buildFlowElements(nodes, edgeWaypoints, undefined, activeLayoutPattern), 
    [nodes, edgeWaypoints, activeLayoutPattern]
  );
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(baseFlowNodes);
  const flowNodePositionMap = useMemo(
    () => new Map(flowNodes.map((n) => [n.id, n.position] as const)),
    [flowNodes]
  );

  const { edges: flowEdges } = useMemo(() => {
    // Calculate dynamic waypoints for real-time smoothness
    const dynamicWaypoints = { ...edgeWaypoints };
    
    // Check for moved nodes compared to store positions
    nodes.forEach(node => {
      const livePos = flowNodePositionMap.get(node.id);
      if (livePos && node.position) {
        const dx = livePos.x - node.position.x;
        const dy = livePos.y - node.position.y;
        
        // If this node moved, all its outgoing and incoming internal edges should shift
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          if (node.parentId) {
            const parentLivePos = flowNodePositionMap.get(node.parentId);
            const parentStorePos = nodes.find(n => n.id === node.parentId)?.position;
            
            if (parentLivePos && parentStorePos) {
              const pdx = parentLivePos.x - parentStorePos.x;
              const pdy = parentLivePos.y - parentStorePos.y;
              
              if (Math.abs(dx - pdx) < 0.1 && Math.abs(dy - pdy) < 0.1) {
                const edgeId = `${node.parentId}-${node.id}`;
                if (dynamicWaypoints[edgeId]) {
                  dynamicWaypoints[edgeId] = dynamicWaypoints[edgeId].map(wp => ({
                    ...wp,
                    x: wp.x + dx,
                    y: wp.y + dy
                  }));
                }
              }
            }
          }
        }
      }
    });

    return buildFlowElements(nodes, dynamicWaypoints, flowNodePositionMap, activeLayoutPattern);
  }, [nodes, edgeWaypoints, flowNodePositionMap, activeLayoutPattern]);

  useEffect(() => {
    if (!baseFlowNodes.length) return;
    
    // De-duplicate updates to prevent loop #185
    const baseStr = JSON.stringify(baseFlowNodes.map(n => ({ id: n.id, type: n.type })));
    if (baseStr === lastBaseNodesRef.current) return;
    lastBaseNodesRef.current = baseStr;

    setFlowNodes((prev) => {
      const prevPos = new Map(prev.map((n) => [n.id, n.position] as const));
      return baseFlowNodes.map((node) => ({
        ...node,
        position: prevPos.get(node.id) || node.position,
        selected: prev.find(p => p.id === node.id)?.selected || false,
      }));
    });
  }, [baseFlowNodes, setFlowNodes]);

  const getDirectionFromPoints = useCallback((from: { x: number; y: number }, to: { x: number; y: number }): NodeDirection => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'bottom' : 'top';
  }, []);

  const getNextPositionForSide = useCallback((parent: MindmapNode, side: NodeDirection) => {
    const parentPos = flowNodePositionMap.get(parent.id) || parent.position || { x: 0, y: 0 };
    const parentWidth = estimateNodeWidth(parent);
    const children = nodes.filter((n) => n.parentId === parent.id);

    const sameSideChildren = children.filter((child) => {
      const childPos = flowNodePositionMap.get(child.id) || child.position;
      if (!childPos) return false;
      return getDirectionFromPoints(parentPos, childPos) === side;
    });

    const index = sameSideChildren.length;
    const totalAfterInsert = sameSideChildren.length + 1;
    const centeredOffset = (index - (totalAfterInsert - 1) / 2) * STACK_GAP;

    switch (side) {
      case 'left':
        return { x: parentPos.x - 320 - 75, y: parentPos.y + centeredOffset };
      case 'right':
        return { x: parentPos.x + parentWidth + 75, y: parentPos.y + centeredOffset };
      case 'top':
        return { x: parentPos.x + (index - (totalAfterInsert - 1) / 2) * STACK_GAP_HORIZONTAL, y: parentPos.y - SIDE_GAP_Y };
      case 'bottom':
        return { x: parentPos.x + (index - (totalAfterInsert - 1) / 2) * STACK_GAP_HORIZONTAL, y: parentPos.y + SIDE_GAP_Y };
      default:
        return { x: parentPos.x + parentWidth + 75, y: parentPos.y };
    }
  }, [flowNodePositionMap, getDirectionFromPoints, nodes]);

  // Enrich nodes with callbacks
  const handleAddDirectionalChild = useCallback(async (parentNode: MindmapNode, direction: NodeDirection) => {
    const label = prompt('Branch name?', 'New Branch');
    const finalLabel = label?.trim();
    if (!finalLabel) return;

    const type: NodeType = 'branch';
    const color = parentNode.type === 'root'
      ? DEFAULT_BRANCH_COLORS[Math.floor(Math.random() * DEFAULT_BRANCH_COLORS.length)]
      : (parentNode.color || DEFAULT_BRANCH_COLORS[0]);

    const position = getNextPositionForSide(parentNode, direction);
    await addNode(parentNode.id, finalLabel, type, color, position, direction);
    toast.success('Node added');
  }, [addNode, getNextPositionForSide]);

  const interactiveFlowNodes = useMemo(() => {
    return flowNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onContextMenu: handleNodeContextMenu,
        onAddDirectionalChild: handleAddDirectionalChild,
        onPreview: (node: MindmapNode) => {
          setPreviewNode(node);
          setPreviewLoading(false);
          if (!content[node.id] && mapId) {
            setPreviewLoading(true);
            fetchNodeContent(node.id, mapId).finally(() => setPreviewLoading(false));
          }
        },
        readOnly: isReadOnly,
      }
    }));
  }, [flowNodes, handleNodeContextMenu, handleAddDirectionalChild, content, mapId, fetchNodeContent, isReadOnly]);

  const rootNode = useMemo(() => nodes.find((n) => n.type === 'root') || null, [nodes]);
  const branchCount = useMemo(() => nodes.filter((n) => n.type === 'branch').length, [nodes]);

  const handleAddBranch = useCallback(async () => {
    if (!rootNode) {
      toast.error('Root node is still loading. Please try again.');
      return;
    }

    const label = prompt('Branch name?', 'New Branch');
    const finalLabel = label?.trim();
    if (finalLabel) {
      const color = DEFAULT_BRANCH_COLORS[Math.floor(Math.random() * DEFAULT_BRANCH_COLORS.length)];
      await addNode(rootNode.id, finalLabel, 'branch', color, undefined, 'right');
      toast.success('Branch added');
    }
  }, [rootNode, addNode]);

  const onCanvasContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    if (useSettingsStore.getState().isReadOnly) return;
    const nodeData = (node.data as { node?: MindmapNode } | undefined)?.node;
    if (!nodeData) return;
    setMenuInfo({
      x: e.clientX,
      y: e.clientY,
      node: nodeData
    });
    setPaneMenuInfo(null);
  }, []);

  const handlePaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    if (useSettingsStore.getState().isReadOnly) return;
    setPaneMenuInfo({ x: e.clientX, y: e.clientY });
    setMenuInfo(null);
  }, []);

  const handleAddBranchFromPane = useCallback(async () => {
    if (!rootNode) {
      toast.error('Root node is still loading. Please try again.');
      setPaneMenuInfo(null);
      return;
    }

    const label = prompt('Branch name?', 'New Branch');
    const finalLabel = label?.trim();
    if (!finalLabel) {
      setPaneMenuInfo(null);
      return;
    }

    const color = DEFAULT_BRANCH_COLORS[Math.floor(Math.random() * DEFAULT_BRANCH_COLORS.length)];
    await addNode(rootNode.id, finalLabel, 'branch', color, undefined, 'right');
    toast.success('Branch added');
    setPaneMenuInfo(null);
  }, [addNode, rootNode]);

  const handleAddChild = async (n: MindmapNode) => {
    const type: NodeType = 'branch';
    const label = prompt(`Enter ${type} name:`, `New ${type}`);
    if (label) {
      const color = n.type === 'branch' ? n.color : n.type === 'root' ? DEFAULT_BRANCH_COLORS[0] : (nodes.find(p=>p.id === n.parentId)?.color || DEFAULT_BRANCH_COLORS[0]);
      await addNode(n.id, label.trim(), type, color, undefined, n.direction || 'right');
      toast.success('Node added');
    }
  };

  const handleAddSibling = async (n: MindmapNode) => {
    if (!n.parentId) return;
    const label = prompt(`Enter sibling ${n.type} name:`, `New ${n.type}`);
    if (label) {
      await addNode(n.parentId, label.trim(), 'branch', n.color, undefined, n.direction || 'right');
      toast.success('Sibling added');
    }
  };

  const handleRename = async (n: MindmapNode) => {
    const label = prompt('Enter new node name:', n.label);
    if (label && label.trim() !== n.label) {
      await updateNode(n.id, { label: label.trim() });
      toast.success('Node renamed');
    }
  };

  const previewBreadcrumb = useMemo(() => {
    if (!previewNode) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const chain: string[] = [];
    let current: MindmapNode | undefined = previewNode;
    while (current) {
      chain.unshift(current.label);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return chain;
  }, [previewNode, nodes]);

  const handleNodeDragStart = useCallback((_event: any, node: Node) => {
    const startPositions = new Map<string, { x: number; y: number }>();
    flowNodes.forEach(n => {
      if (n.selected || n.id === node.id) {
        startPositions.set(n.id, { ...n.position });
      }
    });
    dragStartPositionsRef.current = startPositions;
  }, [flowNodes]);

  const handleNodeDrag = useCallback(() => {
    // Real-time edge updates handled by flowEdges useMemo
  }, []);

  const handleNodeDragStop = useCallback(async (_event: any, draggedNode: Node) => {
    const selectedNodes = flowNodes.filter(n => n.selected);
    const isPartOfSelection = selectedNodes.some(n => n.id === draggedNode.id);

    const startPos = dragStartPositionsRef.current.get(draggedNode.id);
    const dx = startPos ? draggedNode.position.x - startPos.x : 0;
    const dy = startPos ? draggedNode.position.y - startPos.y : 0;

    if (isPartOfSelection && selectedNodes.length > 1) {
      const selectedIds = new Set(selectedNodes.map(n => n.id));
      const newEdgeWaypoints = { ...edgeWaypoints };
      let waypointsChanged = false;

      nodes.forEach(node => {
        if (node.parentId && selectedIds.has(node.id) && selectedIds.has(node.parentId)) {
          const edgeId = `${node.parentId}-${node.id}`;
          if (newEdgeWaypoints[edgeId] && newEdgeWaypoints[edgeId].length > 0) {
            newEdgeWaypoints[edgeId] = newEdgeWaypoints[edgeId].map(wp => ({
              ...wp,
              x: wp.x + dx,
              y: wp.y + dy
            }));
            waypointsChanged = true;
          }
        }
      });

      const nodeUpdates = selectedNodes.map(flowNode => {
        const mappedNode = nodes.find(n => n.id === flowNode.id);
        if (!mappedNode) return null;

        let direction = mappedNode.direction;
        if (mappedNode.parentId) {
          const parentPos = flowNodePositionMap.get(mappedNode.parentId) || nodes.find(n => n.id === mappedNode.parentId)?.position;
          if (parentPos) {
            direction = getDirectionFromPoints(parentPos, flowNode.position);
          }
        }

        return {
          id: flowNode.id,
          position: flowNode.position,
          direction
        };
      }).filter(u => u !== null) as Array<{ id: string; position: { x: number; y: number }; direction?: NodeDirection }>;

      if (nodeUpdates.length > 0) {
        await saveBatchChanges(nodeUpdates, waypointsChanged ? newEdgeWaypoints : edgeWaypoints);
        toast.success(`Moved ${nodeUpdates.length} nodes`);
      }
      return;
    }

    // Standard single node drag logic
    const mappedNode = nodes.find((n) => n.id === draggedNode.id);
    if (!mappedNode) return;

    if (!mappedNode.parentId) {
      if (mappedNode.type === 'root') {
        await updateNode(mappedNode.id, { position: draggedNode.position });
      }
      return;
    }

    const parentPos = flowNodePositionMap.get(mappedNode.parentId) || nodes.find((n) => n.id === mappedNode.parentId)?.position;
    if (!parentPos) {
      await updateNode(mappedNode.id, { position: draggedNode.position });
      return;
    }

    const direction = getDirectionFromPoints(parentPos, draggedNode.position);
    await updateNode(mappedNode.id, { position: draggedNode.position, direction });
  }, [flowNodes, nodes, flowNodePositionMap, getDirectionFromPoints, edgeWaypoints, saveBatchChanges, updateNode]);

  /**
   * Tidy Up: Recalculates clean, collision-free auto layout using the chosen pattern
   * and saves all positions atomically to Supabase while clearing old waypoints.
   */
  const handleTidyUp = useCallback(async (pattern: LayoutPattern = activeLayoutPattern, silent: boolean = false) => {
    if (!nodes.length) return;
    const root = nodes.find((n) => n.type === 'root');
    if (!root) return;

    const layoutPositions = computeMindmapLayout(nodes, pattern);
    const updates: Array<{ id: string; position: { x: number; y: number }; direction?: NodeDirection }> = [];

    nodes.forEach((node) => {
      const computed = layoutPositions.get(node.id);
      if (computed) {
        updates.push({
          id: node.id,
          position: { x: computed.x, y: computed.y },
          direction: computed.direction,
        });
      }
    });

    if (updates.length > 0) {
      // Optimistically update positions in flowNodes immediately
      setFlowNodes((prev) =>
        prev.map((flowNode) => {
          const match = layoutPositions.get(flowNode.id);
          return match ? { ...flowNode, position: { x: match.x, y: match.y } } : flowNode;
        })
      );

      // Save to database atomically and reset waypoints for clean direct edges
      await saveBatchChanges(updates, {});

      setTimeout(() => {
        fitView({ duration: 500, padding: 0.15 });
      }, 50);

      if (!silent) {
        const patternLabels: Record<LayoutPattern, string> = {
          radial: 'Radial 360°',
          balanced: 'Balanced L/R',
          right: 'Flow Right',
        };
        toast.success(`Organized in ${patternLabels[pattern]} layout ✓`);
      }
    }
  }, [nodes, activeLayoutPattern, setFlowNodes, saveBatchChanges, fitView]);

  // Auto-layout detection: If nodes lack saved positions (e.g. freshly created via MCP), auto-layout and persist
  useEffect(() => {
    if (!nodes.length || isReadOnly || !mapId) return;
    const unpositionedNodes = nodes.filter((n) => n.type !== 'root' && !n.position);
    if (unpositionedNodes.length > 0) {
      handleTidyUp(activeLayoutPattern, true);
    }
  }, [nodes, isReadOnly, mapId, activeLayoutPattern, handleTidyUp]);

  const handleShare = useCallback(async () => {
    if (!mapId) return;
    try {
      let token = mapMeta?.shareToken || null;
      if (!token) {
        token = nanoid(21);
        const { error } = await supabase
          .from('mindmaps')
          .update({ share_token: token, is_public: true })
          .eq('id', mapId);
        if (error) throw error;
        await fetchMaps();
      }

      const url = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(url);
      setShareUrl(url);
      setSharePopoverOpen(true);
      toast.success('Link copied to clipboard ✓');
    } catch (error) {
      console.error('Failed to share map:', error);
      toast.error('Failed to create share link');
    }
  }, [mapId, mapMeta?.shareToken, fetchMaps]);

  const handleRevokeShare = useCallback(async () => {
    if (!mapId) return;
    try {
      const { error } = await supabase
        .from('mindmaps')
        .update({ share_token: null, is_public: false })
        .eq('id', mapId);
      if (error) throw error;
      await fetchMaps();
      setSharePopoverOpen(false);
      setShareUrl('');
      toast.success('Share link revoked');
    } catch (error) {
      console.error('Failed to revoke share:', error);
      toast.error('Failed to revoke link');
    }
  }, [mapId, fetchMaps]);

  const handleExportPDF = async () => {
    if (!mapId || !mapMeta) return;
    try {
      setIsExporting(true);
      const toastId = toast.loading('Fetching content for export...');
      
      const fetchPromises = nodes.map(node => {
        if (!content[node.id]) {
          return fetchNodeContent(node.id, mapId);
        }
        return Promise.resolve();
      });
      
      await Promise.all(fetchPromises);
      toast.loading('Generating PDF format...', { id: toastId });
      
      const finalContent = useContentStore.getState().content;
      await exportMindmapToPDF(mapMeta, nodes, finalContent);
      
      toast.success('PDF Export downloaded!', { id: toastId });
    } catch (err) {
      console.error('Export Error:', err);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full select-none">
      <AppHeader
        leftContent={(
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition text-sm font-semibold px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-surface-2)] active:scale-95"
          >
            ← Dashboard
          </button>
        )}
        rightContent={(
          <div className="flex items-center gap-2 relative">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-accent bg-transparent border border-border hover:bg-surface rounded-lg transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export as PDF"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {isExporting ? 'Generating...' : 'Export PDF'}
            </button>
            <div className="relative">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-surface-2 text-text text-sm font-semibold transition"
                title="Share this mindmap"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            {sharePopoverOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-bg border border-border rounded-xl shadow-xl p-3 z-[120]">
                <p className="text-xs font-semibold text-text-secondary mb-2">Shareable link</p>
                <input
                  readOnly
                  value={shareUrl}
                  className="w-full text-sm bg-bg border border-border rounded-lg px-3 py-2 text-text"
                />
                <div className="mt-3 flex justify-between items-center">
                  <button
                    onClick={handleRevokeShare}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-secondary"
                  >
                    <Link2Off className="w-4 h-4" />
                    Revoke link
                  </button>
                  <button
                    onClick={() => setSharePopoverOpen(false)}
                    className="text-sm font-semibold text-text-secondary hover:text-text"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        )}
      />
      <CanvasToolbar 
        map={mapMeta} 
        onFitView={() => fitView({ duration: 500, padding: 0.2 })} 
        onAddBranch={handleAddBranch}
        onTidyUp={handleTidyUp}
        layoutPattern={activeLayoutPattern}
        onLayoutPatternChange={(pattern) => {
          if (mapId) setLayoutPattern(mapId, pattern);
        }}
      />
      <div className="flex-1 w-full bg-bg relative">
        <ReactFlow
          nodes={interactiveFlowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onMoveEnd={onMoveEnd}
          onNodeContextMenu={onCanvasContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          onPaneClick={() => {
            setMenuInfo(null);
            setPaneMenuInfo(null);
          }}
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          elevateNodesOnSelect={false}
          nodesDraggable={!isReadOnly}
          nodesConnectable={false}
          panOnDrag={[2]}
          selectionOnDrag
          deleteKeyCode={null}
          onKeyDown={(e) => {
            if (
              e.target instanceof HTMLElement &&
              (e.target.closest('.bn-editor') ||
               e.target.closest('[contenteditable]') ||
               e.target.tagName === 'INPUT' ||
               e.target.tagName === 'TEXTAREA')
            ) {
              e.stopPropagation();
              return;
            }
          }}
        >
          <Background color="var(--border-strong)" gap={16} size={2} />
          <Controls className="mb-4 ml-4" showInteractive={false} />
          <MiniMap 
            nodeColor={(n) => {
              if (n.type === 'root') return 'var(--accent)';
              if (n.type === 'branch') return (n.data?.node as MindmapNode)?.color || 'var(--text-secondary)';
              return 'var(--surface-2)';
            }}
            maskColor="rgba(0, 0, 0, 0.75)"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            className="rounded-lg shadow-md"
          />
        </ReactFlow>

        {rootNode && branchCount === 0 && !isReadOnly && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-text-muted text-sm md:text-base font-medium">
              👆 Click &quot;+ Add Branch&quot; in the toolbar to start building your mindmap
            </p>
          </div>
        )}

        {paneMenuInfo && (
          <div
            style={{ top: paneMenuInfo.y, left: paneMenuInfo.x }}
            className="fixed z-[100] min-w-44 bg-bg rounded-lg border border-border shadow-xl py-1"
          >
            <button
              onClick={handleAddBranchFromPane}
              className="w-full text-left px-3 py-2 text-sm font-medium text-text hover:bg-surface hover:text-accent transition"
            >
              ➕ Add Branch here
            </button>
          </div>
        )}

        {menuInfo && (
          <NodeContextMenu
            x={menuInfo.x}
            y={menuInfo.y}
            node={menuInfo.node}
            onClose={() => setMenuInfo(null)}
            onAddChild={handleAddChild}
            onAddSibling={handleAddSibling}
            onRename={handleRename}
            onChangeColor={(n, c) => updateNode(n.id, { color: c })}
            onDelete={(n) => {
              if(window.confirm('Delete this node? This cannot be undone.')) deleteNode(n.id);
            }}
          />
        )}

        {previewNode && (
          <QuickPreviewModal
            node={previewNode}
            breadcrumb={previewBreadcrumb}
            content={content[previewNode.id] || null}
            isLoading={previewLoading}
            onClose={() => setPreviewNode(null)}
          />
        )}
      </div>
    </div>
  );
}
