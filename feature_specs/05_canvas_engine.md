# SPEC-05: ReactFlow Canvas Engine

> **Status:** DONE
> **Session:** 4–6
> **Tracker ref:** SPEC-05

---

## Goal

Implement the core mind map canvas: an infinite ReactFlow graph that renders a three-tier node hierarchy (`root → branch → leaf`), supports drag-to-reposition, right-click context menus, and automatically lays out nodes based on a direction vector. All node positions and edge waypoints must persist to Supabase on every drag-stop event.

---

## Design / Technical Constraints

- **Canvas library:** `@xyflow/react` v12. No other canvas library. No raw SVG.
- **State manager:** `mapStore` (Zustand). All node and waypoint data lives here. `MindmapCanvas` reads from `mapStore` via hooks.
- **Two separate ReactFlow state layers:**
  - `mapStore.nodes` — the Supabase-persisted truth. Updated only after a confirmed save.
  - ReactFlow's internal `useNodesState` — the live display layer during drag. Never treat this as the source of truth for database writes.
- **Layout algorithm:** Implement `buildFlowElements(nodes: MindmapNode[], edgeWaypoints: EdgeWaypoints, positionOverrides?: Map<string, {x,y}>): { nodes: Node[], edges: Edge[] }` in `src/utils/treeLayout.ts`. Position priority order: (1) `positionOverrides` map, (2) DB-saved `position_x`/`position_y`, (3) auto-layout by `direction` field.
- **`supportsDirection` backward compat:** `mapStore` must have a `supportsDirection: boolean` flag (default `true`). If any Supabase write returns error code `'42703'` or `'PGRST204'`, flip the flag to `false` and retry the write without the `direction` field. This handles old Supabase instances that lack the column.
- **Optimistic updates on drag:** `saveBatchChanges()` must (1) update Zustand state immediately, (2) persist to Supabase in the background, (3) call `loadMap()` to reconcile.
- **No user-drawn edges:** Set `nodesConnectable={false}`. All edges are derived from the parent-child hierarchy.
- **No keyboard delete:** Set `deleteKeyCode={null}`. All deletion goes through the right-click context menu.
- **Pan behavior:** `panOnDrag={[2]}` (middle mouse only). `selectionOnDrag` (left-click drag = box selection).
- **Canvas background:** `<Background color="#2d3748" gap={16} size={2} />` — dot grid.
- **Node spacing constants (define at top of `MindmapCanvas.tsx`):** `SIDE_GAP_X = 260`, `SIDE_GAP_Y = 170`, `STACK_GAP = 110`, `STACK_GAP_HORIZONTAL = 180`.
- **Edge type:** All edges use a custom `WaypointEdge` component. Register it as both `'waypoint'` and `'default'` in `edgeTypes`. Implement `WaypointEdge` in SPEC-05b.
- **Handles:** Every node renders 8 handles — 4 source, 4 target, one per direction. All `opacity-0`. Active handle (matching direction) renders at standard size; inactive handles render `w-0 h-0`. Handle IDs follow the convention `s-{direction}` (source) and `t-{direction}` (target).

---

## Implementation Steps

### `src/store/mapStore.ts`
- State: `nodes: MindmapNode[]`, `edgeWaypoints: EdgeWaypoints`, `mapId: string | null`, `isLoading: boolean`, `error: string | null`, `supportsDirection: boolean`
- Define `DbNodeRow` type matching the Supabase `nodes` table columns (snake_case)
- Implement `loadMap(mapId)`: fetch `mindmaps` row (for `edge_waypoints`) and all `nodes` WHERE `map_id`. Format DB rows into `MindmapNode[]`. Set `mapId`, `nodes`, `edgeWaypoints`, `isLoading`.
- Implement `addNode(parentId, label, type, color, position?, direction?)`: INSERT into `nodes`. If `supportsDirection === false`, omit `direction` from the insert. Catch error code `42703` → set `supportsDirection: false`, retry without direction. Push new node into `nodes[]` state.
- Implement `updateNode(id, updates)`: UPDATE `nodes` WHERE `id`. Merge updates into local `nodes[]` state.
- Implement `deleteNode(id)`: DELETE from `nodes` WHERE `id`. Remove from `nodes[]`.
- Implement `saveNodePositions(updates: Array<{id, position, direction?}>)`: batch UPDATE `nodes` for each update. Use `supportsDirection` flag to decide whether to include `direction`.
- Implement `saveBatchChanges(nodeUpdates, edgeWaypoints)`: (1) optimistic Zustand update, (2) call `saveNodePositions(nodeUpdates)`, (3) UPDATE `mindmaps.edge_waypoints`, (4) call `loadMap(mapId)` to reconcile.
- Implement `updateEdgeWaypoints(edgeWaypoints)`: UPDATE `mindmaps.edge_waypoints` WHERE `id = mapId`. Update local `edgeWaypoints` state.
- All write methods must start with `if (!navigator.onLine) { toast.error('...'); return; }`

### `src/utils/treeLayout.ts`
- Implement `buildFlowElements(nodes, edgeWaypoints, positionOverrides?)`:
  - Map each `MindmapNode` to a ReactFlow `Node` with `type: node.type`, `data: { node, ... }`, and `position` resolved by priority order
  - Map each parent-child pair to a ReactFlow `Edge` with `type: 'waypoint'`, `sourceHandle: 's-{direction}'`, `targetHandle: 't-{direction}'`
  - Determine direction: call `getDirection(parentPos, childPos)` which compares `|dx|` vs `|dy|` and returns `NodeDirection`
- Implement `getDirection(from: {x,y}, to: {x,y}): NodeDirection`
- Define `oppositeDirection: Record<NodeDirection, NodeDirection>` map

### `src/components/mindmap/RootNode.tsx`
- Styling: `bg-teal-700 text-white px-6 py-4 rounded-xl shadow-lg border border-teal-800 min-w-[200px] text-center`
- Display: `node.label` (bold, lg) and `totalProgress` string (teal-200, xs)
- On click (non-readOnly): navigate to `/map/${node.mapId}/node/${node.id}`
- On click (readOnly): call `onPreview?.(node)`
- Render 4 directional add-node `+` buttons (`w-5 h-5 rounded-full bg-teal-600`) positioned absolutely at each edge midpoint, visible only on `group-hover`
- Render 8 handles (`s-left`, `s-right`, `s-top`, `s-bottom`, `t-left`, `t-right`, `t-top`, `t-bottom`) all `opacity-0`

### `src/components/mindmap/BranchNode.tsx`
- Styling: `bg-[#1e2433] px-4 py-3 rounded-lg shadow-sm border-l-4 border-y border-r border-[#2d3748] min-w-[160px]`
- Dynamic: `style={{ borderLeftColor: node.color || '#0d9488' }}`
- Hover: `hover:shadow-md hover:-translate-y-0.5 transition-all`
- Display: `node.label` (semibold, slate-200, sm). Green dot when `isCompleted`.
- On click: same pattern as RootNode
- Render 4 directional add-node buttons (same as RootNode)
- Quick preview `<Eye>` button (`w-6 h-6 rounded-full bg-teal-600/90`), absolute top-right, visible on hover
- Render 8 handles (same as RootNode)

### `src/components/mindmap/LeafNode.tsx`
- Styling: `bg-[#1e2433] border border-[#2d3748] px-3 py-2 rounded-full shadow-sm min-w-[140px]`
- Hover: `hover:bg-[#2d3748] hover:border-teal-600 hover:shadow hover:-translate-x-0.5 transition-all`
- Display: `node.label` (slate-300, font-medium, truncate). Green `w-2 h-2 rounded-full bg-green-500` dot when `isCompleted`. `→ Study` text (teal-600) on hover.
- On click: same pattern as BranchNode
- Quick preview `<Eye>` button (same as BranchNode)
- Render 8 handles (no directional add buttons — leaf nodes do not spawn children via canvas buttons)

### `src/components/mindmap/WaypointEdge.tsx`
- Accept standard ReactFlow `EdgeProps`
- Maintain local `useState` for waypoints (for smooth drag). Sync from `storeWaypoints` via `useEffect` — gate the sync with `if (!dragInfo)` to prevent snap-back during active drag.
- Render the edge as an SVG `<path>` using the waypoint array to build the `d` attribute
- Invisible buffer `<path>` with `strokeWidth={25}` and `opacity="0"` for a larger click/hover target
- On hover, show "phantom" midpoint dots (`w-2.5 h-2.5 rounded-full bg-white border-2 border-violet-500/40`); dragging a phantom promotes it to a real waypoint
- Real waypoint handles: `w-3 h-3 rounded-full bg-white border-[3px] border-[#7C3AED]`; double-click removes the waypoint
- On pointer-up after drag: call `mapStore.updateEdgeWaypoints(updatedWaypoints)`

### `src/components/mindmap/NodeContextMenu.tsx`
- Position with `fixed` at `{top: y, left: x}`. `z-[100]`.
- Styling: `w-56 bg-[#1e2433] rounded-xl shadow-xl shadow-black/50 border border-[#2d3748] py-1.5`
- Close on outside click (register `document.addEventListener('click', ...)` in `useEffect` with cleanup)
- Menu items: "Add branch", "Add sibling node" (hidden for root), "Rename", "Change color" (color picker showing `DEFAULT_BRANCH_COLORS`), "Delete node" (hidden for root)
- Hover state: `hover:bg-teal-900/40 hover:text-teal-300`
- Delete hover: `hover:bg-red-900/30 text-red-400`

### `src/components/mindmap/MindmapCanvas.tsx`
- Load `mapStore` and `contentStore` data on mount
- Implement `handleNodeDragStart`: snapshot all selected node positions into `dragStartPositionsRef`
- Implement `handleNodeDragStop`: compute displacement, call `saveBatchChanges()`, shift waypoints for internally-selected edges
- Implement `handleAddDirectionalChild(parentNode, direction)`: compute new node position using `getNextPositionForSide()`, call `mapStore.addNode()`
- Implement `handleTidyUp()`: radial re-layout of all nodes around root, then call `saveNodePositions()`
- Render `<Background>`, `<Controls>`, `<MiniMap>` with dark theme overrides
- MiniMap `nodeColor`: root → `#0f766e`, branch → `node.color || '#94a3b8'`, leaf → `#2d3748`
- MiniMap `maskColor`: `rgba(15, 17, 23, 0.75)`
- Prevent ReactFlow structural sync loop: use `lastBaseNodesRef` to compare node ID lists before calling `setFlowNodes`

### `src/components/mindmap/CanvasToolbar.tsx`
- Fixed header bar: `h-14 bg-[#1e2433] border-b border-[#2d3748]`
- Left: "← Dashboard" navigation button
- Center: Inline-editable map title (click to activate `<input>`, save on blur/Enter, cancel on Escape)
- Right: "Fit View", "+ Add Branch", "Tidy Up", "Share" buttons
- Share button opens a popover with the share URL and a "Revoke link" option

---

## Verification Checklist

- [ ] Canvas renders all nodes from Supabase for the current `mapId` — no blank canvas
- [ ] Dragging a node and releasing updates its position in the Supabase `nodes` table (verify in Supabase dashboard)
- [ ] Right-clicking a branch node opens the context menu; clicking "Add branch" creates a child node visible immediately
- [ ] Dragging an edge midpoint creates a waypoint; on reload the waypoint is in the same position (persisted in `mindmaps.edge_waypoints`)
