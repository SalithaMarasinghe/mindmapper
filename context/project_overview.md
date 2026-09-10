# Project Overview

> **Context File 1 of 6** · Last updated: 2026-09-10
> Part of the Spec-Driven Agentic Development context system for the MindMap Tool.

---

## 1. Summary

MindMap Tool is a full-stack, spatial knowledge-mapping application that lets authenticated users construct hierarchical mind maps on an infinite canvas, enrich each node with structured learning content (definition, key points, mental models, worked examples, resources, and rich text), and share the resulting map publicly via a token-secured read-only URL. The core value proposition is the elimination of the Miro/Notion split: users no longer need a whiteboard tool for the spatial view *and* a document tool for the detailed content — every node on the canvas is simultaneously a navigable knowledge object. The application is deployed as a Progressive Web App on Vercel, backed by Supabase for authentication and persistence, and is capable of functioning offline for maps that have been explicitly cached to IndexedDB.

---

## 2. Goals

1. Allow users to register and authenticate with email/password credentials managed entirely by Supabase Auth, with session persistence across browser reloads via `onAuthStateChange`.
2. Allow authenticated users to create, rename, tag, emoji-label, duplicate, and delete named mind maps from a personal dashboard.
3. Render each mind map as a spatial, interactive node graph on an infinite canvas (powered by ReactFlow), where nodes are draggable, connectable, and persist their exact `(x, y)` positions and branch direction to the database.
4. Support a three-tier node hierarchy — `root → branch → leaf` — with independent type-specific rendering and interaction rules for each tier.
5. Allow per-node rich structured content to be authored and saved: definition, key points (ordered list), mental model, good/bad examples, free-form notes, external resource links, and a BlockNote-powered rich text editor block.
6. Allow users to mark leaf nodes as "completed" and track progress (completed count vs. total node count) visible at the map and branch level.
7. Allow users to generate a public read-only share link for any map, backed by a cryptographically random `nanoid` token and enforced by Supabase Row Level Security policies at the database layer.
8. Allow users to export any map or individual branch to a formatted PDF document using `jsPDF` + `html2canvas`.
9. Allow users to export the entire workspace (all maps, all node content) as a structured JSON file and re-import it, enabling full data portability.
10. Allow users to pin specific maps for offline access, snapshotting all nodes and content into IndexedDB via `idb-keyval`, with graceful read-only degradation when the device is offline.
11. Support edge waypoints — user-draggable control points on any node connection line — persisted as a JSON blob on the parent `mindmaps` row.

---

## 3. Core User Flow

```
[1] Landing Page
    └── User arrives at the marketing/landing page (LandingPage.tsx)
        → CTA: "Get Started" or "Login"

[2] Authentication
    └── Register (email + password + display name) or Sign In
        → authStore.signUp() or authStore.signIn()
        → Supabase Auth issues JWT; session stored in browser
        → Auto-redirect to Dashboard on success

[3] Dashboard
    └── User sees their personal map library (DashboardPage.tsx + MapGrid)
        → mapsStore.fetchMaps() queries mindmaps WHERE user_id = current user
        → User can: search maps, create a new map, open an existing map,
          duplicate, delete, or toggle offline access per map

[4] Create Map
    └── CreateMapModal: user sets title, emoji, accent color, tags, description
        → mapsStore.createMap() inserts into mindmaps table
        → Automatically inserts a root node into nodes table (type: 'root')
        → Navigates to /map/:mapId

[5] Canvas (Mindmap View)
    └── MindmapCanvas.tsx loads at /map/:mapId
        → mapStore.loadMap() fetches all nodes + edge_waypoints for this map
        → contentStore.loadContent() fetches all node_content rows for this map
        → buildFlowElements() transforms MindmapNode[] into ReactFlow nodes/edges
        → Saved viewport (pan/zoom) restored from settingsStore (localStorage)

[6] Node Manipulation on Canvas
    └── User interacts with the canvas:
        → Right-click node → NodeContextMenu → Add child branch/leaf,
          change color, rename, delete, move to another parent
        → Drag node → dragStartPositionsRef tracks start positions
          → onNodeDragStop → mapStore.saveBatchChanges() (optimistic update
          then background Supabase persist)
        → Click node → navigate to /map/:mapId/node/:nodeId (NodePage)
        → Drag edge midpoint → WaypointEdge creates/moves control points
          → onPointerUp → mapStore.updateEdgeWaypoints()

[7] Node Content Editor
    └── NodePage.tsx at /map/:mapId/node/:nodeId
        → Loads map metadata + node list + node content
        → NodeEditor renders structured content fields:
          Definition, Key Points, Mental Model, Good/Bad Examples,
          Notes, Resources, Rich Text (BlockNote editor)
        → contentStore.updateContent() debounces saves to node_content table
        → User can mark node as "Complete" (isCompleted flag)
        → Keyboard nav: left/right arrows move between sibling nodes

[8] Sharing
    └── Share button on CanvasToolbar
        → generateShareLink() sets is_public=true, share_token=nanoid(21)
          on the mindmaps row
        → Produces URL: /share/:token
        → Anyone with the link opens SharedMapPage.tsx (no auth required)
        → Supabase RLS allows public SELECT on maps with non-null share_token
        → revokeShareLink() sets is_public=false, share_token=null

[9] Export / Settings
    └── SettingsPage.tsx at /settings
        → Profile: update display name
        → Appearance: theme (light/dark/system), font size
        → Data: export all maps as JSON, import from JSON file
        → Account: delete account (removes all data), sign out

[10] Offline Access
    └── User toggles offline for a specific map (via canvas toolbar or settings)
        → offlineStore.toggleOffline() fetches all nodes + content from Supabase
        → Saves snapshot to IndexedDB via idb-keyval
        → On next load with no network: mapStore.loadMap() detects navigator.onLine === false
          → reads from IndexedDB instead of Supabase
        → All write operations are blocked offline (toast warning shown)
```

---

## 4. Tech Stack & Tooling

| Technology | Role | Why This Choice |
|---|---|---|
| **React 19** | UI framework | Concurrent rendering; latest stable with full TypeScript support |
| **TypeScript 6 (strict)** | Language | Strict mode enforced across all stores, types, and component props. Prevents the category of AI-generated bugs that come from loose typing. |
| **Vite 8** | Build tool & dev server | Sub-second HMR; native ES modules; PWA plugin support |
| **Tailwind CSS v4** | Styling | Utility-first prevents style drift across AI-generated components. No custom CSS files except for canvas-specific overrides. |
| **React Router v7** | Client-side routing | File-based route structure: `/`, `/login`, `/register`, `/dashboard`, `/map/:mapId`, `/map/:mapId/node/:nodeId`, `/share/:token`, `/settings` |
| **`@xyflow/react` v12 (ReactFlow)** | Canvas engine | Production-grade graph rendering library. Handles node/edge layout, zoom, pan, minimap, and custom node types out of the box. Chosen over D3 to avoid building pan/zoom/selection infrastructure manually. |
| **Zustand v5** | Client state management | Domain-sliced stores (authStore, mapStore, mapsStore, contentStore, offlineStore, settingsStore). Each store owns one concern. Zustand's selector pattern avoids unnecessary re-renders when unrelated state changes. |
| **Supabase (PostgreSQL + Auth + RLS)** | Backend-as-a-service | Auth, database, and access control in a single managed platform. Row Level Security policies enforce data isolation at the DB layer — no custom API server required. |
| **`@blocknote/react` v0.47** | Rich text editor | Notion-style block editor with slash-commands. Chosen over Tiptap or Quill for its built-in block types and React 19 compatibility. |
| **`idb-keyval`** | Offline storage | Minimal IndexedDB wrapper. Stores full map snapshots (meta + nodes + content) for offline access. |
| **`vite-plugin-pwa` + Workbox** | PWA / installability | Precaches all static assets (JS, CSS, HTML, icons) up to 5MB. Enables "Add to Home Screen" and service worker auto-update. |
| **`jsPDF` + `html2canvas`** | PDF export | Renders the ReactFlow canvas and individual branch subtrees to client-side PDF. No server-side rendering required. |
| **`nanoid`** | Token generation | 21-character URL-safe random tokens for share links. Collision probability is negligible at any realistic user scale. |
| **`lucide-react`** | Icon library | Consistent, tree-shakeable icon set. All icons are SVG components. |
| **`react-hot-toast`** | Notification system | Lightweight, non-blocking toast system. Used for all user-facing operation feedback (save, error, offline toggle). |
| **Vercel** | Hosting & deployment | Zero-config deployment for Vite SPAs. `vercel.json` catch-all rewrite handles React Router client-side routing. |

---

## 5. Out of Scope (Deliberate MVP Exclusions)

The following features do **not** exist in the codebase and were deliberately excluded to keep the MVP scope disciplined:

1. **Real-time collaborative editing.** There are no WebSocket subscriptions, no Supabase Realtime channels, and no multi-cursor presence logic. Sharing is read-only. Two users cannot co-edit the same map simultaneously. Adding this would require conflict resolution (CRDT or OT) and a fundamentally different state model.

2. **AI-generated node content.** There are no calls to any LLM API (OpenAI, Gemini, Anthropic). The tool is AI-*built*, not AI-*powered*. Automated content generation, node suggestion, and semantic clustering were all explicitly deferred — they require prompt engineering, streaming UI, and API cost management that are out of MVP scope.

3. **Granular role-based access control (RBAC).** There is a `map_shares` table and an `inviteFriend()` utility, but there are no org-level roles, no workspace admin controls, and no permission hierarchy beyond the binary `view | edit` intent on a per-invite basis. Enterprise-grade RBAC (org admin, billing admin, read-only viewer, edit collaborator) is deferred.

4. **Billing, subscriptions, and usage limits.** There is no payment gateway integration (Stripe, Paddle, etc.), no plan tiers, no feature flags behind a paywall, and no usage metering. The entire product functions without any monetization layer — this is a deliberate MVP boundary.

---

## 6. Success Criteria

These are the binary tests that prove the MVP is functional. All must pass on a live production URL against a fresh browser session with no cached state:

| # | Criterion | Pass Condition |
|---|---|---|
| **SC-1** | Auth works end-to-end | A new user registers with email/password, the session persists on page reload, and the dashboard loads their (initially empty) map library. |
| **SC-2** | Canvas creates and persists a full node tree | User creates a map, adds at least one branch and two leaf nodes via the context menu, drags nodes to new positions, closes the tab, reopens `/map/:mapId` — all nodes appear in the exact saved positions. |
| **SC-3** | Node content saves and is retrievable | User opens a leaf node, fills in the Definition and at least two Key Points, closes the node editor, reopens it — all content is intact with no data loss. |
| **SC-4** | Share link works without authentication | User generates a share link from the canvas toolbar, opens it in an incognito browser window (no active session), and the full read-only canvas renders with all nodes visible. |

---

*This file is part of the 6-file context system used to maintain AI agent coherence across development sessions. It must be re-read at the start of every new session before issuing any feature spec.*
