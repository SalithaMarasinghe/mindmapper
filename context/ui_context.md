# UI Context

> **Context File 4 of 6** · Last updated: 2026-09-10
> Part of the Spec-Driven Agentic Development context system for the MindMap Tool.
> **AI Agent Rule:** Never introduce a color, font, shadow, or border-radius that is not documented in this file. If a new token is genuinely needed, add it here first, then use it.

---

## 1. Theme Overview

**Aesthetic:** Dark-mode-first, technical productivity tool. Dense information display optimized for a canvas-based spatial UI. The visual language is inspired by professional dev tooling (VS Code, Linear, Vercel Dashboard) — high-contrast dark surfaces, subdued borders, teal as the primary action color, and violet as the canvas accent.

**Light mode status:** Not implemented and explicitly excluded from MVP scope. There is no `prefers-color-scheme` media query in the CSS, no dark/light class toggle, and no CSS variable that switches based on system theme. The `settingsStore.theme` field exists in state but is not wired to any CSS application logic. **Do not add light-mode variants to components.**

**Exception — Node Content Editor (`NodePage` / `NodeEditor`):** The structured content sections (Definition, Key Points, Mental Model, etc.) render on a white (`bg-white`) card surface with light-mode typography (`text-gray-800`, `border-gray-200`). This is intentional — it creates a deliberate visual context switch between the dark canvas (spatial, navigational) and the bright editor (reading, writing). This is the only surface in the app that uses light-background styling.

**Typography style:** Clean, readable, sans-serif. No decorative or serif fonts. The body font is `Satoshi` (loaded externally). Fallback is the system `sans-serif` stack.

**Animation philosophy:** Micro-interactions only. `transition-all` with `duration-100`–`duration-300`. No page-level transitions. No loading skeletons beyond `animate-pulse` divs. No third-party animation libraries.

---

## 2. Color Palette (Design Tokens)

### Tailwind v4 `@theme` tokens (defined in `src/index.css`)

These are registered as Tailwind CSS v4 theme tokens via the `@theme {}` block. They are available as utility classes (`bg-paper`, `text-ink`, etc.) but are currently used only in the legacy `App.css` scaffolding. Do not use them for new components — use the explicit hex values documented below instead.

```css
@theme {
  --color-paper:      #F3F1EC;   /* Warm off-white — not used in dark UI */
  --color-ink:        #1C2230;   /* Deep navy — not used in dark UI */
  --color-ink-soft:   #5B6472;   /* Muted slate — not used in dark UI */
  --color-root:       #E8A33D;   /* Amber — not used (see Root Node below) */
  --color-branch:     #2F8F84;   /* Teal-ish — not used directly */
  --color-leaf:       #6E6ADE;   /* Violet — not used directly */
}
```

> These tokens were set up during scaffolding but the live application uses the hex values below directly in Tailwind classes. Do not reference `var(--color-root)` in new code; use the canonical hex values.

---

### Canonical Color Palette (Use These)

#### Backgrounds

| Token | Hex | Tailwind Class | Usage |
|---|---|---|---|
| **Page BG** | `#0f1117` | `bg-[#0f1117]` | All full-page backgrounds, canvas pane, ReactFlow background |
| **Surface 1** | `#1e2433` | `bg-[#1e2433]` | Cards, modals, node backgrounds, side panel, minimap, context menu |
| **Surface 2** | `#1a2030` | `bg-[#1a2030]` | Preview modal content area only |
| **Surface Hover** | `#2d3748` | `hover:bg-[#2d3748]` | Button hover states on dark backgrounds |
| **Input BG** | `#0f1117` | `bg-[#0f1117]` | Read-only inputs, share URL input |
| **Overlay** | `rgba(0,0,0,0.75)` | CSS only | Preview modal backdrop |
| **Canvas Overlay** | `rgba(15,17,23,0.75)` | CSS only | MiniMap mask color |

#### Borders & Dividers

| Token | Hex | Tailwind Class | Usage |
|---|---|---|---|
| **Border Default** | `#2d3748` | `border-[#2d3748]` | All cards, panels, inputs, modals, canvas controls |
| **Border Transparent** | — | `border-transparent` | Buttons that show border only on hover |
| **Section Separator** | `#0f1117` at 60% | `bg-[#0f1117]/60` | Context menu color picker section separator |

#### Text / Foreground

| Token | Tailwind Class | Usage |
|---|---|---|
| **Text Primary** | `text-slate-100` | Headings, node labels, page titles |
| **Text Secondary** | `text-slate-300` | Body text, context menu items, node label in LeafNode |
| **Text Muted** | `text-slate-400` | Descriptions, subtitles, timestamps, icon buttons |
| **Text Disabled** | `text-slate-500` | Empty states, context menu section labels, metadata |
| **Text on Dark BG (body)** | `#e2e8f0` | Set on `html, body` in `index.css` |

#### Primary Accent — Teal

The primary action and brand color. Used for CTAs, active states, progress indicators, and the canvas toggle tab.

| Shade | Tailwind Class | Usage |
|---|---|---|
| `teal-600` (`#0d9488`) | `bg-teal-600` / `text-teal-600` | Primary CTA buttons, root node BG, add-node (+) buttons, panel toggle tab |
| `teal-700` (`#0f766e`) | `bg-teal-700` / `hover:bg-teal-700` | Button hover state for teal CTAs, root node border, MiniMap root color |
| `teal-800` | `border-teal-800` | Saving badge border, offline badge border |
| `teal-900/30` | `bg-teal-900/30` | Saving badge background, context menu hover, tonal button backgrounds |
| `teal-900/40` | `hover:bg-teal-900/40` | Context menu item hover |
| `teal-200` | `text-teal-200` | Root node subtitle text (on teal-700 background) |
| `teal-300` | `text-teal-300` | Context menu item hover text |
| `teal-400` | `text-teal-400` | Export button text, tonal icon buttons |
| `teal-500` | `border-t-teal-500` | Spinner accent ring |

#### Secondary Accent — Violet / Purple

Used exclusively for edge waypoints and secondary export actions.

| Shade | Hex | Tailwind Class | Usage |
|---|---|---|---|
| `violet-600` | `#7C3AED` | `stroke="#7C3AED"` | Edge waypoint handle border, active/waypoint edge stroke |
| `violet-600/30` | — | `bg-violet-900/30` | Markdown export button background |
| `violet-800` | — | `border-violet-800` | Markdown export button border |
| `violet-400` | — | `text-violet-400` | Markdown export button text |

#### State Colors

| State | Color | Tailwind | Usage |
|---|---|---|---|
| **Success / Completed** | Green | `text-green-400`, `bg-green-500`, `bg-green-100 text-green-700` | Completed node dot, "Saved ✓" badge, completed status badge (in light context) |
| **Warning / Test Mode** | Orange | `bg-orange-900/40 text-orange-300`, `text-orange-800 bg-orange-50` | Test mode button (dark context), test mode banner (light context) |
| **Danger / Delete** | Red | `text-red-400`, `bg-red-900/10`, `bg-red-900/30` | Delete buttons, "Save failed" badge |
| **Error** | Red | `bg-red-900/30 border-red-800` | Retry save button |

#### Node-Specific Branch Colors

The canonical palette of 10 user-selectable branch accent colors. Defined in `src/types/index.ts` as `DEFAULT_BRANCH_COLORS`. These are applied to `borderLeftColor` (BranchNode) and `stroke` (edges) via inline `style`.

```typescript
export const DEFAULT_BRANCH_COLORS = [
  '#01696f',  // Deep teal
  '#437a22',  // Forest green
  '#964219',  // Rust orange
  '#006494',  // Ocean blue
  '#7a39bb',  // Purple
  '#da7101',  // Amber
  '#d19900',  // Gold
  '#a12c7b',  // Magenta
  '#a13544',  // Crimson
  '#2563eb',  // Blue
];
```

**Rule:** These are the only values valid for `node.color` on branch and leaf nodes. The context menu color picker renders exactly these 10 options. Never add or remove colors from this array without updating both the type and the UI.

---

## 3. Typography & Spacing

### Fonts

| Font | Source | Applied To |
|---|---|---|
| **Satoshi** | External CDN / Google Fonts | Body font (`font-family: 'Satoshi', sans-serif` in `index.css`). Applied globally to `body` and overridden on `.bn-container` for the BlockNote editor. |
| **`font-sans`** | Tailwind system stack | Used via `font-sans` utility class on page wrappers as a fallback. |
| **Monospace** | System default | Not explicitly configured. Used only by BlockNote's built-in code block renderer. |

### Font Size Scale

Standard Tailwind font size classes. No custom `fontSize` configuration in `tailwind.config`. Use the scale below — do not invent intermediate sizes.

| Class | Usage in Codebase |
|---|---|
| `text-xs` | Metadata, timestamps, category labels, node type badge in context menu |
| `text-sm` | Body text, button labels, context menu items, node labels (branch/leaf), toast messages |
| `text-base` | Default body, definition textarea content |
| `text-lg` | Section headers in `SectionShell`, node editor section title |
| `text-xl` | Page section headings, modal title, node editor header (`NodeEditor` `h1`) |
| `text-2xl` | Dashboard subtitle |
| `text-3xl` | Dashboard main heading ("Your Mindmaps") |
| `font-bold text-lg` | Root node label |

### Font Weight

| Class | Usage |
|---|---|
| `font-medium` | LeafNode label, leaf node hover text, button metadata |
| `font-semibold` | Branch node label, most button text, section titles, form labels |
| `font-bold` | Root node label, page headings, action buttons, save status badge |

### Border Radius

| Class | Usage |
|---|---|
| `rounded-full` | Leaf nodes, add-node (+) buttons, color picker swatches, completion dot, quick-preview button |
| `rounded-xl` | Context menu, branch node, preview modal, SectionShell cards, share popover |
| `rounded-lg` | Canvas controls (via CSS), buttons, inputs, modals |
| `rounded-md` | Tag badges (implied) |
| `rounded` | Small utility elements |
| `rounded-sm` | Close button on panel, fine-grain UI |

**Rule:** Leaf nodes are `rounded-full` — they are pill-shaped. Branch nodes are `rounded-lg`. The root node is `rounded-xl`. This hierarchy must be preserved — it communicates the depth of the node visually.

### Spacing Conventions

| Pattern | Value | Usage |
|---|---|---|
| Card padding | `px-4 py-3` / `px-5 py-4` | Branch node, SectionShell header |
| Section padding | `p-5` | SectionShell content body |
| Modal padding | `p-6` | Preview modal content |
| Button padding | `px-4 py-2` / `px-3 py-1.5` | Standard button / compact button |
| Gap between icon + text | `gap-2` / `gap-2.5` | Icon-text pairs in buttons and context menu items |
| Page max width | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` | Dashboard, settings |
| Header height offset | `pt-24` | Main content below fixed header |

### Shadows

| Class | Usage |
|---|---|
| `shadow-sm` | Branch node default, leaf node, color swatches |
| `shadow-md` | SectionShell hover, canvas controls |
| `shadow-lg` | Root node |
| `shadow-xl shadow-black/50` | Context menu, modals, popover |
| `shadow-xl` | Canvas controls (via CSS: `0 4px 12px rgba(0,0,0,0.4)`) |
| `0 24px 64px rgba(0,0,0,0.6)` | Preview modal (CSS only, not Tailwind) |

---

## 4. Component Library Rules

**No UI component library is installed.** This project does not use shadcn/ui, Radix UI, Headless UI, Chakra UI, Material UI, or any pre-built component system. There is no `components/ui/` directory.

All UI components are hand-built with Tailwind CSS. The following rules apply:

### Buttons

There is no shared `<Button>` component. Buttons are written as raw `<button>` elements with Tailwind classes inline. Follow these conventions:

**Primary CTA (teal):**
```tsx
<button className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition shadow-sm hover:shadow active:scale-95">
```

**Tonal action (teal):**
```tsx
<button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all text-teal-400 bg-teal-900/30 border border-teal-800 hover:bg-teal-900/50 disabled:opacity-60 disabled:cursor-not-allowed">
```

**Ghost / icon button (dark):**
```tsx
<button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all text-slate-400 hover:bg-[#2d3748]">
```

**Danger:**
```tsx
<button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all text-red-400 bg-red-900/10 border border-transparent hover:bg-red-900/30 hover:border-red-800/50">
```

**Rule:** All interactive buttons must have `transition` or `transition-all` and a hover state. All buttons that trigger async actions must have a `disabled` state with `disabled:opacity-60 disabled:cursor-not-allowed`. All buttons that are small and square must have explicit `aria-label` for accessibility.

### Modals

Modals use `createPortal(...)` to render into `document.body`, ensuring they sit above the ReactFlow canvas. Modal containers use the CSS class system defined in `index.css`:

- **Backdrop:** `.preview-modal-backdrop` — `position: fixed; inset: 0; z-index: 9998; background: rgba(0,0,0,0.75); backdrop-filter: blur(5px)`
- **Box:** `.preview-modal-box` — `position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 9999; width: calc(100vw - 48px); height: calc(100vh - 48px); border-radius: 16px; background: #1e2433; border: 1px solid #2d3748`
- **Animation:** `animate-in fade-in zoom-in-95 duration-200` (Tailwind animate utility)

### Context Menus

Positioned absolutely using `fixed` with `style={{ top: y, left: x }}`. Use `z-[100]`. Standard structure: `w-56 bg-[#1e2433] rounded-xl shadow-xl shadow-black/50 border border-[#2d3748] py-1.5`.

### Collapsible Sections (SectionShell)

Use CSS Grid animation for expand/collapse — `grid-rows-[1fr]` / `grid-rows-[0fr]` with `transition-all duration-300`. This avoids JavaScript height measurement. All content sections in the node editor use `SectionShell` as their wrapper — never build a new collapsible section from scratch.

### Loading States

Two approved loading patterns:

1. **Spinner:** `<div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-teal-500 animate-spin" />` — used for full-panel loads.
2. **Pulse skeleton:** `<div className="h-4 w-full bg-gray-200 rounded animate-pulse" />` — used inside modals while content loads.

`<Loader2 className="w-4 h-4 animate-spin" />` from lucide-react is used inside button labels when the button triggers an async action.

---

## 5. Canvas-Specific UI

### ReactFlow Configuration

The ReactFlow canvas is configured with these exact props — do not change them without an explicit spec:

```tsx
<ReactFlow
  minZoom={0.2}
  maxZoom={1.5}
  fitViewOptions={{ padding: 0.2 }}
  proOptions={{ hideAttribution: true }}
  elevateNodesOnSelect={false}
  nodesDraggable={!isReadOnly}
  nodesConnectable={false}    // ← Users cannot draw new edges manually
  panOnDrag={[2]}             // ← Pan only with middle mouse button (button 2)
  selectionOnDrag            // ← Left-click drag = box selection
  deleteKeyCode={null}        // ← Delete key is disabled; deletion via context menu only
/>
```

### Background

```tsx
<Background color="#2d3748" gap={16} size={2} />
```
Dot grid pattern. Dot color is the border token `#2d3748`. Gap 16px, dot size 2px. Do not change to lines or cross patterns.

### MiniMap

```tsx
<MiniMap
  nodeColor={(n) => {
    if (n.type === 'root')   return '#0f766e';     // teal-700
    if (n.type === 'branch') return node.color || '#94a3b8';
    return '#2d3748';                              // leaf = border color
  }}
  maskColor="rgba(15, 17, 23, 0.75)"
  style={{ background: '#1e2433', border: '1px solid #2d3748' }}
  className="rounded-lg shadow-md"
/>
```

### Node Visual Specifications

#### Root Node
- **Shape:** Rounded rectangle — `rounded-xl`
- **Background:** `bg-teal-700` (solid, always teal — user cannot change)
- **Text:** `font-bold text-lg text-white` for label; `text-teal-200 text-xs` for progress
- **Border:** `border border-teal-800`
- **Shadow:** `shadow-lg`
- **Min width:** `min-w-[200px]`
- **Add-node buttons:** `w-5 h-5 rounded-full bg-teal-600` — appear on hover (`opacity-0 group-hover:opacity-100`), positioned absolutely at each edge midpoint

#### Branch Node
- **Shape:** Left-bordered card — `rounded-lg border-l-4`
- **Left border color:** Dynamic — `style={{ borderLeftColor: node.color }}` using one of `DEFAULT_BRANCH_COLORS`
- **Other borders:** `border-y border-r border-[#2d3748]`
- **Background:** `bg-[#1e2433]`
- **Text:** `font-semibold text-slate-200 text-sm`
- **Shadow:** `shadow-sm`, escalates to `hover:shadow-md`
- **Hover effect:** `hover:-translate-y-0.5` — subtle lift
- **Min width:** `min-w-[160px]`
- **Add-node buttons:** Same as root — `w-5 h-5 rounded-full bg-teal-600`, appear on hover at each of 4 directional positions

#### Leaf Node
- **Shape:** Pill — `rounded-full`
- **Background:** `bg-[#1e2433]`
- **Border:** `border border-[#2d3748]`, changes to `hover:border-teal-600` on hover
- **Text:** `text-slate-300 font-medium text-sm`, truncated with `truncate`
- **Shadow:** `shadow-sm`
- **Hover effects:** `hover:bg-[#2d3748]`, `hover:shadow`, `hover:-translate-x-0.5`
- **Min width:** `min-w-[140px]`
- **Completion indicator:** `w-2 h-2 rounded-full bg-green-500` dot — visible only when `isCompleted === true`
- **Hover CTA:** `→ Study` text in `text-teal-600`, appears on hover
- **Quick preview button:** `w-6 h-6 rounded-full bg-teal-600/90` — appears on hover, positioned `absolute top-1 right-1`

### Edge Visual Specifications

All edges use the custom `WaypointEdge` type (never the ReactFlow default edge):

```tsx
const edgeTypes = useMemo(() => ({
  waypoint: WaypointEdge,
  default: WaypointEdge     // ← Fallback also uses WaypointEdge
}), []);
```

**Default state:**
- Stroke color: `node.color || '#94a3b8'` (inherits from the source/parent node's branch color)
- Stroke width: `3` for edges from root; `2` for all other edges

**Hover / active state (when waypoints exist):**
- Stroke color: `#7C3AED` (violet-600)
- Stroke width: `4`

**Interaction buffer:** An invisible `strokeWidth={25}` transparent path sits on top of the visible line to create a larger click/hover target.

**Waypoint handles (real):**
- `width: 12px; height: 12px; border-radius: 50%`
- `background: white; border: 3px solid #7C3AED`
- Scale up to 1.3× on active drag
- Double-click removes the waypoint

**Phantom midpoint dots (appear on edge hover):**
- `width: 10px; height: 10px; border-radius: 50%`
- `background: white; border: 2px solid #7C3AED66` (violet at 40% opacity)
- `opacity: 0.8; cursor: copy`
- Dragging a phantom dot promotes it to a real waypoint handle

### Handle IDs

Every node renders 8 handles — 4 source, 4 target — one per direction:

```tsx
// Source handles
<Handle id="s-left"   type="source" position={Position.Left}   className="opacity-0 w-0 h-0" />
<Handle id="s-right"  type="source" position={Position.Right}  className="opacity-0" />
<Handle id="s-top"    type="source" position={Position.Top}    className="opacity-0 w-0 h-0" />
<Handle id="s-bottom" type="source" position={Position.Bottom} className="opacity-0 w-0 h-0" />

// Target handles
<Handle id="t-left"   type="target" position={Position.Left}   className="opacity-0" />
<Handle id="t-right"  type="target" position={Position.Right}  className="opacity-0 w-0 h-0" />
<Handle id="t-top"    type="target" position={Position.Top}    className="opacity-0 w-0 h-0" />
<Handle id="t-bottom" type="target" position={Position.Bottom} className="opacity-0 w-0 h-0" />
```

All handles are `opacity-0`. The "active" handle for a given edge direction is rendered at full size; inactive handles are `w-0 h-0` to prevent click-area interference. Edge `sourceHandle` and `targetHandle` are set dynamically based on the directional vector between parent and child positions in `treeLayout.ts`.

**Rule:** Never remove or rename these handle IDs. The `buildFlowElements` function in `treeLayout.ts` references them by the `s-{direction}` / `t-{direction}` naming convention.

### ReactFlow CSS Overrides (`index.css`)

The following ReactFlow classes are overridden globally and must not conflict with new component styles:

```css
.react-flow__pane,
.react-flow__renderer,
.react-flow__background  → background: #0f1117

.react-flow__controls    → bg: #1e2433, border: #2d3748, border-radius: 8px
.react-flow__controls-button → bg: #1e2433, color: #94a3b8
.react-flow__controls-button:hover → bg: #2d3748
.react-flow__minimap     → bg: #1e2433
```

---

*This file is part of the 6-file context system used to maintain AI agent coherence across development sessions. It must be re-read at the start of every new session before issuing any feature spec.*
