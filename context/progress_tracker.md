# Progress Tracker

> **Context File 6 of 6** · Living document — update after every session
> Part of the Spec-Driven Agentic Development context system for the MindMap Tool.
>
> **AI Agent Rule (from `ai_workflow_rules.md`):** This is the FIRST file you read at the start of every session, and the LAST file you update at the end. Never begin generating code without confirming the current phase and active task below.

---

## Current Phase

**Phase 5 — Production Hardening & Post-MVP Polish**

The MVP feature set is fully implemented and deployed to production on Vercel. All six core subsystems are operational: auth, canvas, node content editor, sharing, offline access, and export. The codebase is in a stable, deployed state. Current work is limited to known edge-case polish, technical debt cleanup, and preparation for post-MVP feature planning.

**Deployment status:** ✅ Live on Vercel
**Auth:** ✅ Supabase email/password, session-persistent
**Database:** ✅ Supabase PostgreSQL, RLS enforced
**Offline:** ✅ IndexedDB snapshot via idb-keyval
**PWA:** ✅ Workbox service worker, installable
**Sharing:** ✅ Token-based public read-only links, RLS-enforced

---

## Completed Features (The Build Log)

### ✅ SPEC-01: Project Scaffold & Infrastructure
**Completed:** Session 1
**Status:** DONE

Set up the full development environment from scratch. Initialized Vite + React 19 + TypeScript 6 project with strict mode. Configured Tailwind CSS v4 via the Vite plugin. Installed and wired React Router v7, Zustand v5, `@supabase/supabase-js`, `lucide-react`, and `react-hot-toast`. Established the `@/` import alias in `tsconfig.app.json` and `vite.config.ts`. Created `src/lib/supabase.ts` as the single Supabase client instance. Deployed to Vercel with `vercel.json` SPA rewrite rule to handle client-side routing.

**Key decisions made:**
- Vite over Next.js: No server-side rendering needed. SPA is sufficient for a canvas-first tool.
- `vercel.json` catch-all rewrite added immediately — prevents 404s on direct URL navigation before they become a production incident.

---

### ✅ SPEC-02: Database Schema & Row Level Security
**Completed:** Session 1–2
**Status:** DONE

Designed and deployed the full PostgreSQL schema to Supabase. Created five tables: `mindmaps`, `nodes`, `node_content`, `profiles`, `map_shares`. Wrote and applied RLS policies for all tables enforcing `user_id = auth.uid()` ownership. Defined the `NodeType` enum constraint (`root | branch | leaf`) as a TypeScript union in `src/types/index.ts` — not a Postgres enum — for flexibility. Added `DEFAULT_BRANCH_COLORS` array with 10 canonical hex values to `types/index.ts`.

**Key decisions made:**
- `edge_waypoints` stored as `jsonb` on the `mindmaps` row, not a separate table. Waypoints are always loaded and saved as a unit with their map — a join would add latency with no query benefit.
- `node_content` is a separate table from `nodes` (not embedded JSON) to allow lazy creation — content rows are only inserted on first edit, keeping the nodes table lean.
- `share_token` is a `TEXT UNIQUE` column on `mindmaps`, not a separate shares table. This enables single-query public access via RLS without a join.

---

### ✅ SPEC-03: Authentication & Route Protection
**Completed:** Session 2
**Status:** DONE

Implemented `authStore.ts` (Zustand) with `signUp`, `signIn`, `signOut`, `fetchProfile`, `updateProfile` actions. Wired `supabase.auth.onAuthStateChange` for reactive session sync. Added a 4-second `Promise.race` timeout on `initAuth()` to prevent the UI from hanging on a stalled Supabase auth check. Built `ProtectedRoute` component that reads `useAuthStore().user` and `isLoading` — renders a spinner during session hydration, redirects to `/login` if unauthenticated. Created `LoginPage`, `RegisterPage`. Built `App.tsx` route tree with `<ProtectedRoute>` as the outlet wrapper for all authenticated routes. The `/share/:token` route is explicitly outside `ProtectedRoute` — it uses RLS for access control.

**Key decisions made:**
- Auth guard is route-level via `ProtectedRoute`, not component-level. One guard covers all authenticated routes.
- `initAuth()` uses `Promise.race` with a 4-second timeout. Without this, a Supabase network failure causes a permanent loading spinner — unacceptable UX.
- `useAuthStore.getState().user` (snapshot) is used inside Zustand store actions. `useAuthStore()` (subscription) is used only in React components. These are intentionally different patterns.

---

### ✅ SPEC-04: Dashboard & Map Management
**Completed:** Session 3
**Status:** DONE

Built `mapsStore.ts` with `fetchMaps`, `createMap`, `updateMap`, `deleteMap`, `duplicateMap`, `getMapById`. `fetchMaps` queries `mindmaps WHERE user_id = auth.uid()`, ordered by `updated_at DESC`. `createMap` atomically inserts the map row AND its initial root node in two sequential Supabase calls. Built `DashboardPage`, `MapGrid` component (map card list with search), and `CreateMapModal` (title, emoji, color, tags, description). `DashboardPage` also handles offline fallback — reads from IndexedDB if `navigator.onLine === false`.

**Key decisions made:**
- Root node is created immediately on `createMap` — not lazily on first canvas open. This prevents a race condition where `loadMap` finds an empty `nodes` table and attempts to create a root node from map metadata, which requires an extra round-trip.
- `duplicateMap` currently copies only map metadata, not nodes or node content. Deep duplication requires a Postgres RPC function for performance and atomicity. This is a known limitation logged in the "In Progress" section below.

---

### ✅ SPEC-05: ReactFlow Canvas Engine
**Completed:** Sessions 4–6
**Status:** DONE

This was the largest and most complex spec. Implemented `MindmapCanvas.tsx`, `mapStore.ts`, `treeLayout.ts`, and all three custom node types (`RootNode`, `BranchNode`, `LeafNode`).

**Canvas architecture established:**
- `mapStore.loadMap()` fetches nodes + edge waypoints from Supabase on mount
- `buildFlowElements()` in `treeLayout.ts` converts `MindmapNode[]` into ReactFlow `Node[]` + `Edge[]`
- ReactFlow's `useNodesState` owns live display positions during drag
- `onNodeDragStop` calls `mapStore.saveBatchChanges()` — optimistic Zustand update first, Supabase persist in background, reconcile with re-fetch
- Viewport (pan/zoom) is persisted per-map in `settingsStore.viewports` (in-memory, resets on reload — intentional for MVP)

**Node direction system added in Session 6:**
Added `direction: 'left' | 'right' | 'top' | 'bottom'` to the `nodes` table. Direction is computed geometrically from the vector between parent and child positions in `treeLayout.ts`. Backward compatibility handled via `supportsDirection` flag in `mapStore` — if Supabase returns error code `42703` (unknown column), the flag flips and subsequent writes omit the `direction` field.

**Key decisions made:**
- `nodesConnectable={false}` on ReactFlow — users cannot draw edges manually. All edges are derived from the parent-child hierarchy in Supabase.
- `deleteKeyCode={null}` — keyboard delete is disabled. All node deletion goes through the right-click context menu with a `window.confirm` guard.
- `panOnDrag={[2]}` — middle mouse button pans. Left-click drag triggers box selection (`selectionOnDrag`). This is the interaction model for power users.
- Handles are `opacity-0` on all nodes. The `s-{direction}` / `t-{direction}` naming convention is required by `treeLayout.ts` and must never change.

---

### ✅ SPEC-06: Node Content Editor & ContentStore
**Completed:** Sessions 7–8
**Status:** DONE

Built `contentStore.ts`, `NodePage.tsx`, `NodeEditor.tsx`, and all seven section components: `DefinitionSection`, `KeyPointsSection`, `MentalModelSection`, `ExamplesSection`, `NotesSection`, `ResourcesSection`, `RichEditor` (BlockNote). Created `SectionShell` as the shared collapsible wrapper for all structured content sections.

**Save mechanics:** `contentStore.updateContent()` performs an optimistic Zustand state update then schedules `retrySave()` via `setTimeout(fn, 0)` to flush asynchronously. This keeps the UI non-blocking. Save status is tracked per-node as `SaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed'`. The editor header shows a pulsing "Saving..." badge during writes and a "Save failed — Retry" button on failure.

**Test mode:** A feature in `NodeEditor` that hides the rich text content behind a CSS `blur(8px)` filter (`.notes-hidden .bn-editor`). Toggled via `Cmd/Ctrl + T`. Allows self-quizzing without leaving the page.

**Key decisions made:**
- BlockNote (`@blocknote/react`) chosen over Tiptap or Quill for its built-in slash-command block types and React 19 compatibility.
- `node_content` rows are created lazily on first open via `getOrCreateContent()` — not on node creation. Reduces DB write volume for nodes the user never edits.
- `NodePage` has a 5-second timeout guard. If `loadMap` + `loadContent` don't resolve in 5 seconds, the page renders an error state instead of hanging indefinitely.

---

### ✅ SPEC-07: Sharing System & Public RLS
**Completed:** Session 9
**Status:** DONE

Built token-based public sharing. `generateShareLink()` in `sharing.ts` sets `is_public = true` and `share_token = nanoid(21)` on the `mindmaps` row. Applied `share_link_setup.sql` to Supabase — three RLS policies granting `public` SELECT access to `mindmaps`, `nodes`, and `node_content` for any row where `share_token IS NOT NULL`. Built `SharedMapPage.tsx` which reads the token from the URL, queries Supabase without a JWT, and renders the canvas in read-only mode. `revokeShareLink()` nulls both `is_public` and `share_token`.

**Key decisions made:**
- `nanoid(21)` produces 126 bits of entropy — effectively impossible to guess by brute force at any realistic user scale.
- `SharedMapPage` intentionally calls Supabase directly (bypassing the Zustand store pattern). This is the documented exception in Architecture Invariant 2 — it operates without an auth context by design.
- `CanvasToolbar.tsx` also makes a direct Supabase call for the share/revoke action. **This is a known architecture deviation** — it should be moved to a store action or the `sharing.ts` utility in a future cleanup pass.

---

### ✅ SPEC-08: Offline Access & PWA
**Completed:** Session 10
**Status:** DONE

Built `lib/offlineStore.ts` (pure `idb-keyval` wrapper) and `store/offlineStore.ts` (Zustand store for offline state management). `toggleOffline()` snapshots the full map — meta, nodes, and content — into IndexedDB under three keys (`map_meta_${id}`, `map_nodes_${id}`, `map_content_${id}`). All three Zustand data stores (`mapStore`, `mapsStore`, `contentStore`) have offline fallback paths that read from IndexedDB when `navigator.onLine === false`. All write operations guard `navigator.onLine` and toast an error if offline.

Configured `vite-plugin-pwa` with Workbox in `vite.config.ts`. Service worker precaches all static assets up to 5MB. `main.tsx` unregisters service workers in development mode and clears all caches to prevent stale asset issues during active development.

**Key decisions made:**
- Offline is read-only by design. No write queue, no conflict resolution, no sync-on-reconnect. The tradeoff is simplicity and zero data loss risk. A write queue would require conflict resolution logic that is out of MVP scope.
- The service worker is unregistered entirely in development (`import.meta.env.PROD` guard). This prevents Workbox from serving stale cached files during active development — a major DX issue without this guard.

---

### ✅ SPEC-09: Export System (PDF, Markdown, JSON)
**Completed:** Session 11
**Status:** DONE

Implemented three export formats:
1. **Full canvas PDF** (`exportPDF.ts`): `html2canvas` captures the ReactFlow canvas DOM node → `jsPDF` renders it as an A4 document.
2. **Branch PDF** (`exportBranchToPdf.ts`): Renders a single branch node's structured content (definition, key points, mental model, examples, notes, resources) as a formatted PDF without capturing the canvas.
3. **Branch Markdown** (`exportBranchToMarkdown.ts`): Serializes the same structured content to a `.md` file and triggers a browser download.
4. **Full workspace JSON** (`exportImport.ts`): `exportAllMaps()` fetches all the user's maps + nodes + content and downloads a structured `ExportedMap[]` JSON file. `importMaps()` parses the JSON and re-inserts all data with new generated IDs.

`ExportedMap` uses a `exportVersion: '2.0.0'` field for forward-compatible import parsing.

---

## In Progress / Next Up

### 🔧 KNOWN ISSUE: `CanvasToolbar` Direct Supabase Call
**Priority:** Low — functional but violates Architecture Invariant 2
**File:** `src/components/mindmap/CanvasToolbar.tsx` (lines 49–90)
**Description:** The share/revoke handlers in `CanvasToolbar` call `supabase.from('mindmaps').update(...)` directly instead of routing through a store action or the `sharing.ts` utility. This bypasses the standard error handling and store-update pattern.
**Proposed fix:** Move `handleShare` and `handleRevoke` logic into `mapsStore.ts` as `generateShareLink(mapId)` and `revokeShareLink(mapId)` actions, then call those from `CanvasToolbar`.
**Status:** Not yet scheduled.

---

### 🔧 KNOWN LIMITATION: `duplicateMap` Copies Metadata Only
**Priority:** Medium — visible to users, creates empty duplicate maps
**File:** `src/store/mapsStore.ts` (line 200)
**Description:** `duplicateMap()` creates a new `mindmaps` row but does not copy the `nodes` or `node_content` rows. The comment in the code reads: *"Client-side duplicating deep nodes + content omitted for brevity, ideally executed via Postgres RPC function for performance."*
**Proposed fix:** Write a Postgres RPC function (`duplicate_map(source_map_id, new_user_id)`) that performs the full deep copy atomically in the database. Call it from `mapsStore.duplicateMap()` via `supabase.rpc('duplicate_map', {...})`.
**Status:** Requires Supabase RPC setup. Not yet scheduled.

---

### 🔮 FUTURE: Theme Toggle Wiring
**Priority:** Low — state exists, CSS application is not implemented
**File:** `src/store/settingsStore.ts` (`isReadOnly`, `viewports`), `src/pages/SettingsPage.tsx` (`theme`, `fontSize` state)
**Description:** `SettingsPage` has `theme` (light/dark/system) and `fontSize` local state that controls `document.body.classList`. These are not persisted to `settingsStore` or `localStorage`. The theme toggle changes `body` class in-session only and resets on reload.
**Status:** Deferred — full light mode is explicitly out of MVP scope per `project_overview.md`.

---

## Architectural Decisions Log

> This section is the permanent record of "why we built it this way." Future AI agents must read this before proposing any structural changes.

---

**ADR-01: ReactFlow (`@xyflow/react`) over raw SVG/D3 for the canvas**
*Decided: SPEC-05, Session 4*

D3 requires building pan, zoom, node selection, and drag from scratch. ReactFlow provides all of these production-grade and integrates cleanly with React's rendering model. The tradeoff is bundle size (~280KB) and the constraint that we cannot use ReactFlow's built-in edge connection UI (since our edges are parent-child derived, not user-drawn). We disable `nodesConnectable` and `deleteKeyCode` and build all manipulation through the right-click context menu. This was the correct call — building a canvas from raw SVG would have consumed 3x the development time.

---

**ADR-02: Zustand over Redux, Jotai, or React Context for state management**
*Decided: SPEC-01, Session 1*

Redux requires excessive boilerplate for a small team moving fast. React Context causes full-tree re-renders on every state update — catastrophic for a canvas with 50+ nodes. Jotai is atom-based and better for fine-grained UI state, not domain-sliced data. Zustand v5 with selector-based subscriptions gives us isolated domain stores with zero-boilerplate and surgical re-rendering. The `useAuthStore.getState()` snapshot pattern (for store-to-store communication) is the key pattern that prevents cascade re-renders.

---

**ADR-03: `edge_waypoints` as JSONB on `mindmaps`, not a separate `edge_waypoints` table**
*Decided: SPEC-05, Session 5*

Waypoints are always loaded and saved as a complete unit with their map — there is no use case for querying individual waypoints, filtering by edge ID, or updating a single waypoint in isolation without the full set. A separate table would require a JOIN on every `loadMap` call and a transaction for every waypoint drag-release. The JSONB blob on `mindmaps` loads in a single column fetch alongside map metadata and saves as a single `UPDATE`. The data shape is `Record<string, Waypoint[]>` keyed by `"parentId-childId"`. This is the correct tradeoff at MVP scale.

---

**ADR-04: Offline is read-only (no write queue, no sync-on-reconnect)**
*Decided: SPEC-08, Session 10*

A write queue requires conflict resolution: what happens when the user edits a node offline and another session has also edited it online? CRDTs and OT are both out of MVP scope. The deliberate decision was: offline = read-only snapshot. All write operations (`addNode`, `updateNode`, `deleteNode`, `updateContent`) guard `navigator.onLine` and return early with a toast if offline. This eliminates an entire class of data consistency bugs at the cost of preventing writes offline. The user persona (structured learner reviewing content) rarely needs to add nodes offline — they need to read content offline. This is the right tradeoff for the MVP.

---

**ADR-05: `direction` column added post-MVP with backward compatibility flag**
*Decided: SPEC-05 patch, Session 6*

The `direction` column on `nodes` was added after the initial schema was deployed. Rather than require all users to run a migration, `mapStore` tracks a `supportsDirection: boolean` flag. If any Supabase write returns error code `42703` (column does not exist) or `PGRST204` (column not in PostgREST cache), the flag flips to `false` and subsequent writes omit the `direction` field. This is a schema backward-compatibility pattern that should be removed once all Supabase instances have been migrated.

---

**ADR-06: `SharedMapPage` is the only component permitted to call Supabase directly**
*Decided: SPEC-07, Session 9*

`SharedMapPage` renders without an authenticated user context. The Zustand stores (`mapStore`, `contentStore`) are designed around an authenticated user and their `useAuthStore.getState().user` dependency. Rather than retrofit all stores to support anonymous access, `SharedMapPage` calls `supabase.from(...)` directly and manages its own local React state. This is the documented exception to Architecture Invariant 2. It is intentional, bounded, and should not be used as precedent for other components.

---

## Session Notes

### Session 11 — 2026-09-10 (Most Recent)
- ✅ All context files generated and saved to `context/` directory
- ✅ Interview narration script generated (`interview_narration.md` in artifacts)
- Context system is complete. All 6 files are written and ready for agent consumption.
- **Next session focus:** Address the two known issues logged above — `CanvasToolbar` direct Supabase call refactor, and `duplicateMap` deep copy via Postgres RPC.
- **For interviews:** The 5-phase FDE narration is complete. Use `context/` files as live proof of the Spec-Driven Agentic Development workflow.

---

### Session 11 — Jarvis Cockpit Redesign, Prompt Studio & Codecraft Gateway
- Replaced floating bottom-right dock button with an interactive **Jarvis Globe Capsule in `AppHeader`** and a first-class **`Jarvis AI` Cockpit tab** in `DashboardPage`.
- Built full-page **`JarvisCockpit.tsx`** command center featuring a 160px audio-reactive 3D Jarvis Orb, instant push-to-talk voice dictation, and dual-pane layout (dialogue stream + live Prompt Studio canvas).
- Implemented **Iterative Prompt Engineering Studio**:
  - Automatically structures conversational voice/text input into production-grade R-T-C-O-G prompts (Role, Objective, Context, Constraints, Schema).
  - Implemented **resilient clipboard copy engine** (`copyToClipboard`) with `document.execCommand` fallback that auto-copies prompts immediately on generation and iteration.
  - Multi-turn voice refinement loop (*"make it more concise"*, *"add strict TypeScript rules"*, *"enforce Tailwind v4"*) with quick-action pills.
- Added **Codecraft API** gateway integration (`CODECRAFT_API_KEY`, `CODECRAFT_BASE_URL`, `CODECRAFT_MODEL`) to leverage the user's 1 million free tokens on frontier models (Claude 3.5 Sonnet / GPT-4o / DeepSeek), while preserving Groq Whisper Turbo for instant speech-to-text and browser Web Speech API for zero-cost TTS.
- Enabled **Technical Q&A Mode** for deep technical explanations (e.g., explaining RAG, architecture patterns) with code blocks and mental models without unwanted task logging proposals.
- Refined Cockpit layout: Removed redundant subheader bar inside `JarvisCockpit.tsx` to eliminate double-header clutter, dedicating the entire right column to the conversation stream, proposal cards, and full-width input bar.
- Removed deprecated `JarvisActionHUD` pop-up and routed header capsule + `Alt+J` shortcut directly to the `Jarvis AI` workspace.
- **Resolved 30-Second Latency Bottleneck (1.2-Second Response Engine)**:
  - Diagnosed exact cause of 30–60 second latency: OpenRouter's `llama-3.3-70b-instruct` was running on congested GPUs at only ~24 tokens/sec (31.1s for 763 tokens), while DeepSeek returned "Insufficient Balance" and Groq was referencing a deprecated model (`llama-3.3-70b-versatile`).
  - Benchmarked Groq LPU: `qwen/qwen3.8-27b` generates 763 tokens at **427.2 tokens/second in 1,243 ms (1.24 seconds)**.
  - Reordered provider cascade to prioritize **Groq LPU ultra-fast engine (`qwen/qwen3.8-27b`)** first for sub-2-second generation, with DeepSeek (`deepseek-flash`) and OpenRouter as fallbacks.
  - Set `GROQ_MODEL="qwen/qwen3.8-27b"` in Supabase secrets and redeployed `ai-assistant-chat`.
- Verification: Clean compilation and bundle build (`tsc -b && vite build` passing 100%).

---

### Session 10 — Offline & PWA
- Implemented `idb-keyval` offline snapshots
- Added `navigator.onLine` guards to all write operations in `mapStore` and `contentStore`
- Configured `vite-plugin-pwa` with Workbox; added dev-mode service worker unregistration to `main.tsx`
### Session 10 — Jarvis Cockpit & Ultra-Fast Prompt Engineering Studio
- Built Jarvis Prompt Studio with HUD Cockpit (`JarvisCockpit.tsx`), R-T-C-O-G framework prompt generation, and instant clipboard auto-copy.
- Fixed 30-50 second latency bottleneck in Supabase Edge Function `ai-assistant-chat`:
  - **Root Cause**: The monolithic `buildSystemPrompt` was 31,048 characters (~8,244 tokens), exceeding Groq's 8,000 ITPM limit, triggering HTTP 413 and forcing a fallback to OpenRouter at 24 tokens/sec.
  - **Fix**: Created specialized lightweight system prompt `buildPromptEngineeringSystemPrompt` (~500 tokens) and `buildTechnicalQaSystemPrompt` (~375 tokens).
  - **Expert Persona Enforcement**: Directed the LLM that the engineered prompt's `Role & Identity` MUST always be an authoritative Principal / Senior Staff Systems Architect with deep technical domain mastery, strictly preventing junior/trainee personas.
  - **Latency Achieved**: ~1.5 - 3.4 seconds on Groq LPU (`qwen/qwen3.8-27b`) at 420+ tokens/sec.
- Deployed updated edge function to Supabase project `ixmvqmfesibpnrjmvzuj`.
- Implemented **Sentient Personal AI Companion Architecture & Zero-Waste Intent Matrix**:
  - **Omni-Capable Persona**: Empowered Jarvis with Tony Stark J.A.R.V.I.S. demeanor—completely eliminated refusals like "I cannot answer about weather" or "I am only a work-tracking app". Jarvis can converse on weather, current events, philosophy, jokes, or deep engineering questions.
  - **Dynamic Location Auto-Resolution**: When the user asks about the weather in "my area" or without naming a city, auto-resolves their location from their timezone (`Asia/Colombo` $\to$ `Colombo, Sri Lanka`).
  - **Zero-Waste Credit Preservation & Free Search Engines**:
    - **Live Weather via Open-Meteo (100% FREE, 0 CREDITS)**: Replaced web search crawler for weather with Open-Meteo Meteorological Service (`api.open-meteo.com`). Fetches live temperature, feels-like, humidity, rain showers, wind speed, and WMO conditions in ~600ms without using ANY Tavily credits or API keys.
    - **General Web Search via DuckDuckGo (100% FREE, 0 CREDITS)**: Scrapes clean verified snippets for news/docs without consuming credits.
    - **Tavily Low-Credit Optimization**: Set `include_answer: false` and `max_results: 2`, reducing Tavily cost from 7 credits down to 1 credit as a fallback.
    - Timers / Kanban breaks (`pause`, `resume`, `finish`, `I am taking a 20 min break`): Search is strictly OFF (0 credit waste).
    - Work Journal & Meeting logs: Search is strictly OFF (0 credit waste).
    - Conceptual Engineering Theory ("What is RAG?"): Answered directly from Groq weights (0 credit waste).
  - **Fixed Explanation Truncation (Stopping Halfway)**:
    - Root cause: `qwen/qwen3.8-27b` had an enforced 1000 output tokens per minute (OTPM) ceiling on Groq free tier, truncating long answers with `finish_reason: length`.
    - Fix: Set `GROQ_MODEL="openai/gpt-oss-120b"` (120-billion parameter frontier model) with `max_tokens: 3500`, plus defensive unclosed-JSON string extraction. Tested and verified full 8,000+ character deep architectural breakdowns with zero cutoffs.
  - **Fixed Voice Narration Interruption**:
    - Root cause: Web Speech Synthesis was never cancelled when starting a recording or clicking push-to-talk, causing Jarvis to speak over the user while recording.
    - Fix: Added `stopSpeaking()` to `jarvisVoice.ts` and `jarvisStore.ts`. Pressing `SPEAK TO JARVIS (MIC)`, clicking the Orb, or typing/submitting text immediately kills active speech synthesis. Added dynamic button state (`INTERRUPT & SPEAK (MIC)`) and dedicated amber `Interrupt Narration` pill.
  - **Edge Function Deployed**: Live and verified on Supabase project `ixmvqmfesibpnrjmvzuj`.

---

### Session 11 — Pure Black Theme Refactor (OLED / Stealth Palette)
- **740 Color Transformations Across 75 Files**: Batch mapped all hardcoded blue-gray arbitrary Tailwind classes (`bg-[#0f1117]`, `bg-[#1e2433]`, `border-[#2d3748]`, etc.) to pure black (`#000000`), deep charcoal surfaces (`#080808`, `#0a0a0a`), and border accents (`#1a1a1a`).
- **Styles & Themes**: Updated `src/index.css` (custom scrollbars, React Flow canvas, BlockNote rich editor, Notion markdown styles) to the pure black theme.
- **Zero JS Logic Regressions**: CSS & class overrides strictly preserve all state machines, API calls, and animations. Clean TypeScript compilation with 0 errors.

---

### Session 12 — AI Email Meeting Reader, Notification Center & 1-Click Direct Join
- **Email Ingestion & Meeting Parser Service (`src/services/emailService.ts`)**:
  - Live Gmail API integration via OAuth access token.
  - Pre-loaded Realistic Developer Team Inbox (Sprint Planning on Google Meet, Emergency Architecture Review on Zoom, Client Sync on Teams) for immediate zero-config testing.
  - Smart heuristic and regex meeting extraction (titles, dates, start/end times, attendees, and meeting URLs for Google Meet, Zoom, Teams).
- **Email & Meeting State Management (`src/store/emailStore.ts` & `src/store/notificationStore.ts`)**:
  - Zustand stores with local storage persistence.
  - Automatic notification creation whenever a new email containing a meeting invite is synced or simulated.
  - Periodic meeting checks (every 60s) to notify user of meetings scheduled for today.
- **Notification Center & 1-Click Direct Join UI (`src/components/notifications/`)**:
  - `NotificationBell` with glowing unread badge in `AppHeader.tsx`.
  - `NotificationCenter` popover listing upcoming meetings and meeting invitations with **prominent "Click to Join" buttons** that open Google Meet or Zoom in a new tab with 1 click.
  - "Log Event" button to schedule meetings directly from notifications into the Work Journal.
  - "Check Emails Now" sync button.
- **Jarvis Conversational Workflow**:
  - Injected `recentEmailMeetings` into `contextSnapshot` in `src/store/assistantStore.ts`.
  - Added `isEmailCheck` intent to `supabase/functions/ai-assistant-chat/index.ts`.
  - User can ask: *"Jarvis, check my email for meetings"* or *"Did I get any meeting invites?"*
  - Jarvis scans recent emails, detects the invite, and drafts a `create_meeting_event` proposal with the direct join URL.
  - Preserved meeting links when approved in `assistantStore.ts` and rendered direct join buttons in `WorkJournalCard.tsx`.
- **Settings Configuration (`src/components/settings/EmailIntegrationSettings.tsx`)**:
  - Added Email & Meeting Reader Integration section in `SettingsPage.tsx` with live Gmail token input, test inbox toggles, and a live email simulator form.
- **Edge Function Deployed**: Deployed updated `ai-assistant-chat` to Supabase cloud. All TypeScript checks pass.

---

### Session 13 — 1-Click "Connect with Google" (Gmail & Google Calendar)
- **1-Click Google OAuth Integration (`src/services/googleAuth.ts`)**:
  - Configured Supabase OAuth redirect and Google Identity Services (GIS) in-place popup authorization.
  - Automatically requests read-only scopes:
    - ✉️ `https://www.googleapis.com/auth/gmail.readonly`
    - 📅 `https://www.googleapis.com/auth/calendar.readonly`
- **Google Calendar API Engine (`src/services/emailService.ts`)**:
  - Implemented `fetchLiveGoogleCalendarEvents(accessToken)` to query `https://www.googleapis.com/calendar/v3/calendars/primary/events`.
  - Automatically extracts Google Meet (`hangoutLink` or video conference data), Zoom, and Teams meeting links, start/end times, and attendee lists.
  - Concurrently fetches Google Calendar events and Gmail messages in `emailStore.syncEmails()`.
- **Session Token Capture (`src/store/authStore.ts`)**:
  - Automatically captures `session.provider_token` from Supabase Auth upon Google OAuth return and transfers it into `emailStore`.
- **UI Enhancements**:
  - Added primary 1-Click "Connect with Google" card with Google branding in `EmailIntegrationSettings.tsx` (`/settings`).
  - Added "Continue with Google" OAuth button in `AuthForm.tsx` (Login / Register pages).
  - Clean TypeScript build and live HMR verification.

### Session 14 — Smart Meeting Lifecycle & In-Place Work Journal Updates
- **Upcoming-Only & Recurrence Advance (`src/services/emailService.ts`)**:
  - Automatically calculates next upcoming occurrence for recurring meetings (advancing past occurrences to next future date).
  - Skips past non-recurring events (`< Date.now() - 30 * 60 * 1000`).
  - Strict rule: All incoming meeting invites have `summary: ''` (strictly empty placeholders awaiting actual meeting recap).
- **Auto-Create Empty Work Journal Placeholders (`src/store/emailStore.ts`)**:
  - `ensureMeetingPlaceholder(m)` checks both local state and database deduplication by date + title/time.
  - Automatically creates empty meeting log events in the Work Journal upon background sync or custom email simulation.
- **Autonomous Background Sync (`src/App.tsx`)**:
  - Bootstraps silent meeting & email sync on app mount and runs periodically every 15 minutes.
  - Zero manual clicking or visiting Settings required.
- **In-Place Update (Zero Duplicates) (`src/store/assistantStore.ts`)**:
  - Added `case 'update_meeting_event'` execution handler.
  - Updates target meeting event row in Supabase and `eventsByDate` in place without duplicating records.
  - Parses action items and optionally adds them to Kanban To Do.
  - Reversible via `undoAction`.
- **Interactive Multi-Meeting Disambiguation Card (`src/components/assistant/cards/WorkJournalCard.tsx`)**:
  - Supports `UpdateMeetingEventProposal`.
  - When multiple candidate meetings occurred in the same timeframe (e.g. 9-10 AM and 10-11 AM), renders an interactive radio pill selector allowing the user to select which meeting they attended before approving.
  - Displays in-place update banner when a single candidate is matched.
  - Custom `approveLabel="Approve & Update Entry"` on `ProposalCard`.
- **Edge Function Intelligence (`supabase/functions/ai-assistant-chat/index.ts`)**:
  - Added `recentMeetings` (today + yesterday with `hasSummary` flag) and local time awareness to `ContextSnapshot`.
  - Category A prompt recognizes post-meeting recaps, matches recent meeting time slots, and outputs `update_meeting_event` with target meeting ID and candidates.
  - Successfully deployed to Supabase project `ixmvqmfesibpnrjmvzuj`.

---

### Session 15 — Dual-Track Voice Mode, Comprehensive Reference Blueprint & Cloud Deploy (v98)
- **Single-Pass Dual-Stream Architecture (`supabase/functions/ai-assistant-chat/index.ts`)**:
  - Replaced two-pass LLM roundtrips with a single-pass dual-channel pipeline.
  - Structured output includes `replyText` (exhaustive visual reference) and `speechText` / `<!-- SPOKEN_VOICE: ... -->` (spoken voice).
  - 4-Tier Adaptive Spoken Cadence (Tier 1 Operational: 5-10s; Tier 2 Direct/Syntax: 20-35s; Tier 3 Strategic/Exam: 35-50s; Tier 4 Conceptual/RAG: 50-75s).
- **The Comprehensive Reference Standard (Screen Channel)**:
  - Enforced 5-section publication-grade structure for technical and exam questions: (1) Factors & Estimates Matrix Table, (2) Practical Milestone/Roadmap Table, (3) 4-5 Actionable Acceleration Strategies, (4) Definitive Bottom Line, and (5) Concrete Action Offerings.
  - Raised `turnMaxTokens` and fallback `max_tokens` from 1,200 to 2,800 to prevent output compression.
- **Copy to Clipboard Buttons**:
  - Added 1-click markdown copy buttons to both `JarvisAnswer.tsx` and `ChatMessageItem.tsx`.
- **Cloud Deployment (Supabase Edge Function)**:
  - Deployed updated `ai-assistant-chat` (v98) via Supabase CLI to live cloud project `ixmvqmfesibpnrjmvzuj`.

---

### Session 9 — Sharing System
- Deployed `share_link_setup.sql` RLS policies to production Supabase
- Built `SharedMapPage` with read-only canvas rendering
- Note: `CanvasToolbar` makes direct Supabase calls for share/revoke. Logged as known technical debt.

---

### Session 8 — Node Content Editor (BlockNote)
- Wired BlockNote `@blocknote/react` v0.47. Required `@blocknote/mantine` peer dependency.
- `SectionShell` CSS grid animation (`grid-rows-[1fr]` / `grid-rows-[0fr]`) avoids JS height measurement for accordion.
- Test mode implemented via `.notes-hidden .bn-editor { filter: blur(8px) }` CSS class toggle.
- `contentStore.updateContent()` fires immediately on every keystroke — debouncing is handled by `setTimeout(fn, 0)` flush, not a timer.

---

### Session 6 — Direction System & Backward Compat
- Added `direction` column to `nodes` table in Supabase
- Added `supportsDirection` flag to `mapStore` for backward compatibility
- Error codes `42703` and `PGRST204` both treated as "missing column" — retry write without `direction` field

---

### Session 5 — WaypointEdge Implementation
- Custom `WaypointEdge` component built from scratch using `EdgeLabelRenderer` + pointer events
- Key bug fixed: waypoints snapped back on drag release because `useEffect` syncing `storeWaypoints → localWaypoints` was firing during active drag. Fixed by adding `if (!dragInfo)` guard to the sync effect.
- Phantom midpoint dots appear on edge hover; dragging promotes them to real waypoint handles.
- Waypoints persisted as JSONB on `mindmaps.edge_waypoints` — see ADR-03.

---

*Update this file at the end of every development session. The AI agent reads this file first, every session, no exceptions.*
