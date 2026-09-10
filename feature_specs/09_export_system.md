# SPEC-09: Export System (PDF, Markdown, JSON)

> **Status:** DONE
> **Session:** 11
> **Tracker ref:** SPEC-09

---

## Goal

Implement three client-side export formats: (1) a full canvas PDF via `html2canvas` + `jsPDF`, (2) a structured per-branch PDF from node content, (3) a branch-to-Markdown file download, and (4) a full workspace JSON export/import for data portability. All exports must be triggered client-side with no server involvement.

---

## Design / Technical Constraints

- **PDF library:** `jspdf` + `html2canvas`. Import as named imports. All rendering is client-side.
- **No server upload or storage.** Exports trigger `<a download>` or `URL.createObjectURL()` file downloads in the browser.
- **`ExportedMap` schema versioning:** The JSON export format must include an `exportVersion: '2.0.0'` field at the top level. The import parser must check this field and reject incompatible versions with a clear error message.
- **Import ID regeneration:** When importing a JSON file, every `id`, `mapId`, and `nodeId` must be regenerated using `crypto.randomUUID()` or `nanoid()`. Never reuse IDs from the export file — they would conflict with existing rows.
- **Import re-mapping:** When regenerating node IDs, maintain a `Map<oldId, newId>` to re-map all `parentId` references in the node tree before inserting.
- **Export triggers:** PDF and Markdown exports are triggered from buttons in `NodeEditor.tsx`. The full workspace JSON export/import is in `SettingsPage.tsx`. The full canvas PDF is triggered from `CanvasToolbar.tsx` (or a toolbar button on the canvas).
- **Branch PDF format:** Does NOT capture the ReactFlow canvas. Renders structured text content (definition, key points, mental model, examples, notes, resources) as a formatted PDF document using `jsPDF`'s text layout API.
- **File naming:** Sanitize all filenames using `title.replace(/[^a-z0-9]/gi, '_').toLowerCase()` before appending a datestamp and extension.

---

## Implementation Steps

### `src/utils/exportPDF.ts`
- Implement `exportMapToPdf(canvasElement: HTMLElement, mapTitle: string)`:
  - Call `html2canvas(canvasElement, { scale: 2, backgroundColor: '#0f1117' })`
  - Create a `jsPDF` instance in landscape format
  - Add the canvas image to fill the page
  - Save as `${safeTitle}-${datestamp}.pdf`
- Export a `getDatestamp()` helper: `new Date().toISOString().slice(0, 10)` (YYYY-MM-DD)

### `src/utils/exportBranchToPdf.ts`
- Implement `exportBranchToPdf(node: MindmapNode, content: NodeContent, mapTitle: string, parentLabel?: string): Promise<void>`:
  - Create a `jsPDF` instance in portrait format
  - Add a header with `mapTitle`, node breadcrumb, and `node.label`
  - For each non-empty content field (definition, key points, mental model, good example, bad example, notes, resources), add a labeled section using `jsPDF`'s `text()` method
  - Handle text wrapping with `splitTextToSize(text, maxWidth)`
  - Key points: render as a numbered list
  - Resources: render each as `[title] url`
  - Save as `${safeNodeLabel}-${datestamp}.pdf`

### `src/utils/exportBranchToMarkdown.ts`
- Implement `exportBranchToMarkdown(node: MindmapNode, content: NodeContent, mapTitle: string, parentLabel?: string)`:
  - Build a Markdown string with `# ${node.label}`, a metadata block (map title, parent), then H2 sections for each content field
  - Key points: render as a Markdown ordered list
  - Resources: render as `- [title](url)`
  - Trigger download via `URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }))` and a synthetic anchor click
  - Filename: `${safeNodeLabel}-${datestamp}.md`

### `src/utils/exportImport.ts`
- Implement `exportSingleMap(mapId, mapTitle)`:
  - Fetch `mindmaps`, `nodes`, `node_content` rows from Supabase
  - Format into camelCase `MindmapMeta`, `MindmapNode[]`, `Record<string, NodeContent>`
  - Wrap in `ExportedMap` object with `exportVersion: '2.0.0'` and `exportedAt: new Date().toISOString()`
  - Trigger JSON download via `URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)]))`

- Implement `exportAllMaps()`:
  - Call `supabase.auth.getUser()` — require auth
  - Fetch all `mindmaps` for the user, then all `nodes` and `node_content` for each
  - Build an array of `ExportedMap` objects
  - Download as a single JSON file

- Implement `importMaps(jsonString: string)`:
  - Parse and validate — check `exportVersion` field
  - For each map in the array, regenerate all IDs using a `Map<oldId, newId>`
  - Re-map all `parentId` references in `nodes[]` using the ID map
  - Insert new `mindmaps` row, insert all `nodes` rows, insert all `node_content` rows
  - Call `mapsStore.getState().fetchMaps()` after completion
  - Return `ApiResult<{ importedCount: number }>`

- Implement `downloadJsonBlob(data: unknown, filename: string)`:
  - `URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))`
  - Synthetic anchor click + `URL.revokeObjectURL()`

### `src/pages/SettingsPage.tsx` (update)
- Add an "Export All Maps" button that calls `exportAllMaps()` with a `<Loader2>` spinner during export
- Add an "Import Maps" file input (hidden `<input type="file" accept=".json">`) triggered by a visible button
- On file select: read file as text, call `importMaps(text)`, show success/error toast

### `src/components/editor/NodeEditor.tsx` (update)
- "Export PDF" button: calls `exportBranchToPdf(currentNode, nodeContent, mapTitle, parentLabel)`. Show `<Loader2>` while `isExporting`.
- "Export MD" button: calls `exportBranchToMarkdown(currentNode, nodeContent, mapTitle, parentLabel)`. Show `<Loader2>` while `isExportingMd`.
- Both buttons are always visible (even in readOnly mode — export is a read operation)

---

## Verification Checklist

- [ ] Clicking "Export PDF" on a node with content downloads a formatted `.pdf` file containing the definition, key points, and other content sections
- [ ] Clicking "Export MD" downloads a `.md` file with correct Markdown heading hierarchy
- [ ] Clicking "Export All Maps" in Settings downloads a valid JSON file; opening it in a text editor shows `"exportVersion": "2.0.0"` at the top
- [ ] Importing the exported JSON file in a fresh account creates all maps with correct node trees — no duplicate or conflicting IDs in Supabase
