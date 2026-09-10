# SPEC-04: Dashboard & Map Management

> **Status:** DONE
> **Session:** 3
> **Tracker ref:** SPEC-04

---

## Goal

Build the authenticated user's home screen: a dashboard that lists all their mind maps, lets them search and filter, create a new map via a modal, and delete or duplicate existing maps. Creating a map must atomically insert both the `mindmaps` row AND its initial `root` node in the same session.

---

## Design / Technical Constraints

- **State manager:** `mapsStore` (Zustand). Owns all map list state. `DashboardPage` must call `mapsStore.fetchMaps()` on mount and render from store state — no direct Supabase calls in the component.
- **Create map flow:** `createMap()` must insert the `mindmaps` row first, then immediately insert a `root` node into `nodes` with `type: 'root'`, `label: map.title`, `parent_id: null`. These are two sequential Supabase inserts — both must succeed before navigating to the canvas.
- **Duplicate map:** Copy the `mindmaps` row metadata only (title, emoji, color, description, tags). Do NOT attempt to copy `nodes` or `node_content` client-side — this is a known limitation. Log a comment in the code: `// Note: Client-side duplicating deep nodes + content omitted for brevity, ideally executed via Postgres RPC function for performance.`
- **Offline fallback:** `DashboardPage` must check `navigator.onLine`. If offline, read from `offlineStore` (IndexedDB) for the map list.
- **Styling:** Full dark theme. Page background `bg-[#0f1117]`. Map cards `bg-[#1e2433] border border-[#2d3748] rounded-xl`. Search input `bg-[#1e2433] border border-[#2d3748]`. CTA button `bg-teal-600 hover:bg-teal-700`.
- **Map card metadata:** Display `emoji`, `title`, `description`, `tags[]`, `node_count`, `completed_count`, `created_at`. Show a teal progress bar if `node_count > 0`.

---

## Implementation Steps

### `src/store/mapsStore.ts`
- Create Zustand store with state: `maps: MindmapMeta[]`, `isLoading: boolean`, `error: string | null`
- Implement `fetchMaps()`: SELECT from `mindmaps` WHERE `user_id = auth.uid()` ORDER BY `updated_at DESC`. Map snake_case DB columns to camelCase TypeScript fields.
- Implement `createMap(title, emoji, color, description?, tags?)`: INSERT into `mindmaps`, then INSERT root node into `nodes`. Return the new `mapId` as `string | null`.
- Implement `updateMap(id, updates)`: UPDATE `mindmaps` WHERE `id`. Optimistically update local `maps[]` state before the Supabase call.
- Implement `deleteMap(id)`: DELETE from `mindmaps` WHERE `id` (cascades to `nodes` and `node_content` via FK). Remove from local `maps[]` state.
- Implement `duplicateMap(id)`: Fetch source map metadata, INSERT a new `mindmaps` row with a modified title (`Copy of ...`). See note in constraints about not duplicating nodes.
- Implement `getMapById(id)`: Return `maps.find(m => m.id === id)` from local state.

### `src/pages/DashboardPage.tsx`
- On mount: call `mapsStore.fetchMaps()`. If offline, call `offlineStore.getOfflineMaps()` and read from IndexedDB.
- Render search input. Filter maps locally by title substring match.
- Render `<MapGrid maps={filteredMaps} />` and a `<CreateMapModal>` trigger button.
- Show an empty state illustration when `maps.length === 0`.

### `src/components/dashboard/MapGrid.tsx`
- Accept `maps: MindmapMeta[]` as a prop
- Render a responsive grid of `<MapCard>` components
- Each card navigates to `/map/:mapId` on click

### `src/components/dashboard/MapCard.tsx`
- Display: `emoji`, `title`, `description`, `tags[]` as pill badges
- Show `node_count` and `completed_count` as `X / Y studied`
- Show a teal progress bar: `width: (completedCount / nodeCount) * 100%`
- Show `created_at` formatted as a relative timestamp
- Three-dot menu with: Open, Rename, Duplicate, Delete
- Call `mapsStore.deleteMap(id)` on delete (with `window.confirm` guard)

### `src/components/dashboard/CreateMapModal.tsx`
- Fields: `title` (required), `emoji` (emoji picker or text input), `color` (color palette — must use `DEFAULT_BRANCH_COLORS` array from `types/index.ts`), `description` (optional), `tags` (comma-separated input → `string[]`)
- Submit calls `mapsStore.createMap(...)`. On success, navigate to `/map/:newMapId`.
- Show `<Loader2>` spinner on submit button while `isLoading`

---

## Verification Checklist

- [ ] Dashboard renders all maps belonging to the authenticated user, ordered by last updated
- [ ] Creating a map navigates to the canvas; the canvas immediately shows a root node with the map's title
- [ ] Deleting a map removes it from the list without a page refresh (optimistic update)
- [ ] Navigating to `/dashboard` while offline shows the IndexedDB-cached map list, not an error
