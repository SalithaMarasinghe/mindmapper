import { 
  EdgeLabelRenderer, 
  useReactFlow,
  type EdgeProps 
} from '@xyflow/react';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { useMapStore } from '../../store/mapStore';
import type { Waypoint } from '../../types';

export function WaypointEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  data
}: EdgeProps) {
  const updateEdgeWaypoints = useMapStore((s) => s.updateEdgeWaypoints);
  const { screenToFlowPosition } = useReactFlow();
  
  // Real waypoints from store/props
  const storeWaypoints = (data?.waypoints as Waypoint[]) || [];
  
  // Local state for buttery smooth dragging
  const [localWaypoints, setLocalWaypoints] = useState<Waypoint[]>(storeWaypoints);
  const [dragInfo, setDragInfo] = useState<{ id: string } | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Sync local state when store changes, but not during active drag
  useEffect(() => {
    if (!dragInfo) {
      setLocalWaypoints(storeWaypoints);
    }
  }, [storeWaypoints, dragInfo]);

  // Generate SVG path string
  const path = useMemo(() => {
    let d = `M ${sourceX},${sourceY}`;
    localWaypoints.forEach((wp) => {
      d += ` L ${wp.x},${wp.y}`;
    });
    d += ` L ${targetX},${targetY}`;
    return d;
  }, [sourceX, sourceY, targetX, targetY, localWaypoints]);

  // Identify all points for midpoint calculation
  const allPoints = useMemo(() => [
    { x: sourceX, y: sourceY },
    ...localWaypoints,
    { x: targetX, y: targetY }
  ], [sourceX, sourceY, targetX, targetY, localWaypoints]);

  // Calculate midpoints for phantom handles
  const midpoints = useMemo(() => {
    const mids = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];
      mids.push({
        id: `mid-${i}`,
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        index: i // Position to insert if converted to waypoint
      });
    }
    return mids;
  }, [allPoints]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragInfo) return;
    e.stopPropagation();
    
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setLocalWaypoints((prev) => 
      prev.map(wp => wp.id === dragInfo.id ? { ...wp, x: flowPos.x, y: flowPos.y } : wp)
    );
  }, [dragInfo, screenToFlowPosition]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragInfo) return;
    e.stopPropagation();
    setDragInfo(null);
    
    // Sync final position to store/database
    const edgeDatabaseId = id.replace('e-', '');
    updateEdgeWaypoints(edgeDatabaseId, localWaypoints);
  }, [id, localWaypoints, dragInfo, updateEdgeWaypoints]);

  // Promotion logic: convert phantom dot to real waypoint
  const onPhantomPointerDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newId = Math.random().toString(36).substr(2, 9);
    const newWp: Waypoint = { id: newId, x: flowPos.x, y: flowPos.y };
    
    const newWaypoints = [...localWaypoints];
    newWaypoints.splice(index, 0, newWp);
    
    setLocalWaypoints(newWaypoints);
    setDragInfo({ id: newId });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  return (
    <g onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {/* Interaction Buffer */}
      <path
        d={path}
        fill="none"
        stroke={isHovered ? '#7C3AED22' : 'transparent'}
        strokeWidth={25}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="cursor-crosshair"
        style={{ pointerEvents: 'stroke' }}
      />
      
      {/* Visible Edge Line */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={isHovered || localWaypoints.length > 0 ? '#7C3AED' : (style.stroke || '#94a3b8')}
        strokeWidth={isHovered ? 4 : (style.strokeWidth || 2)}
        markerEnd={markerEnd}
        style={{ 
          transition: 'stroke 0.2s, stroke-width 0.2s',
          cursor: 'pointer'
        }}
      />

      <EdgeLabelRenderer>
        {/* Real Waypoint Handles */}
        {localWaypoints.map((wp) => (
          <div
            key={wp.id}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${wp.x}px, ${wp.y}px)`,
              pointerEvents: 'all',
              zIndex: 1001,
            }}
            className="nodrag nopan"
          >
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.target as Element).setPointerCapture(e.pointerId);
                setDragInfo({ id: wp.id });
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const filtered = localWaypoints.filter(w => w.id !== wp.id);
                setLocalWaypoints(filtered);
                updateEdgeWaypoints(id.replace('e-', ''), filtered);
              }}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: 'white',
                border: '3px solid #7C3AED',
                cursor: dragInfo?.id === wp.id ? 'grabbing' : 'grab',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transform: dragInfo?.id === wp.id ? 'scale(1.3)' : 'scale(1)',
                transition: dragInfo ? 'none' : 'transform 0.1s',
              }}
            />
          </div>
        ))}

        {/* Phantom Midpoint Dots (Visible on Hover) */}
        {isHovered && !dragInfo && midpoints.map((mid) => (
          <div
            key={mid.id}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
          >
            <div
              onPointerDown={(e) => onPhantomPointerDown(e, mid.index)}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'white',
                border: '2px solid #7C3AED66',
                cursor: 'copy',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                opacity: 0.8,
              }}
              title="Drag to create joint"
            />
          </div>
        ))}
      </EdgeLabelRenderer>
    </g>
  );
}
