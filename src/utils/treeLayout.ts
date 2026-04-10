import type { Node, Edge } from '@xyflow/react';
import type { MindmapNode, NodeDirection, EdgeWaypoints } from '../types';

const BRANCH_X_GAP = 240;
const LEAF_X_GAP = 220;
const BRANCH_Y_GAP = 100;
const LEAF_Y_GAP = 80;

const oppositeDirection: Record<NodeDirection, NodeDirection> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

function getDirection(from: { x: number; y: number }, to: { x: number; y: number }): NodeDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

export function buildFlowElements(
  nodes: MindmapNode[], 
  edgeWaypoints: EdgeWaypoints = {},
  positionOverrides?: Map<string, { x: number; y: number }>
) {
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];

  const root = nodes.find((n) => n.type === 'root');
  if (!root) return { nodes: [], edges: [] };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenByParent = new Map<string, MindmapNode[]>();

  nodes.forEach((node) => {
    if (!node.parentId) return;
    const current = childrenByParent.get(node.parentId) || [];
    current.push(node);
    childrenByParent.set(node.parentId, current);
  });

  const positionById = new Map<string, { x: number; y: number }>();
  positionById.set(root.id, positionOverrides?.get(root.id) || root.position || { x: 60, y: 0 });

  const assignChildPositions = (parentId: string) => {
    const parentPos = positionById.get(parentId);
    if (!parentPos) return;
    const children = (childrenByParent.get(parentId) || []).sort((a, b) => a.order - b.order);
    const total = children.length;

    children.forEach((child, index) => {
      const override = positionOverrides?.get(child.id);
      
      if (override) {
        positionById.set(child.id, override);
      } else if (child.position && child.position.x !== undefined && child.position.y !== undefined) {
        // High Priority: Use the position exactly as saved in the DB
        positionById.set(child.id, child.position);
      } else {
        // Fallback: Auto-layout based on index and parent position
        const yGap = child.type === 'leaf' ? LEAF_Y_GAP : BRANCH_Y_GAP;
        const xGap = child.type === 'leaf' ? LEAF_X_GAP : BRANCH_X_GAP;
        const offsetY = (index - (total - 1) / 2) * yGap;
        const offsetX = (index - (total - 1) / 2) * xGap;
        const side = child.direction || 'right';
        
        if (side === 'left') {
          positionById.set(child.id, { x: parentPos.x - xGap, y: parentPos.y + offsetY });
        } else if (side === 'right') {
          positionById.set(child.id, { x: parentPos.x + xGap, y: parentPos.y + offsetY });
        } else if (side === 'top') {
          positionById.set(child.id, { x: parentPos.x + offsetX, y: parentPos.y - yGap });
        } else {
          positionById.set(child.id, { x: parentPos.x + offsetX, y: parentPos.y + yGap });
        }
      }
      assignChildPositions(child.id);
    });
  };

  assignChildPositions(root.id);

  nodes.forEach((node) => {
    if (!positionById.has(node.id)) {
      positionById.set(node.id, positionOverrides?.get(node.id) || node.position || { x: 60, y: 0 });
    }
  });

  nodes.forEach((node) => {
    const position = positionById.get(node.id) || { x: 60, y: 0 };
    if (node.type === 'root') {
      flowNodes.push({
        id: node.id,
        type: 'root',
        position,
        data: { node, totalProgress: '0/0 studied' },
      });
      return;
    }

    if (node.type === 'branch') {
      flowNodes.push({
        id: node.id,
        type: 'branch',
        position,
        data: { node, completedCount: 0, totalCount: 0 },
      });
      return;
    }

    flowNodes.push({
      id: node.id,
      type: 'leaf',
      position,
      data: { node },
    });
  });

  nodes.forEach((node) => {
    if (!node.parentId) return;
    const parent = byId.get(node.parentId);
    if (!parent) return;
    const parentPos = positionById.get(parent.id);
    const childPos = positionById.get(node.id);
    if (!parentPos || !childPos) return;

    const direction = getDirection(parentPos, childPos);
    const targetDirection = oppositeDirection[direction];
    const edgeId = `${parent.id}-${node.id}`;

    flowEdges.push({
      id: `e-${edgeId}`,
      source: parent.id,
      target: node.id,
      sourceHandle: `s-${direction}`,
      targetHandle: `t-${targetDirection}`,
      type: 'waypoint',
      data: {
        waypoints: edgeWaypoints[edgeId] || []
      },
      style: {
        stroke: parent.color || node.color || '#94a3b8',
        strokeWidth: parent.type === 'root' ? 3 : 2,
      },
    });
  });

  return { nodes: flowNodes, edges: flowEdges };
}
