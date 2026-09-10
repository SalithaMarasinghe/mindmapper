# AI Workflow Rules

> **Context File 5 of 6** · Last updated: 2026-09-10
> Part of the Spec-Driven Agentic Development context system for the MindMap Tool.
>
> **IMPORTANT:** This file is addressed directly to the AI coding agent. It defines mandatory behavioral constraints. These rules are not suggestions. They are the operating protocol for this project. Non-compliance introduces bugs, architectural drift, and context collapse.

---

## RULE 0 — The Golden Rule

> **Work on exactly one scoped feature, subsystem, or bug at a time. Never cross a system boundary within a single execution step.**

A "system boundary" is defined as the border between any two of the following layers:

- Auth layer (`authStore`, Supabase Auth)
- Data persistence layer (Supabase tables, RLS policies, SQL)
- Canvas state layer (`mapStore`, ReactFlow, `treeLayout.ts`)
- Node content layer (`contentStore`, `NodeEditor`, BlockNote)
- Offline layer (`offlineStore`, `lib/offlineStore.ts`, IndexedDB)
- Sharing layer (`sharing.ts`, `SharedMapPage`, `share_link_setup.sql`)
- UI / Styling layer (Tailwind, `index.css`, component visuals)
- Export layer (`exportPDF.ts`, `exportBranchToPdf.ts`, `exportImport.ts`)

**Examples of Golden Rule violations:**

❌ Implementing a new node type AND updating the database schema in the same step.
❌ Fixing a canvas drag bug AND refactoring the content store because "while I'm in here."
❌ Adding a new Tailwind color AND modifying a Zustand store action in the same response.
❌ Updating `treeLayout.ts` AND `MindmapCanvas.tsx` AND `mapStore.ts` simultaneously without explicit spec authorization.

**What "one subsystem at a time" looks like in practice:**

✅ Spec says: "Add emoji support to LeafNode." → Touch `LeafNode.tsx` and `types/index.ts` only.
✅ Spec says: "Add the `direction` column to the nodes table." → Write SQL migration only. Do not update `mapStore.ts` in the same step.
✅ Spec says: "Update `mapStore.saveNodePositions` to use the new `direction` column." → Touch `mapStore.ts` only.

---

## RULE 1 — Session Initialization Protocol

**At the start of every new chat session, before generating any code, analysis, or plan, you MUST execute the following steps in order:**

### Step 1 — Read the Progress Tracker
```
Read: context/progress_tracker.md
```
Identify:
- What phase the project is currently in
- Which features are marked `[DONE]`, `[IN PROGRESS]`, or `[PENDING]`
- The last architectural decision logged
- Any open issues or blockers noted

### Step 2 — Read All Context Files
Read every file in the `context/` directory in this order:
```
1. context/project_overview.md    → What we are building and why
2. context/architecture.md        → Stack, invariants, data model, integration rules
3. context/code_standards.md      → TypeScript conventions, patterns, error handling
4. context/ui_context.md          → Color palette, node visuals, canvas configuration
5. context/ai_workflow_rules.md   → This file (already loaded)
6. context/progress_tracker.md    → Current build state (already read in Step 1)
```

### Step 3 — Acknowledge Before Acting
Before writing any code, output a brief acknowledgment in this exact format:

```
SESSION INITIALIZED
Current phase: [phase name from tracker]
Last completed: [feature name]
Active task: [feature currently in progress, or "none"]
Ready to proceed with: [what the developer is asking for today]
```

**Do not skip this step.** It is the mechanism that prevents context collapse across sessions. If the developer tells you to skip it "to save time," acknowledge that you understand but proceed with initialization anyway — the 30 seconds this takes prevents hours of rework.

---

## RULE 2 — Execution Protocol

When the developer hands you a feature spec (a `.md` file or an inline description), follow this exact sequence:

### Step 1 — Read and Confirm the Spec
Read the entire spec before responding. Do not begin implementation mid-read. After reading, output a brief confirmation:

```
SPEC UNDERSTOOD
Feature: [feature name]
Files to be modified: [exhaustive list]
Files explicitly NOT to be touched: [everything else]
Dependencies: [any prior spec that must be complete first]
Verification checklist: [list the acceptance criteria from the spec]
```

If the spec is ambiguous, ask one clarifying question before proceeding. Do not assume and build the wrong thing.

### Step 2 — Update the Progress Tracker
Before writing implementation code, update `context/progress_tracker.md`:
- Change the feature's status to `[IN PROGRESS]`
- Log the date and the specific task starting

### Step 3 — Implement Exactly What Is Specified
Implement the feature. Apply the following constraints rigidly:

- **No gold-plating.** If the spec does not ask for it, do not build it. A spec that says "add a delete button to the context menu" does not authorize you to refactor the context menu layout or add animations.
- **No preemptive abstractions.** Do not extract a helper function, create a new hook, or add a utility unless the spec explicitly requires reuse.
- **No dependency additions** without explicit developer approval. Do not `npm install` anything not listed in the spec.
- **Apply code standards.** Every line of code must comply with `context/code_standards.md` — TypeScript conventions, import order, `import type` for type-only imports, no `any` casts, offline guards on all write operations.
- **Apply UI context.** Every visual element must use only the colors, radii, shadows, and spacing documented in `context/ui_context.md`.
- **Apply architecture invariants.** Every integration must respect the five invariants in `context/architecture.md`:
  - Single Supabase client from `lib/supabase.ts`
  - No direct Supabase calls from components (except `SharedMapPage`)
  - ReactFlow state is display-only; Zustand is truth
  - `NodeType` enum is immutable
  - All writes guard `navigator.onLine`

### Step 4 — Self-Review Before Submitting
Before presenting code to the developer, run this internal checklist:

```
[ ] Does this code touch only the files listed in the spec confirmation?
[ ] Does every new async store action start with an offline guard?
[ ] Does every import type use `import type` where applicable?
[ ] Does every new color value appear in context/ui_context.md?
[ ] Does every new interface use `interface`, not `type`?
[ ] Does every useEffect have all dependencies listed and a cleanup if needed?
[ ] Did I add anything the spec did not ask for?  (If yes → remove it)
[ ] Did I modify any file the spec did not mention?  (If yes → undo it)
```

If any checkbox fails, fix it silently before responding. Do not present failing code and flag it as a known issue.

### Step 5 — Update the Progress Tracker
After the developer confirms the implementation is correct:
- Change the feature's status to `[DONE]`
- Log any architectural decisions made during implementation (new DB columns, new invariants, deviations from the spec and why)
- Note any follow-up tasks that surfaced

---

## RULE 3 — Debugging Protocol (The `current_issues.md` Rule)

> **Never panic-fix. Never accept a raw error log as an input and immediately write corrective code.**

Bugs are handled as a structured, two-phase process: **Analysis First, Code Second.**

### Phase A — Document the Bug (`current_issues.md`)

The developer will log bugs in `context/current_issues.md`. The format they will use:

```markdown
## Issue: [Short descriptive title]

**Observed behavior:** [Exactly what the user sees happening]
**Expected behavior:** [Exactly what should happen instead]
**Reproduction steps:** [How to trigger it consistently]
**Error log:** [Paste exact error message or console output]
**Affected files (suspected):** [Developer's best guess — may be wrong]
**Screenshot:** [Link to file in screenshots/ if visual issue]
```

When the developer says "Read `current_issues.md` and analyze this bug," execute the following:

### Phase B — Root Cause Analysis

**Step B1 — Re-read relevant context files**
Before forming any opinion, re-read the architecture invariants and the code standards relevant to the affected subsystem. Do not rely on what you think you remember about the codebase.

**Step B2 — Trace the data flow**
Map the exact execution path that produces the bug. Name the specific functions, store actions, and component lifecycle events involved. Do not guess — trace.

**Step B3 — Identify the root cause (not the symptom)**

The symptom is what the user sees. The root cause is the broken assumption, race condition, stale closure, or incorrect state update that produces it.

Examples of root-cause thinking:
- ❌ Symptom: "The waypoint snaps back on drag release."
- ✅ Root cause: "The `useEffect` that syncs `storeWaypoints → localWaypoints` fires during the active drag because `dragInfo` is not checked, overwriting the live position before the Supabase persist completes."

**Step B4 — Output the analysis in this exact format:**

```
ROOT CAUSE ANALYSIS
Issue: [Title from current_issues.md]

Data flow trace:
[Step-by-step trace of what happens, naming exact files and functions]

Root cause:
[One precise sentence identifying the broken assumption or race condition]

Affected files:
[Exhaustive list of files that must change to fix this]

Proposed fix:
[Describe the fix in plain English — do NOT write code yet]

Risk assessment:
[What else could break if this fix is applied? What must be regression-tested?]

Awaiting your approval to implement.
```

**Step B5 — STOP. Wait for explicit developer approval.**

Do not write a single line of corrective code until the developer responds with an explicit green light (e.g., "approved," "go ahead," "implement it"). If the developer asks questions about the analysis, answer them. If they propose a different fix, evaluate it against the root cause and advise. Only implement when authorized.

### Phase C — Implement the Fix

Once approved:
- Implement only the fix described in the approved plan.
- Do not refactor surrounding code "while you're in there."
- Do not add tests, logging, or comments not requested.
- Apply the same self-review checklist from Rule 2, Step 4.
- Update `context/current_issues.md` to mark the issue as `[RESOLVED]` with a one-line note on the fix applied.

---

## RULE 4 — Scope Containment

> **You are not allowed to modify a file that is not explicitly named in the current feature spec or bug fix plan.**

This is not about trust — it is about predictability. Unrequested file modifications are the primary source of regression bugs in AI-assisted development. The following behaviors are banned:

### Banned Behaviors

❌ **Opportunistic refactoring.** "I noticed this function in `mapsStore.ts` could be cleaner, so I updated it while building the new feature." → Revert it.

❌ **Preemptive compatibility fixes.** "I updated `types/index.ts` because the new feature will probably need it later." → Do not modify `types/index.ts` until a spec explicitly requires it.

❌ **Style normalization.** "I noticed some inconsistent Tailwind classes in `BranchNode.tsx` so I cleaned them up." → Do not touch `BranchNode.tsx` unless the spec says to.

❌ **Import cleanup.** "I removed some unused imports I spotted in `NodePage.tsx`." → Do not touch `NodePage.tsx` unless the spec says to.

❌ **Adding console.log for debugging and leaving them in.** Remove all `console.log` statements before submitting. `console.error` and `console.warn` are permitted only where the existing codebase already uses them for error handling.

### The "One Edit, One File" Discipline

If a bug fix or feature genuinely requires touching five files, the spec must name all five. If you believe a file not mentioned in the spec also needs to change, you must:

1. Stop.
2. Explicitly tell the developer: "This fix also requires modifying `X.tsx` because `[reason]`. Is that within scope?"
3. Wait for confirmation before touching that file.

### Acceptable Side Effects

The only unrequested modifications that are acceptable without explicit developer approval:

- Updating `context/progress_tracker.md` (required by the execution protocol)
- Marking an issue as `[RESOLVED]` in `context/current_issues.md`
- Fixing a TypeScript compile error in a file you are already modifying, **where the error was introduced by your own edit**

---

## RULE 5 — Communication Standards

### When You Are Uncertain

If you are not sure how a part of the codebase works, **ask before assuming.** The cost of one clarifying question is always lower than the cost of implementing the wrong thing and having to reverse it.

Format for uncertainty:

```
CLARIFICATION NEEDED
Before implementing [feature/fix], I need to confirm:
1. [Specific question]
2. [Specific question]
Proceeding without this risks: [brief risk description]
```

### When the Spec Conflicts with the Architecture

If a feature spec asks you to do something that violates an invariant in `context/architecture.md`, you must:

1. Do not implement the conflicting part silently.
2. Immediately flag it:

```
INVARIANT CONFLICT DETECTED
The spec asks for: [what the spec says]
This conflicts with Invariant N: [quote the invariant]
Options:
  A. [Alternative approach that respects the invariant]
  B. [Another alternative]
  C. Update the invariant (requires developer to update context/architecture.md first)
Awaiting direction.
```

### When You Complete a Step

Keep completion messages brief. Use this format:

```
DONE: [Feature/fix name]
Files modified: [list]
Tracker updated: Yes
Notes: [Any decisions made, deviations from spec, or follow-ups to log]
```

Do not write paragraph summaries of what you just built. The code and the tracker are the record. Verbosity in completion messages is noise.

---

## RULE 6 — What You Must Never Do

A hard list. No exceptions, no edge cases, no "but in this situation..."

| Prohibited Action | Why |
|---|---|
| Call `createClient()` outside `lib/supabase.ts` | Breaks session context and JWT attachment |
| Write `as any` to escape the TypeScript type system | Masks real errors; violates `noUnusedLocals` intent |
| Import a new npm package without developer approval | Introduces untested dependencies and lockfile drift |
| Add a new hex color not in `context/ui_context.md` | Breaks design system cohesion |
| Modify the `NodeType` union without a dedicated spec | Touches 8+ files simultaneously; violates Golden Rule |
| Write a Supabase mutation without an `navigator.onLine` guard | Causes silent data loss in offline sessions |
| Leave a `console.log` in submitted code | Pollutes production console output |
| Implement a feature from the "Out of Scope" list in `project_overview.md` | Violates MVP scope regardless of how "easy" it seems |
| Use ReactFlow's internal node state as the source of truth for persistence | Violates Architecture Invariant 3 |
| Suppress `react-hooks/exhaustive-deps` with `// eslint-disable` | Masks dependency bugs that cause stale closures |
| Write a `useEffect` without considering cleanup | Memory leaks and event listener accumulation |
| Execute a bug fix before completing root cause analysis | The primary cause of fix-induced regressions |

---

*This file is part of the 6-file context system used to maintain AI agent coherence across development sessions. It must be re-read at the start of every new session before issuing any feature spec.*
