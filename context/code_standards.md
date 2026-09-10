# Code Standards

> **Context File 3 of 6** · Last updated: 2026-09-10
> Part of the Spec-Driven Agentic Development context system for the MindMap Tool.

---

## 1. TypeScript Conventions

### Compiler Configuration (`tsconfig.app.json`)

The following compiler flags are active and enforced. Every spec must produce code that satisfies all of them.

| Flag | Value | Meaning |
|---|---|---|
| `target` | `ES2023` | Output targets modern JS. No downlevel polyfills. |
| `moduleResolution` | `bundler` | Vite-native resolution. No `node` or `classic` mode. |
| `verbatimModuleSyntax` | `true` | Type-only imports must use `import type`. Side-effect imports are explicit. |
| `noUnusedLocals` | `true` | Dead local variables are compile errors, not warnings. |
| `noUnusedParameters` | `true` | Dead function parameters are compile errors. Prefix unused params with `_`. |
| `noFallthroughCasesInSwitch` | `true` | Every `switch` case must `break`, `return`, or `throw`. |
| `erasableSyntaxOnly` | `true` | No `const enum` or namespace-style imports. |
| `paths` | `"@/*": ["./src/*"]` | Absolute import alias. Use `@/` for any cross-directory src import. |

### Type vs. Interface

- **Use `interface`** for all object shapes that represent domain entities or component props. Interfaces are extensible and produce cleaner error messages.
- **Use `type`** for union types, intersection types, primitives, and tuple aliases.

```typescript
// ✅ Correct — interface for data shapes
interface BranchNodeProps {
  data: {
    node: MindmapNode;
    completedCount: number;
    onContextMenu?: (e: React.MouseEvent, node: MindmapNode) => void;
  };
}

// ✅ Correct — type for unions and primitives
type NodeType = 'root' | 'branch' | 'leaf';
type NodeDirection = 'left' | 'right' | 'top' | 'bottom';
type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed';
```

### Import Style

All type-only imports must use `import type` (enforced by `verbatimModuleSyntax`). Value imports and type imports must not be mixed in the same statement unless using the inline `type` qualifier.

```typescript
// ✅ Correct
import type { MindmapNode, NodeDirection } from '../../types';
import { useMapStore } from '../../store/mapStore';
import { Handle, Position, type EdgeProps } from '@xyflow/react';

// ❌ Wrong — mixing value and type imports without qualifier
import { MindmapNode, useMapStore } from '../../store/mapStore';
```

### Import Path Rules

Use the `@/` alias for any import that crosses a directory boundary into the `src/` tree. Use relative paths only within the same directory.

```typescript
// ✅ Cross-directory — use @/ alias
import RichEditor from '@/components/editor/RichEditor';

// ✅ Same-directory — relative is fine
import { SectionShell } from './SectionShell';

// ❌ Never use deep relative paths across directories
import { useMapStore } from '../../../../../../store/mapStore';
```

### Handling `unknown` and Type Assertions

Never use `as any` to escape the type system. When working with Supabase row data (which returns untyped JSON), define an explicit local type for the row shape and assign to it.

```typescript
// ✅ Correct — explicit row type defined before use
type DbNodeRow = {
  id: string;
  map_id: string;
  label: string;
  parent_id: string | null;
  type: NodeType;
  direction?: NodeDirection | null;
  position_x: number | null;
  position_y: number | null;
};

// ❌ Wrong — escaping with any
const data = result.data as any;
```

### Undefined Parameters

When a function parameter is intentionally unused (e.g., event callbacks in ReactFlow), prefix with `_` to satisfy `noUnusedParameters`:

```typescript
// ✅ Correct
const onMoveEnd = useCallback((_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
  if (mapId) saveViewport(mapId, viewport);
}, [mapId, saveViewport]);
```

### Generic `ApiResult<T>` Pattern

All utility functions that call Supabase and return data to calling code must use the `ApiResult<T>` wrapper defined in `src/types/index.ts`:

```typescript
interface ApiResult<T> {
  data: T | null;
  error: string | null;
}
```

This ensures consistent error propagation without throwing across async boundaries.

---

## 2. Framework Patterns

This is a **React 19 SPA with no server-side rendering**. There are no server components, no server actions, and no Next.js patterns. All components are client-side by default.

### Component Structure

Every component file follows this exact order:

1. **Imports** — framework first, then third-party, then internal stores/types/utils
2. **Interface definition** — prop types declared as `interface` immediately before the component
3. **Named export function** — components are always named exports, never default exports (exception: `App.tsx`)
4. **Internal logic** — hooks, derived state, handlers, then JSX return

```typescript
// ✅ Standard component structure
import { useState, useCallback } from 'react';
import { Eye } from 'lucide-react';
import type { MindmapNode, NodeDirection } from '../../types';
import { useMapStore } from '../../store/mapStore';

interface BranchNodeProps {         // 1. Props interface
  data: { node: MindmapNode };
}

export function BranchNode({ data }: BranchNodeProps) {  // 2. Named export
  const { nodes } = useMapStore();  // 3. Hooks first
  const [isOpen, setIsOpen] = useState(false);           // 4. Local state

  const handleClick = useCallback(() => { ... }, []);    // 5. Handlers

  return ( ... );                                        // 6. JSX last
}
```

### No Default Exports in Components

All components are named exports. This enables IDE auto-imports and prevents accidental re-naming on import. The only exception is `App.tsx`, which Vite's entry requires as a default export.

```typescript
// ✅ Correct
export function NodeEditor({ nodeId }: { nodeId: string }) { ... }

// ❌ Wrong
export default function NodeEditor(...) { ... }
```

### Data Fetching — "Mount and Store" Pattern

This codebase has no dedicated data-fetching layer (no React Query, no SWR). Data is fetched in `useEffect` on component mount, which calls a Zustand store action. The store action calls Supabase and updates reactive state. The component re-renders when the store updates.

```typescript
// ✅ Standard fetch-on-mount pattern
useEffect(() => {
  if (!mapId) return;
  loadMap(mapId);
  loadContent(mapId);
}, [mapId, loadMap, loadContent]);
```

Rules:
- **Do not fetch inside JSX.** No `await` calls inside the render function.
- **Always list all dependencies** in the `useEffect` dependency array. Do not suppress the `react-hooks/exhaustive-deps` rule.
- **Use `useCallback` for all functions** passed to `useEffect` dependency arrays to prevent infinite loops.

### ReactFlow Custom Nodes

All custom node types (`RootNode`, `BranchNode`, `LeafNode`) follow this contract:

- Accept a single `data` prop (typed via a local `interface`).
- The `data` prop carries both the domain object (`node: MindmapNode`) and all event callbacks (`onContextMenu`, `onAddDirectionalChild`, `onPreview`).
- Callbacks are injected in `MindmapCanvas.tsx` via the `interactiveFlowNodes` `useMemo`. Node files themselves have no direct store access for mutation — they call the injected callbacks.
- Handles (`<Handle>`) are always rendered with opacity-0 to hide the ReactFlow default dots while preserving connection logic.

### Prop Drilling vs. Store Access

- **Presentation components** (e.g., `SectionShell`, `LeafNode`) receive all data via props. They do not access Zustand stores directly.
- **Feature components** (e.g., `KeyPointsSection`, `NodeEditor`, `MindmapCanvas`) may call store hooks directly. They are not reusable across contexts.
- **Pages** (`NodePage`, `DashboardPage`) are the top of each route tree. They own initial data loading and pass data/callbacks down to feature components.

### `useCallback` and `useMemo` Usage

- Wrap all event handlers passed as props in `useCallback`. This prevents ReactFlow's internal re-render cycles from firing unnecessarily.
- Use `useMemo` for all derived state that involves array transforms or `buildFlowElements` calls. These are expensive — never compute them inline in JSX.
- Do not over-`useMemo`. Simple string concatenations and boolean derivations do not need memoization.

---

## 3. Styling Standards

### Utility-First: Tailwind Only

All visual styling is expressed exclusively through Tailwind CSS v4 utility classes. Do not write new `.css` files for component styles. Do not use inline `style={{}}` for values expressible as Tailwind classes.

The only legitimate uses of inline `style={{}}` in this codebase:
1. **Dynamic color values** that must be injected from JS variables (e.g., `style={{ borderLeftColor: node.color }}`). Tailwind cannot build classes from runtime values.
2. **ReactFlow-specific positioning** (e.g., `style={{ transform: 'translate(-50%, -50%) translate(${x}px, ${y}px)' }}` for canvas-space elements).

```typescript
// ✅ Correct — Tailwind for all static styles
<div className="bg-[#1e2433] px-4 py-3 rounded-lg border-l-4 border-[#2d3748]">

// ✅ Correct — inline style only for JS-driven dynamic values
<div style={{ borderLeftColor: node.color || '#0d9488' }}>

// ❌ Wrong — inline style for values that could be Tailwind
<div style={{ padding: '12px 16px', borderRadius: '8px' }}>
```

### Color Palette

The codebase uses a dark-mode-first design system. All static color values map to this palette:

| Role | Class / Value | Usage |
|---|---|---|
| Page background | `bg-[#0f1117]` | All full-page backgrounds |
| Card / panel | `bg-[#1e2433]` | Canvas nodes, modal cards |
| Border / divider | `border-[#2d3748]` | All dividers and card borders |
| Interactive hover | `hover:bg-[#2d3748]` | Button hover states on dark bg |
| Text primary | `text-slate-100` | Headings, node labels |
| Text secondary | `text-slate-400` | Descriptions, subtitles |
| Text muted | `text-slate-500` | Timestamps, empty states |
| Accent (primary) | `teal-600` / `teal-500` | CTAs, progress, active states |
| Accent (secondary) | `violet-600` / `#7C3AED` | Edge waypoints, secondary actions |
| Danger | `red-400` / `red-900/30` | Delete actions, error states |
| Success | `green-400` / `green-500` | Completed states |

**Rule:** Never introduce a new arbitrary hex color without documenting it above. The AI agent must not add `bg-[#3a4f6b]`-style values that are not in this palette.

### Arbitrary Values

Tailwind's bracket syntax (`bg-[#0f1117]`, `border-[#2d3748]`) is acceptable for the documented palette colors above. It is not acceptable for one-off values not in the palette. If a new color is genuinely needed, add it to this document first.

### Conditional Class Composition

Use template literals for conditional Tailwind classes. Do not use external `cn()` / `clsx()` utilities — neither is installed in this project.

```typescript
// ✅ Correct — template literal conditional
className={`px-4 py-2 rounded-lg ${isActive ? 'bg-teal-600 text-white' : 'text-slate-400 hover:bg-[#2d3748]'}`}

// ✅ Correct — simple toggle
className={`transition-all ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}

// ❌ Wrong — do not install or use clsx/cn unless added as a dependency
className={cn('px-4 py-2', isActive && 'bg-teal-600')}
```

### Icon Usage

All icons are from `lucide-react`. Import icons as named imports. Always set explicit `className="w-N h-N"` on every icon — never rely on inherited size.

```typescript
// ✅ Correct
import { Eye, Loader2, FileDown } from 'lucide-react';
<Eye className="w-4 h-4" />

// ❌ Wrong — no size class
<Eye />
```

---

## 4. State Management & Hooks

### The Six Store Slices

Each Zustand store owns exactly one domain. Never add state to a store that belongs to another domain:

| Store | Owns | Does NOT own |
|---|---|---|
| `authStore` | `user`, `profile`, session lifecycle | Any map or content data |
| `mapStore` | `nodes[]`, `edgeWaypoints`, `mapId` for current canvas | Map list metadata |
| `mapsStore` | `maps[]` (map list/metadata), CRUD for maps | Node-level data |
| `contentStore` | `content{}`, `saveStatus{}` for all node content | Canvas positions |
| `offlineStore` | `offlineMapIds[]`, `isSyncing` | Online data |
| `settingsStore` | `viewports{}` per mapId, `isReadOnly` flag | Auth, content, maps |

### Store Action Patterns

**Async actions** must set loading state before async work and restore it in `finally`. They must guard against offline state before any Supabase write.

**Synchronous state updates** (like `updateContent`, `addKeyPoint`) must update Zustand state immediately (optimistic) and then schedule a Supabase persist asynchronously. Never block the UI on a network call for a user-initiated edit.

```typescript
// ✅ Correct — optimistic update then async persist
updateContent: (nodeId, updates) => {
  if (!navigator.onLine) { toast.error('...'); return; }

  // 1. Update Zustand state immediately
  set(state => ({
    content: { ...state.content, [nodeId]: { ...curr, ...updates } },
    saveStatus: { ...state.saveStatus, [nodeId]: 'unsaved' }
  }));

  // 2. Persist asynchronously — does not block the caller
  setTimeout(() => { get().retrySave(nodeId); }, 0);
},
```

### Reading Store State in Non-React Contexts

Inside store actions, use `get()` and `useAuthStore.getState()` — never call hooks. Hooks are only valid inside React components.

```typescript
// ✅ Correct — inside a Zustand action
const { user } = useAuthStore.getState();

// ❌ Wrong — hooks cannot be called outside React components
const { user } = useAuthStore(); // This will throw
```

### `useEffect` Rules

1. **Every `useEffect` must have a cleanup function** if it registers an event listener, sets a timer, or starts a subscription.
2. **Never suppress `react-hooks/exhaustive-deps`.** If the dependency array causes an infinite loop, fix the root cause (usually a missing `useCallback` on a function dep).
3. **Limit `useEffect` to three categories:** data loading on mount, event listener registration, and reactive sync between two state sources.
4. **Do not use `useEffect` to derive state.** Use `useMemo` instead.

```typescript
// ✅ Correct — event listener with cleanup
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => { ... };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isTestMode, onToggleTestMode]);

// ✅ Correct — timer with cleanup
useEffect(() => {
  if (status === 'saved') {
    const t = setTimeout(() => setShowSaved(false), 2000);
    return () => clearTimeout(t);
  }
}, [status]);

// ❌ Wrong — deriving state inside useEffect
useEffect(() => {
  setFilteredMaps(maps.filter(m => m.title.includes(query)));
}, [maps, query]);
// ✅ Do this instead: const filteredMaps = useMemo(() => ..., [maps, query]);
```

### No Dedicated `/hooks` Directory

This codebase has no `src/hooks/` directory. Complex component logic that would be a custom hook in other projects is instead handled at the store layer (Zustand actions) or kept co-located inside the component using `useCallback` and `useMemo`. Do not create `src/hooks/` files. If a piece of logic needs to be reused, move it to the relevant Zustand store action or a utility function in `src/utils/`.

### `useRef` for Non-Reactive Values

Use `useRef` for values that must persist across renders but should not trigger re-renders: drag start position snapshots, timer IDs, flag sentinels (like `hasInitViewportRef`), and string comparison caches (like `lastBaseNodesRef`).

```typescript
// ✅ Correct — ref for drag position snapshot (does not need to re-render)
const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

// ✅ Correct — ref to prevent double-initialization
const hasInitViewportRef = useRef(false);
```

---

## 5. Error Handling & Responses

### The `ApiResult<T>` Contract for Utilities

Utility functions in `src/utils/` that wrap Supabase operations and are called by components (not stores) must return `ApiResult<T>` instead of throwing. Throwing across async boundaries produces unhandled promise rejections that bypass the toast system.

```typescript
// ✅ Correct — utility returns ApiResult
export async function inviteFriend(mapId: string, email: string): Promise<ApiResult<null>> {
  const { error } = await supabase.from('map_shares').insert({ ... });
  if (error) return { data: null, error: error.message };
  return { data: null, error: null };
}
```

### Store Action Error Handling

Zustand store actions use `try/catch` blocks. Caught errors are handled in one of two ways:

1. **User-visible errors:** Call `toast.error(message)` and set the relevant error state (e.g., `set({ error: err.message })`).
2. **Silent logging:** Call `console.error(...)` for non-critical errors that should not interrupt the UX (e.g., a failed edge waypoint update should not block the canvas).

```typescript
// ✅ Correct — store action try/catch
createMap: async (title, ...) => {
  set({ isLoading: true, error: null });
  try {
    const { data, error } = await supabase.from('mindmaps').insert(...);
    if (error) throw error;
    await get().fetchMaps();
    return data.id;
  } catch (err: any) {
    set({ error: err.message, isLoading: false });
    return null;
  } finally {
    set({ isLoading: false });
  }
},
```

### Supabase Error Code Handling

When Supabase returns an error, check the `error.code` before deciding how to respond. Never treat all errors as fatal:

| Code | Meaning | Action |
|---|---|---|
| `42P01` | Table does not exist (schema not yet migrated) | Log warn or silently succeed — do not throw |
| `42703` | Column does not exist (schema version mismatch) | Set `supportsDirection: false` and retry without the column |
| `PGRST204` | Column not found in PostgREST schema cache | Same as `42703` |
| `23505` | Unique constraint violation (duplicate insert) | Treat as success or update instead of insert |
| `PGRST116` | No rows found from `.single()` | Expected — handle as empty state, not error |
| `PGRST301` | JWT expired or invalid | Call `authStore.signOut()` to reset session |

```typescript
// ✅ Correct — code-specific handling
if (error.code === '42P01') {
  console.warn('Table not yet migrated. Skipping.');
  return;
}
if (error.code === '23505') {
  // Already exists — update instead
  await supabase.from('map_shares').update({ permission }).match({ ... });
  return { data: null, error: null };
}
```

### Component-Level Error Handling

Components do not catch errors from store actions directly. They observe error state from the store (`error`, `saveStatus`) and render appropriate UI.

The `SaveStatus` pattern in `contentStore` is the canonical model for surfacing async operation state to the UI:

```typescript
type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed';
```

The component renders different UI for each state — a pulsing "Saving..." badge, a green "Saved ✓" flash, or a red "Save failed — Retry" button — without wrapping its JSX in a try/catch.

### Timeout Safeguards

Long async operations that block render (e.g., loading node data on `NodePage`) must implement a timeout via `Promise.race` or `setTimeout` to prevent the UI from hanging on a stalled network call:

```typescript
// ✅ Correct — 5-second timeout guard
timeoutId = setTimeout(() => {
  timedOut = true;
  setLoadError('Could not load this node. Check your connection.');
  setIsLoaded(true);
}, 5000);

// Auth session check — 4-second race
const sessionResult = await Promise.race([
  supabase.auth.getSession(),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Auth session check timed out')), 4000)
  ),
]);
```

### Console Discipline

- `console.error(...)` — reserved for genuine errors: failed Supabase writes, auth failures, unexpected exceptions.
- `console.warn(...)` — for expected-but-notable conditions: missing schema columns, graceful degradation.
- `console.log(...)` — acceptable during development. Must be removed before merging any feature spec. Never leave `console.log` in store actions.

---

*This file is part of the 6-file context system used to maintain AI agent coherence across development sessions. It must be re-read at the start of every new session before issuing any feature spec.*
