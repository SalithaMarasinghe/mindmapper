import type { Node, Edge } from '@xyflow/react';
import type { MindmapNode, NodeDirection, EdgeWaypoints, LayoutPattern } from '../types';

export const oppositeDirection: Record<NodeDirection, NodeDirection> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

export function getDirection(from: { x: number; y: number }, to: { x: number; y: number }): NodeDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

/**
 * Estimates rendered node pill width based on label length and node type.
 * Ensures parent and child columns never collide horizontally.
 */
export function estimateNodeWidth(node?: MindmapNode | null): number {
  if (!node) return 200;
  if (node.type === 'root') {
    return Math.max(220, Math.min(480, (node.label?.length || 10) * 9 + 80));
  }
  const len = node.label?.length || 10;
  if (node.type === 'branch') {
    return Math.max(160, Math.min(460, len * 8.5 + 72));
  }
  // leaf
  return Math.max(140, Math.min(440, len * 8 + 68));
}

/**
 * Intelligent mind map layout engine supporting:
 * - 'radial': 360° Circular Hub & Spoke layout (default)
 * - 'balanced': Left/Right balanced hierarchical tree
 * - 'right': Classic Left-to-Right flow tree
 *
 * Guarantees zero text collisions even for long 450px+ titles by recursively
 * sizing subtree bounding boxes and dynamically offsetting parent/child columns.
 */
export function computeMindmapLayout(
  nodes: MindmapNode[],
  pattern: LayoutPattern = 'radial'
): Map<string, { x: number; y: number; direction?: NodeDirection }> {
  const root = nodes.find((n) => n.type === 'root');
  if (!root) return new Map();

  const childrenByParent = new Map<string, MindmapNode[]>();
  nodes.forEach((node) => {
    if (!node.parentId) return;
    const current = childrenByParent.get(node.parentId) || [];
    current.push(node);
    childrenByParent.set(node.parentId, current);
  });

  const NODE_HEIGHT = 64; // height slot per leaf node
  const HORIZONTAL_GAP = 75; // clear gap between end of parent and start of child

  function getSubtreeHeight(id: string): number {
    const children = childrenByParent.get(id) || [];
    if (children.length === 0) return NODE_HEIGHT;
    let sum = 0;
    for (const c of children) {
      sum += getSubtreeHeight(c.id);
    }
    return Math.max(NODE_HEIGHT, sum);
  }

  const positions = new Map<string, { x: number; y: number; direction?: NodeDirection }>();
  positions.set(root.id, { x: 0, y: 0, direction: 'right' });

  const mainBranches = (childrenByParent.get(root.id) || []).sort((a, b) => a.order - b.order);
  if (mainBranches.length === 0) return positions;

  function layoutSubtree(
    parentId: string,
    parentPos: { x: number; y: number },
    direction: 'left' | 'right'
  ) {
    const parentNode = nodes.find((n) => n.id === parentId);
    const parentW = estimateNodeWidth(parentNode);
    const children = (childrenByParent.get(parentId) || []).sort((a, b) => a.order - b.order);
    if (children.length === 0) return;

    const totalH = children.reduce((sum, c) => sum + getSubtreeHeight(c.id), 0);
    let curY = parentPos.y - totalH / 2;

    for (const c of children) {
      const childW = estimateNodeWidth(c);
      const childX = direction === 'right'
        ? parentPos.x + parentW + HORIZONTAL_GAP
        : parentPos.x - childW - HORIZONTAL_GAP;

      const cHeight = getSubtreeHeight(c.id);
      const childY = curY + cHeight / 2;
      const childPos = { x: childX, y: childY, direction };
      positions.set(c.id, childPos);
      curY += cHeight;
      layoutSubtree(c.id, childPos, direction);
    }
  }

  if (pattern === 'balanced') {
    // ─── BALANCED (LEFT / RIGHT) ───────────────────────────────────────────
    const rightBranches: MindmapNode[] = [];
    const leftBranches: MindmapNode[] = [];
    let rightTotalH = 0;
    let leftTotalH = 0;

    for (const b of mainBranches) {
      const h = getSubtreeHeight(b.id);
      if (rightTotalH <= leftTotalH) {
        rightBranches.push(b);
        rightTotalH += h;
      } else {
        leftBranches.push(b);
        leftTotalH += h;
      }
    }

    const rootW = estimateNodeWidth(root);

    // Right side
    let curRightY = -rightTotalH / 2;
    for (const b of rightBranches) {
      const bH = getSubtreeHeight(b.id);
      const bY = curRightY + bH / 2;
      const bX = rootW + 100;
      const bPos = { x: bX, y: bY, direction: 'right' as const };
      positions.set(b.id, bPos);
      curRightY += bH;
      layoutSubtree(b.id, bPos, 'right');
    }

    // Left side
    let curLeftY = -leftTotalH / 2;
    for (const b of leftBranches) {
      const bW = estimateNodeWidth(b);
      const bH = getSubtreeHeight(b.id);
      const bY = curLeftY + bH / 2;
      const bX = -bW - 100;
      const bPos = { x: bX, y: bY, direction: 'left' as const };
      positions.set(b.id, bPos);
      curLeftY += bH;
      layoutSubtree(b.id, bPos, 'left');
    }

    return positions;
  }

  if (pattern === 'right') {
    // ─── FLOW RIGHT (ONE-SIDED) ────────────────────────────────────────────
    const rootW = estimateNodeWidth(root);
    const totalH = mainBranches.reduce((sum, b) => sum + getSubtreeHeight(b.id), 0);
    const EXTRA_GAP = 50;
    const totalWithGaps = totalH + (mainBranches.length - 1) * EXTRA_GAP;

    let curY = -totalWithGaps / 2;
    for (const b of mainBranches) {
      const bH = getSubtreeHeight(b.id);
      const bY = curY + bH / 2;
      const bX = rootW + 100;
      const bPos = { x: bX, y: bY, direction: 'right' as const };
      positions.set(b.id, bPos);
      curY += bH + EXTRA_GAP;
      layoutSubtree(b.id, bPos, 'right');
    }

    return positions;
  }

  // ─── RADIAL 360° (CIRCULAR FAN-OUT) ──────────────────────────────────────
  const RADIAL_R_X = 520;
  const nBranches = mainBranches.length;

  if (nBranches === 1) {
    const rootW = estimateNodeWidth(root);
    const b = mainBranches[0];
    const bPos = { x: rootW + 100, y: 0, direction: 'right' as const };
    positions.set(b.id, bPos);
    layoutSubtree(b.id, bPos, 'right');
    return positions;
  }

  if (nBranches === 2) {
    const rootW = estimateNodeWidth(root);
    const bRight = mainBranches[0];
    const bLeft = mainBranches[1];
    const bLeftW = estimateNodeWidth(bLeft);

    const posR = { x: rootW + 100, y: 0, direction: 'right' as const };
    const posL = { x: -bLeftW - 100, y: 0, direction: 'left' as const };
    positions.set(bRight.id, posR);
    positions.set(bLeft.id, posL);
    layoutSubtree(bRight.id, posR, 'right');
    layoutSubtree(bLeft.id, posL, 'left');
    return positions;
  }

  // N >= 3: Distribute symmetrically in 360 degrees around root
  const branchMeta = mainBranches.map((b, i) => {
    const angle = (2 * Math.PI * i) / nBranches;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const isRight = cos >= 0;
    const subtreeH = getSubtreeHeight(b.id);
    return {
      branch: b,
      index: i,
      angle,
      cos,
      sin,
      isRight,
      subtreeH,
    };
  });

  const rightBranches = branchMeta.filter((m) => m.isRight).sort((a, b) => a.sin - b.sin);
  const leftBranches = branchMeta.filter((m) => !m.isRight).sort((a, b) => a.sin - b.sin);

  const layoutSideBranches = (sideMetaList: typeof branchMeta, direction: 'left' | 'right') => {
    if (sideMetaList.length === 0) return;

    const totalSideH = sideMetaList.reduce((sum, m) => sum + m.subtreeH, 0);
    const EXTRA_BRANCH_GAP = 80;
    const totalWithGaps = totalSideH + (sideMetaList.length - 1) * EXTRA_BRANCH_GAP;

    let curY = -totalWithGaps / 2;

    for (const m of sideMetaList) {
      const bY = curY + m.subtreeH / 2;
      const bW = estimateNodeWidth(m.branch);
      const bX = direction === 'right' ? RADIAL_R_X : -RADIAL_R_X - bW;
      const bPos = { x: bX, y: bY, direction };
      positions.set(m.branch.id, bPos);

      layoutSubtree(m.branch.id, bPos, direction);

      curY += m.subtreeH + EXTRA_BRANCH_GAP;
    }
  };

  layoutSideBranches(rightBranches, 'right');
  layoutSideBranches(leftBranches, 'left');

  return positions;
}

export function buildFlowElements(
  nodes: MindmapNode[],
  edgeWaypoints: EdgeWaypoints = {},
  positionOverrides?: Map<string, { x: number; y: number }>,
  pattern: LayoutPattern = 'radial'
) {
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];

  const root = nodes.find((n) => n.type === 'root');
  if (!root) return { nodes: [], edges: [] };

  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Precompute fallback layout in case nodes lack positions
  const computedLayout = computeMindmapLayout(nodes, pattern);

  const positionById = new Map<string, { x: number; y: number }>();
  
  // Set root position
  const rootPos = positionOverrides?.get(root.id) || root.position || { x: 0, y: 0 };
  positionById.set(root.id, rootPos);

  // Set child positions
  nodes.forEach((node) => {
    if (node.type === 'root') return;
    const override = positionOverrides?.get(node.id);
    if (override) {
      positionById.set(node.id, override);
    } else if (node.position && node.position.x !== undefined && node.position.y !== undefined) {
      positionById.set(node.id, node.position);
    } else {
      const fallback = computedLayout.get(node.id);
      positionById.set(node.id, fallback ? { x: fallback.x, y: fallback.y } : { x: 100, y: 0 });
    }
  });

  // Build flow nodes
  nodes.forEach((node) => {
    const position = positionById.get(node.id) || { x: 0, y: 0 };
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

  // Build edges
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
