# Architecture

> **Context File 2 of 6** · Last updated: 2026-09-10
> Part of the Spec-Driven Agentic Development context system for the MindMap Tool.

---

## 1. Tech Stack & Roles

Each technology has one strict, non-negotiable role. No tool bleeds into another's domain.

| Technology | Strict Role | What It Must Never Do |
|---|---|---|
| **Supabase Auth** | Identity and session management only. Issues JWTs. Persists sessions in `localStorage` via `onAuthStateChange`. | Never be called directly from components. All auth calls route through `authStore`. |
| **Supabase PostgreSQL** | Sole persistent data store. Source of truth for all mindmaps, nodes, node content, profiles, and share metadata. | Never store canvas viewport state or UI preferences (those belong in `settingsStore`). |
| **Supabase RLS Policies** | Database-layer access control. Enforces ownership and public share rules directly in PostgreSQL, independent of any client-side logic. | Never be the only layer for sensitive mutations — the client must also verify auth state before calling Supabase write operations. |
| **`@supabase/supabase-js`** | HTTP client that attaches the user's JWT to every request. Single instance created in `lib/supabase.ts`. | Never be instantiated more than once. Never hold raw secrets beyond `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| **Zustand v5** | All client-side state management. Domain-sliced into six independent stores. The bridge between UI components and Supabase. | Never be bypassed. Components must never call `supabase.*` directly — always through the relevant Zustand store action. |
| **`@xyflow/react` (ReactFlow v12)** | Canvas rendering engine only. Manages the visual graph (nodes, edges, zoom, pan, minimap, selection). | Never be the source of truth for node positions. ReactFlow's internal state is a display concern; position truth lives in Zustand/Supabase. |
| **React Router v7** | Client-side routing and route-level auth gating via `ProtectedRoute`. | Never manage data fetching or business logic. Routes are navigation boundaries only. |
| **`@blocknote/react`** | Rich text editor for per-node `richContent` block arrays. Isolated to `RichEditor.tsx`. | Never render outside the node editor panel. Never be used for simple text fields — those use plain `<input>` or `<textarea>`. |
| **`idb-keyval`** | IndexedDB abstraction for offline snapshot storage only. Wrapped in `lib/offlineStore.ts`. | Never be used for primary data access when the device is online. It is a read-only fallback, not a sync layer. |
| **`vite-plugin-pwa` + Workbox** | Static asset precaching and service worker lifecycle management. | Never cache dynamic API responses from Supabase. Only caches compiled JS/CSS/HTML/image assets. |
| **`jsPDF` + `html2canvas`** | Client-side PDF export only. Called from `exportPDF.ts` and `exportBranchToPdf.ts`. | Never run during a Supabase write operation. Export is purely a read/render operation. |
| **Tailwind CSS v4** | All visual styling via utility classes. Applied directly to JSX elements. | Never use arbitrary inline `style={{}}` for values that can be expressed as Tailwind classes. No external `.css` files except `index.css` (global resets and ReactFlow overrides) and `App.css`. |

---

## 2. System Boundaries

This is a **fully client-side SPA with no custom backend server**. There are no API routes, no Express/Fastify/Next.js server functions, and no serverless functions. All server-side logic is handled by Supabase's managed infrastructure.

### Where Logic Lives

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  ┌──────────────┐   ┌──────────────────────────────────────┐   │
│  │   React UI   │   │         Zustand Stores               │   │
│  │  Components  │──▶│  authStore  │ mapStore │ mapsStore   │   │
│  │  (pages/,   │   │  contentStore │ offlineStore          │   │
│  │ components/) │   │  settingsStore                       │   │
│  └──────────────┘   └───────────────┬──────────────────────┘   │
│                                     │                           │
│  ┌──────────────────────────────┐   │                           │
│  │    lib/supabase.ts           │◀──┘                           │
│  │  Single Supabase client      │                               │
│  │  (JWT auto-attached)         │                               │
│  └──────────────┬───────────────┘                               │
│                 │                                               │
│  ┌──────────────▼───────────────┐                               │
│  │  lib/offlineStore.ts         │                               │
│  │  idb-keyval (IndexedDB)      │ ← offline snapshot read path  │
│  └──────────────────────────────┘                               │
│                                                                 │
│  ┌──────────────────────────────┐                               │
│  │  settingsStore (Zustand)     │ ← in-memory only, no persist  │
│  │  Viewport positions per mapId│   (resets on page reload)     │
│  └──────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                         │  HTTPS + JWT
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE (Managed)                         │
│                                                                 │
│   ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐  │
│   │  Auth Server │   │  PostgreSQL  │   │   RLS Policies    │  │
│   │  (JWT issuer)│   │  (5 tables)  │   │  (enforce ownership│  │
│   └──────────────┘   └──────────────┘   │   + public share) │  │
│                                         └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │  Vite build
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL (Deployment)                           │
│   Static SPA bundle (HTML/JS/CSS/assets)                        │
│   vercel.json: catch-all rewrite → /index.html                  │
│   Service worker: Workbox precaches all static assets           │
└─────────────────────────────────────────────────────────────────┘
```

### Auth Boundary (Route Gating)

`App.tsx` wraps all authenticated routes inside a single `<ProtectedRoute>` outlet:

```
Public routes (no auth required):
  /                 → LandingPage
  /login            → LoginPage
  /register         → RegisterPage
  /share/:token     → SharedMapPage  ← uses RLS, not ProtectedRoute

Protected routes (ProtectedRoute checks useAuthStore.user):
  /dashboard        → DashboardPage
  /settings         → SettingsPage
  /map/:mapId       → MindmapPage → MindmapCanvas
  /map/:mapId/node/:nodeId → NodePage
```

`ProtectedRoute` reads `useAuthStore().user` and `isLoading`. If `isLoading` is true (session hydration in progress), it renders a spinner. If `user` is null after hydration, it redirects to `/login`. This prevents any authenticated data fetch from firing before the session is confirmed.

### Data Flow Per Operation

| Operation | Initiator | Store Method | Supabase Table | RLS Check |
|---|---|---|---|---|
| Load map list | `DashboardPage` mount | `mapsStore.fetchMaps()` | `mindmaps` WHERE `user_id = auth.uid()` | ✅ Owner only |
| Load canvas | `MindmapCanvas` mount | `mapStore.loadMap()` | `nodes`, `mindmaps` WHERE `map_id` | ✅ Owner only |
| Load node content | `MindmapCanvas`/`NodePage` mount | `contentStore.loadContent()` | `node_content` WHERE `map_id` | ✅ Owner only |
| Save node position (drag) | `onNodeDragStop` | `mapStore.saveBatchChanges()` | `nodes` UPDATE | ✅ Owner only |
| Save edge waypoints | `WaypointEdge.onPointerUp` | `mapStore.updateEdgeWaypoints()` | `mindmaps` UPDATE `edge_waypoints` | ✅ Owner only |
| Save node content | `NodeEditor` debounced | `contentStore.updateContent()` | `node_content` UPSERT | ✅ Owner only |
| View shared map | `/share/:token` (no auth) | Direct `supabase.from()` call | `mindmaps`, `nodes`, `node_content` | ✅ Public RLS by token |

---

## 3. Storage Model

### Database Tables (PostgreSQL via Supabase)

The data model is **relational, not JSON-first**. Nodes are individual rows in a `nodes` table, not embedded arrays. This enables row-level RLS enforcement per node and efficient single-node updates without rewriting the entire map.

#### `mindmaps`
The map registry. One row per user-created mind map.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Auto-generated |
| `user_id` | `uuid` FK → auth.users | Owner identity |
| `title` | `text` | Map display name |
| `description` | `text` | Optional |
| `emoji` | `text` | Single emoji character |
| `color` | `text` | Hex accent color |
| `tags` | `text[]` | PostgreSQL array |
| `is_public` | `boolean` | Share toggle |
| `share_token` | `text UNIQUE` | nanoid(21), null when not shared |
| `edge_waypoints` | `jsonb` | `Record<string, Waypoint[]>` — keyed by `"parentId-childId"` |
| `node_count` | `int` | Denormalized counter |
| `completed_count` | `int` | Denormalized counter |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

> **Design decision:** `edge_waypoints` is stored as a `jsonb` blob on the `mindmaps` row rather than a separate table. Rationale: waypoints are always loaded and saved as a unit with the map. A separate join would add latency on every canvas load for a feature with no independent query requirements.

#### `nodes`
One row per node. Parent-child relationships are expressed with `parent_id` (self-referencing FK).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `map_id` | `uuid` FK → mindmaps | |
| `user_id` | `uuid` FK → auth.users | Redundant with mindmaps but required for RLS |
| `label` | `text` | Node display text |
| `type` | `text` | Enum: `root`, `branch`, `leaf` |
| `parent_id` | `uuid` FK → nodes (nullable) | Null for root node only |
| `order_index` | `int` | Sibling sort order |
| `color` | `text` | Hex border/text color |
| `bg_color` | `text` | Hex background color |
| `emoji` | `text` | Optional node emoji |
| `direction` | `text` | `left`, `right`, `top`, `bottom` — added in schema v2 |
| `position_x` | `float8` | Canvas X coordinate |
| `position_y` | `float8` | Canvas Y coordinate |

> **Design decision:** Node positions are stored as flat `position_x` / `position_y` columns, not a JSON object. This enables individual column updates without deserializing the row. The `direction` column was added post-MVP; a `supportsDirection` flag in `mapStore` handles backward compatibility with older Supabase instances that lack the column.

#### `node_content`
One row per node. Contains all structured learning content. Created lazily on first edit.

| Column | Type | Notes |
|---|---|---|
| `node_id` | `uuid` FK → nodes | One-to-one relationship |
| `map_id` | `uuid` FK → mindmaps | Denormalized for RLS |
| `rich_content` | `jsonb` | BlockNote block array |
| `definition` | `text` | |
| `key_points` | `jsonb` | `Array<{id, text, order}>` |
| `mental_model` | `text` | |
| `good_example` | `text` | |
| `bad_example` | `text` | |
| `notes` | `text` | |
| `resources` | `jsonb` | `Array<{id, title, url?, note?}>` |
| `is_completed` | `boolean` | |
| `completed_at` | `timestamptz` | |
| `last_edited` | `timestamptz` | |
| `created_at` | `timestamptz` | |

#### `profiles`
User profile extension. Linked 1:1 to `auth.users`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` FK → auth.users | |
| `display_name` | `text` | |
| `avatar_url` | `text` | |
| `created_at` | `timestamptz` | |

#### `map_shares`
Per-user invite table. Tracks email-based sharing intent with permission level.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `map_id` | `uuid` FK → mindmaps | |
| `shared_by_user_id` | `uuid` FK → auth.users | |
| `shared_with_email` | `text` | |
| `permission` | `text` | Enum: `view`, `edit` |
| `accepted` | `boolean` | |
| `created_at` | `timestamptz` | |

### Offline Storage (IndexedDB via `idb-keyval`)

When a user toggles offline access for a map, the following keys are written to IndexedDB:

| Key | Value Type | Contents |
|---|---|---|
| `offline_maps` | `string[]` | List of all offline-pinned map IDs |
| `map_meta_{mapId}` | `MindmapMeta` | Full map metadata object |
| `map_nodes_{mapId}` | `MindmapNode[]` | All nodes for the map |
| `map_content_{mapId}` | `Record<string, NodeContent>` | All node content keyed by `nodeId` |

This is a **point-in-time snapshot**. It is not synced back to Supabase. Writes are blocked while offline. The snapshot is invalidated only when the user manually removes offline access.

### Export Format (JSON)

The full workspace export uses a versioned `ExportedMap` type:

```typescript
interface ExportedMap {
  exportVersion: '2.0.0';
  exportedAt: string;
  meta: MindmapMeta;
  nodes: MindmapNode[];
  content: Record<string, NodeContent>;
}
```

The `exportVersion` field enables forward-compatible import logic if the schema changes in future releases.

---

## 4. Integration Rules

### Auth → Data Access

1. **Session is established before any data fetch.** `authStore` initializes with a `Promise.race` between `supabase.auth.getSession()` and a 4-second timeout. `isLoading` stays `true` during this window. `ProtectedRoute` blocks all route rendering until `isLoading` is `false`.

2. **The JWT is attached automatically.** `lib/supabase.ts` creates a single `supabaseClient` instance. `@supabase/supabase-js` reads the stored session and attaches the `Authorization: Bearer <JWT>` header to every request automatically. No component manually handles tokens.

3. **RLS enforces ownership at the database layer.** Even if client-side auth checks are bypassed (e.g., by a crafted direct API call), the PostgreSQL RLS policies reject unauthorized reads and writes. The client check and the database check are independent, non-redundant layers.

### Auth → Store Communication

`authStore` exposes `user` (the Supabase `User` object) as reactive state. Other stores access auth identity via `useAuthStore.getState().user` — a direct, synchronous snapshot read — rather than subscribing. This prevents cascade re-renders when unrelated auth state changes.

```typescript
// Correct pattern — used in mapsStore, mapStore, contentStore
const { user } = useAuthStore.getState();
if (!user) return;
```

### ReactFlow → Zustand (Canvas State Sync)

ReactFlow's internal node state and Zustand's `mapStore.nodes` are intentionally separate:

- **ReactFlow's `useNodesState`** owns the live, frame-accurate positions during drag. This is the display layer.
- **Zustand `mapStore.nodes`** owns the persisted positions. This is the truth layer.
- **On `onNodeDragStop`**: `saveBatchChanges()` performs an **optimistic update** — it immediately updates Zustand state with the new positions, then persists to Supabase in the background. A final re-fetch reconciles any discrepancies.
- **`baseFlowNodes` sync**: A `useEffect` in `MindmapCanvas` watches for structural changes (new/deleted nodes) from `mapStore.nodes` and re-syncs ReactFlow's state, preserving live drag positions via `prevPos.get(node.id)` to avoid flicker.

### Supabase → Offline Fallback

Every Supabase read in `mapStore` and `contentStore` is gated by `navigator.onLine`:

```
navigator.onLine === false
  → offlineStore.isMapOffline(mapId) === true  → read from IndexedDB
  → offlineStore.isMapOffline(mapId) === false → toast.error, abort
navigator.onLine === true
  → fetch from Supabase normally
```

All write operations (`addNode`, `updateNode`, `deleteNode`, `updateContent`) check `navigator.onLine` and return early with a `toast.error` if offline. There is no write queue or conflict resolution — offline access is read-only by design.

---

## 5. System Invariants

These are the unbreakable architectural rules. The AI coding agent must never violate them, regardless of the feature being built.

---

**INVARIANT 1 — Single Supabase client, always from `lib/supabase.ts`.**

The Supabase client is instantiated exactly once in `src/lib/supabase.ts`. Every store and utility that needs to talk to Supabase must import `{ supabase }` from this file. Never call `createClient()` in a component, a page, or any other utility file. Multiple instances would create separate session contexts and break JWT attachment.

```typescript
// ✅ Correct
import { supabase } from '../lib/supabase';

// ❌ Never do this
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key); // inside a component or utility
```

---

**INVARIANT 2 — Components never call Supabase directly. All data operations go through Zustand stores.**

The only exception is `SharedMapPage.tsx`, which makes direct `supabase.from()` calls because it operates outside the authenticated store context (no user, read-only, token-gated by RLS). Every other page and component must call a Zustand store action. This ensures all data operations are centrally testable, observable, and protected by the `navigator.onLine` guard and auth checks.

```typescript
// ✅ Correct — component calls store
const { addNode } = useMapStore();
await addNode(parentId, label, 'branch');

// ❌ Never do this — component calling Supabase directly
await supabase.from('nodes').insert({ ... });
```

---

**INVARIANT 3 — ReactFlow's internal state is never the source of truth for node positions.**

Node positions must always be read from `mapStore.nodes` (or the Supabase `nodes` table) for any persistent operation. ReactFlow's `flowNodes` state is a display-only representation. Using `flowNodes[n].position` as the input to a Supabase write is acceptable only within `onNodeDragStop` (where the live position is the intended new value). Never derive data structures or business logic from ReactFlow's state.

---

**INVARIANT 4 — The `NodeType` union is fixed at `'root' | 'branch' | 'leaf'`. No new types without a full architecture review.**

The `NodeType` type in `src/types/index.ts` is referenced in the database schema, the tree layout algorithm (`treeLayout.ts`), all three custom node renderers (`RootNode`, `BranchNode`, `LeafNode`), the context menu, and the `nodeTypes` mapping passed to ReactFlow. Adding a fourth type touches every one of these systems simultaneously. Any request to add a new node type must be treated as a cross-cutting concern and planned as a dedicated spec, not a quick patch.

---

**INVARIANT 5 — All write operations must guard against offline state. Silent failures are not acceptable.**

Every store method that mutates data in Supabase must begin with an `if (!navigator.onLine)` check and respond with a `toast.error(...)` call before returning. Silently proceeding with a write while offline will appear to succeed on the client (optimistic update) but the change will be lost and will not sync — creating data loss that is invisible to the user. The offline guard is mandatory, not optional.

```typescript
// ✅ Correct — required pattern for all write methods
addNode: async (parentId, label, type, ...) => {
  if (!navigator.onLine) {
    toast.error('Cannot add nodes while offline');
    return;
  }
  // ... Supabase insert
}
```

---

*This file is part of the 6-file context system used to maintain AI agent coherence across development sessions. It must be re-read at the start of every new session before issuing any feature spec.*
