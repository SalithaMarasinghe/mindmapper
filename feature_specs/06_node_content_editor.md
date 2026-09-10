# SPEC-06: Node Content Editor & ContentStore

> **Status:** DONE
> **Session:** 7–8
> **Tracker ref:** SPEC-06

---

## Goal

Build the per-node knowledge editor: a full-page layout at `/map/:mapId/node/:nodeId` that presents structured learning content (definition, key points, mental model, examples, notes, resources, rich text) in collapsible sections, with debounced auto-save and a visible save-status indicator. Include a "Test Mode" that blurs content for self-quizzing.

---

## Design / Technical Constraints

- **State manager:** `contentStore` (Zustand). All content CRUD lives here. `NodePage` and `NodeEditor` must not call Supabase directly.
- **Save pattern:** `contentStore.updateContent()` performs an optimistic Zustand state update, then calls `retrySave()` via `setTimeout(fn, 0)` to flush asynchronously. This keeps the UI non-blocking. Never debounce with a timer in the store — the `setTimeout(0)` pattern is sufficient.
- **`SaveStatus` per node:** Track save state as `'saved' | 'unsaved' | 'saving' | 'failed'` in a `Record<nodeId, SaveStatus>` map. Surface this in `NodeEditor`'s header as: pulsing "Saving..." badge (unsaved/saving), green "Saved ✓" flash (saved, auto-hide after 2s), red "Save failed — Retry" button (failed).
- **Lazy content creation:** `getOrCreateContent(nodeId, mapId)` must check if a content row already exists in `contentStore.content[nodeId]`. If not, INSERT into `node_content` immediately, then set an empty content object in state. Handle error code `'23505'` (unique constraint — row already exists) silently.
- **Rich text editor:** Use `@blocknote/react` v0.47. Store content as `unknown[]` (BlockNote's JSON block array) in `node_content.rich_content`. The editor must be wrapped in a component (`RichEditor.tsx`) that exposes `onSave(blocks)` and `onDirty()` callbacks.
- **Test mode:** A toggle (`Cmd/Ctrl + T` keyboard shortcut) that applies the CSS class `notes-hidden` to the editor wrapper. The class is defined in `index.css` as `.notes-hidden .bn-editor { filter: blur(8px); pointer-events: none; }`.
- **Node page timeout:** In `NodePage.tsx`, if `mapStore.loadMap()` and `contentStore.loadContent()` do not complete within 5 seconds, set an error state and render a "Could not load" message.
- **Keyboard navigation:** In `NodePage`, bind left/right arrow keys to navigate between sibling nodes (nodes with the same `parentId`, sorted by `order_index`). Skip if an editable element is focused.
- **`SectionShell` collapsible pattern:** Use CSS Grid animation (`grid-rows-[1fr]` ↔ `grid-rows-[0fr]`) with `transition-all duration-300`. No JavaScript height measurement.
- **Editor surface (light mode exception):** `SectionShell` cards use `bg-white border-gray-200` (white surface). Input/textarea fields inside use `text-gray-800`. This is the ONLY surface in the app with light-background styling — it is intentional.

---

## Implementation Steps

### `src/store/contentStore.ts`
- State: `content: Record<string, NodeContent>`, `saveStatus: Record<string, SaveStatus>`, `isLoading: boolean`, `mapId: string | null`
- Module-level `saveTimers: Map<string, ReturnType<typeof setTimeout>>` — used for debounce cleanup
- Implement `emptyContent(nodeId, mapId): NodeContent` — returns a NodeContent object with all fields set to empty defaults
- Implement `loadContent(mapId)`: SELECT `*` FROM `node_content` WHERE `map_id = mapId`. Populate `content` Record.
- Implement `fetchNodeContent(nodeId, mapId)`: SELECT single row. Return `NodeContent`. If offline, fall back to `offlineStore.getMapContent()`.
- Implement `getOrCreateContent(nodeId, mapId)`: Return cached value if exists. If offline and cached in IndexedDB, return that. Otherwise INSERT empty row into `node_content`, set in state, return it. Handle `'23505'` (duplicate) and `'42P01'` (table missing) silently.
- Implement `updateContent(nodeId, updates: Partial<NodeContent>)`: Guard `navigator.onLine`. Optimistic merge into `content[nodeId]`. Set `saveStatus[nodeId] = 'unsaved'`. Call `setTimeout(() => get().retrySave(nodeId), 0)`.
- Implement `retrySave(nodeId)`: Set `saveStatus = 'saving'`. Build `dbUpdates` object (snake_case fields). UPDATE `node_content` WHERE `node_id`. Set `saveStatus = 'saved'` on success, `'failed'` on error.
- Implement `setSaveStatus(nodeId, status)`: Direct setter.
- Implement `markComplete(nodeId)`: Guard online. Optimistic update `isCompleted: true`. UPDATE `node_content.is_completed`. Call `mapsStore.getState().fetchMaps()` to refresh `completed_count`.
- Implement `markIncomplete(nodeId)`: Same pattern, reverse.
- Implement `addKeyPoint(nodeId, text, index?)`: Insert new `{id: Date.now().toString(), text, order}` at position. Call `updateContent()`.
- Implement `removeKeyPoint(nodeId, pointId)`: Filter out, call `updateContent()`.
- Implement `updateKeyPoint(nodeId, pointId, text)`: Map replace, call `updateContent()`.
- Implement `addResource(nodeId, resource)`, `removeResource(nodeId, resourceId)`: Same pattern as key points.

### `src/components/editor/SectionShell.tsx`
- Props: `title: string`, `icon: LucideIcon`, `defaultOpen?: boolean`, `children: ReactNode`
- Local state: `isOpen: boolean`
- Header: `w-full flex items-center justify-between px-5 py-4 bg-gray-50/50 hover:bg-gray-50` with icon in `p-1.5 bg-teal-100 text-teal-700 rounded-lg`
- Body: `grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 border-t border-gray-100' : 'grid-rows-[0fr] opacity-0'}` — inner div `overflow-hidden`, content div `p-5`

### `src/components/editor/DefinitionSection.tsx`
- Wrap in `<SectionShell title="Definition" icon={BookOpen}>`
- Auto-resizing `<textarea>` — set `height: 'auto'`, then `height: scrollHeight + 'px'` on every change
- `className="w-full resize-none outline-none text-gray-800 placeholder:text-gray-400 min-h-[80px] text-base leading-relaxed bg-transparent font-medium"`
- Call `contentStore.updateContent(nodeId, { definition: value })` on change

### `src/components/editor/KeyPointsSection.tsx`
- Wrap in `<SectionShell title="Key Points" icon={List}>`
- Render each key point as an `<input>` with up/down reorder buttons and an `<X>` remove button
- On Enter key: call `addKeyPoint(nodeId, '', index + 1)` to insert below
- On Backspace with empty text: call `removeKeyPoint(nodeId, pointId)`
- "Add Key Point" button at the bottom

### `src/components/editor/MentalModelSection.tsx`, `ExamplesSection.tsx`, `NotesSection.tsx`
- All wrap `<SectionShell>` with appropriate icon
- `MentalModelSection`: single auto-resize textarea → `mentalModel` field
- `ExamplesSection`: two labeled textareas → `goodExample` and `badExample`
- `NotesSection`: single auto-resize textarea → `notes` field

### `src/components/editor/ResourcesSection.tsx`
- Wrap in `<SectionShell title="Resources" icon={Link}>`
- Each resource: `{id, title, url?, note?}` — render as an editable row with a remove button
- "Add Resource" button opens an inline form for title + URL

### `src/components/editor/RichEditor.tsx`
- Props: `nodeId: string`, `mapId: string`, `initialContent: unknown[]`, `onSave: (blocks: unknown[]) => void`, `onDirty: () => void`, `readOnly?: boolean`
- Use `useCreateBlockNote({ initialContent, editable: !readOnly })` from `@blocknote/react`
- Wrap in `BlockNoteView` — pass `onChange` handler that calls `onDirty()` then debounces `onSave(editor.document)` with 1500ms
- Apply `className="rich-editor-wrapper"` for the CSS min-height rule

### `src/components/editor/NodeEditor.tsx`
- Props: `nodeId`, `mapId`, `mapTitle?`, `parentLabel?`, `isTestMode?`, `onToggleTestMode?`
- On mount: call `contentStore.getOrCreateContent(nodeId, mapId)`
- Render sticky header with: node label, save status badge, Test Mode toggle, Export PDF button, Export Markdown button, Erase button (non-readOnly), Mark as Studied button (non-readOnly)
- Test mode banner: orange alert with "Hide Notes" / "Reveal" toggle for the blur
- Body: `<RichEditor>` wrapped in a div with class `notes-hidden` conditional on `isTestMode && isNotesHidden`
- Export PDF: call `exportBranchToPdf()` (from SPEC-09). Show `<Loader2>` spinner while exporting.
- `Cmd/Ctrl + T` keyboard shortcut: `window.addEventListener('keydown', ...)` in `useEffect` with cleanup. Skip if an editable element is focused.

### `src/pages/NodePage.tsx`
- Load map + content on mount with 5-second timeout guard
- `useEffect` that reads URL params (`mapId`, `nodeId`), calls `mapStore.loadMap()` and `contentStore.loadContent()`
- If timeout fires before load: set `loadError` state, render error message
- Left/right arrow key navigation between siblings — skip if `isEditingElementFocused()`
- Render a two-panel layout: left side = node tree outline, right side = `<NodeEditor>`

---

## Verification Checklist

- [ ] Opening a node at `/map/:mapId/node/:nodeId` loads its existing content within 2 seconds
- [ ] Typing in the Definition field saves automatically — "Saving..." badge appears, then "Saved ✓" flash on completion
- [ ] Closing the node and reopening it shows all content exactly as saved — no data loss
- [ ] Pressing `Cmd/Ctrl + T` toggles Test Mode — rich text content blurs and the blur is removed when toggled off
