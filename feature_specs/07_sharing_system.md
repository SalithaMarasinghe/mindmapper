# SPEC-07: Sharing System & Public RLS

> **Status:** DONE
> **Session:** 9
> **Tracker ref:** SPEC-07

---

## Goal

Implement token-based public map sharing. Any authenticated user can generate a cryptographically random link to their map. Anyone with the link — including unauthenticated users — can view the map in a read-only canvas without logging in. The owner can revoke the link at any time.

---

## Design / Technical Constraints

- **Token generation:** Use `nanoid(21)` from the `nanoid` package. 21 characters = 126 bits of entropy. Store as `share_token TEXT UNIQUE` on the `mindmaps` row.
- **RLS enforcement:** Access control is database-level. The three public SELECT policies in `share_link_setup.sql` (applied in SPEC-02) enable unauthenticated reads on `mindmaps`, `nodes`, and `node_content` for any row where `share_token IS NOT NULL`. No server-side middleware is involved.
- **`SharedMapPage` is the ONLY component allowed to call Supabase directly.** It operates without an auth context and cannot use Zustand stores that depend on `useAuthStore.getState().user`. Manage all state in local React `useState`.
- **Read-only enforcement:** `SharedMapPage` must pass `readOnly={true}` to all node `data` objects. When `readOnly === true`, nodes must call `onPreview?.(node)` instead of navigating to `/map/:mapId/node/:nodeId`. The `QuickPreviewModal` must render with `showOpenButton={false}`.
- **`isReadOnly` in `settingsStore`:** `settingsStore.isReadOnly` must be set to `true` when `SharedMapPage` mounts and reset to `false` when it unmounts. This flag is checked in `MindmapCanvas` context menus and `NodeEditor` to disable all write actions.
- **Share/Revoke from canvas:** The share popover in `CanvasToolbar` allows generating and revoking the share link. Both operations call Supabase directly in `CanvasToolbar.tsx` (acknowledged as a technical debt item — should be moved to a store action in a future cleanup).
- **URL format:** `${window.location.origin}/share/${token}`
- **Clipboard:** After generating a link, write to `navigator.clipboard.writeText(url)` and show a `toast.success('Link copied to clipboard ✓')`.

---

## Implementation Steps

### `src/utils/sharing.ts`
- Implement `generateShareLink(mapId)`: UPDATE `mindmaps` SET `share_token = nanoid(21), is_public = true` WHERE `id = mapId`. Return the full share URL.
- Implement `revokeShareLink(mapId)`: UPDATE `mindmaps` SET `share_token = null, is_public = false`.
- Implement `inviteFriend(mapId, email, permission)`: INSERT into `map_shares`. On error code `'23505'` (duplicate), UPDATE the existing row's `permission` instead.
- Implement `removeInvite(shareId)`: DELETE from `map_shares` WHERE `id`.
- Implement `getShares(mapId)`: SELECT `*` FROM `map_shares` WHERE `map_id`.

### `src/pages/SharedMapPage.tsx`
- Extract `token` from `useParams()`
- On mount, query Supabase directly (no auth): `supabase.from('mindmaps').select('*').eq('share_token', token).single()`
- If map not found or error: render a centered "Map not found or link expired" error message
- If found: fetch `nodes` WHERE `map_id`, fetch `node_content` WHERE `map_id`
- Render a full `<ReactFlow>` canvas using the same `nodeTypes` and `buildFlowElements()` as `MindmapCanvas`
- Pass `readOnly: true` in every node's `data` prop
- Render `<MiniMap>`, `<Controls>`, `<Background>` — same config as authenticated canvas
- Show a "Shared by [ownerName]" banner at the top
- Mount `<QuickPreviewModal>` with `showOpenButton={false}` when a node is clicked
- On mount: call `settingsStore.getState().toggleReadOnly()` if `isReadOnly === false`. On unmount: reset.

### `src/components/mindmap/QuickPreviewModal.tsx`
- Props: `node: MindmapNode`, `breadcrumb: string[]`, `content: NodeContent | null`, `isLoading: boolean`, `onClose: () => void`, `showOpenButton?: boolean`
- Use `createPortal(...)` to render into `document.body`
- Backdrop uses CSS class `.preview-modal-backdrop` (defined in `index.css`)
- Modal box uses CSS class `.preview-modal-box`
- Close on Escape key: `useEffect` with `window.addEventListener('keydown', ...)` and cleanup
- Close on backdrop click
- Header: `node.label`, breadcrumb path (`breadcrumb.join(' > ')`), completion badge
- Body: `<RichEditor>` in `readOnly` mode if `content.richContent.length > 0`; skeleton loaders if `isLoading`; empty state message if no content
- Footer: "Open Full Page →" button (navigates to `/map/:mapId/node/:nodeId`) — hidden when `showOpenButton === false`
- Animation: `animate-in fade-in zoom-in-95 duration-200` on the modal box

### `src/components/mindmap/CanvasToolbar.tsx` (update)
- Add share button to the right action group: `<Share className="w-4 h-4" /> Share`
- On click: call `handleShare()` — generates token via direct Supabase call, writes URL to clipboard, opens share popover
- Share popover: `w-80 bg-[#1e2433] border border-[#2d3748] rounded-xl shadow-xl p-3`
  - Read-only URL input (`bg-[#0f1117] border border-[#2d3748] rounded-lg px-3 py-2 text-slate-300`)
  - "Revoke link" button in red: `text-red-400 hover:text-red-300` with `<Link2Off>` icon

---

## Verification Checklist

- [ ] Clicking "Share" in `CanvasToolbar` copies a URL to the clipboard and opens the share popover
- [ ] Opening the share URL in an incognito browser window (no session) renders the full canvas with all nodes visible
- [ ] Node clicks in shared view open the `QuickPreviewModal` — the "Open Full Page" button is NOT visible (read-only mode)
- [ ] Clicking "Revoke link" in the popover causes the share URL to return a "Map not found" error on next load
