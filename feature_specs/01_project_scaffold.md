# SPEC-01: Project Scaffold & Infrastructure

> **Status:** DONE
> **Session:** 1
> **Tracker ref:** SPEC-01

---

## Goal

Bootstrap the full development environment for the MindMap Tool: a Vite + React + TypeScript SPA with Tailwind CSS v4, React Router v7, Zustand v5, and Supabase as the backend. The result must be a deployable shell on Vercel with routing and the Supabase client wired, but no feature logic yet.

---

## Design / Technical Constraints

- **Build tool:** Vite 8 with `@vitejs/plugin-react`. No Next.js. No SSR.
- **Language:** TypeScript 6 with `strict: false` but the following enforced: `noUnusedLocals: true`, `noUnusedParameters: true`, `verbatimModuleSyntax: true`, `noFallthroughCasesInSwitch: true`.
- **Styling:** Tailwind CSS v4 imported via `@import "tailwindcss"` at the top of `src/index.css`. No separate `tailwind.config.ts` file needed — v4 uses CSS-first configuration.
- **Import alias:** Configure `@/*` → `./src/*` in both `tsconfig.app.json` (`paths`) and `vite.config.ts` (`resolve.alias`).
- **Supabase client:** Create exactly ONE instance in `src/lib/supabase.ts` using `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`. This is the only file allowed to call `createClient`.
- **Environment variables:** Only two vars needed: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Create `.env.example` with both keys (empty values).
- **Deployment:** Create `vercel.json` at project root with a single catch-all SPA rewrite rule: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`. This is required for React Router to work on Vercel — add it before the first deploy.
- **Service worker:** In `main.tsx`, register `/sw.js` only in `import.meta.env.PROD`. In development, unregister all existing service workers and clear all caches.

---

## Implementation Steps

### `src/lib/supabase.ts`
- Import `createClient` from `@supabase/supabase-js`
- Read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `import.meta.env`
- Export a single `supabase` constant — the only Supabase client instance in the project

### `src/types/index.ts`
- Define and export all shared domain types: `NodeType` (`'root' | 'branch' | 'leaf'`), `NodeDirection` (`'left' | 'right' | 'top' | 'bottom'`), `Waypoint`, `EdgeWaypoints`, `MindmapNode`, `NodeContent`, `MindmapMeta`, `MapShare`, `UserProfile`, `AppSettings`, `ExportedMap`
- Define and export `DEFAULT_BRANCH_COLORS: string[]` — an array of exactly 10 hex color strings
- Define and export `ApiResult<T>` interface: `{ data: T | null; error: string | null }`
- Define `SaveStatus` type: `'saved' | 'unsaved' | 'saving' | 'failed'`

### `src/index.css`
- Import Tailwind v4 via `@import "tailwindcss"`
- Define `@theme {}` block with custom tokens: `--color-paper`, `--color-ink`, `--color-ink-soft`, `--color-root`, `--color-branch`, `--color-leaf`
- Set global dark background: `html, body { background-color: #0f1117; color: #e2e8f0; }`
- Set body font: `body { font-family: 'Satoshi', sans-serif; }`

### `src/App.tsx`
- Create the route tree using `<Routes>` from `react-router-dom`
- Include a `<Toaster position="top-right" />` from `react-hot-toast` at the root level
- Define route placeholders for all known routes: `/`, `/login`, `/register`, `/dashboard`, `/map/:mapId`, `/map/:mapId/node/:nodeId`, `/share/:token`, `/settings`
- Wrap protected routes in a `<ProtectedRoute>` outlet (stub component for now — just renders `<Outlet />`)

### `src/main.tsx`
- Wrap `<App />` in `<StrictMode>` and `<BrowserRouter>`
- Implement service worker registration/unregistration logic as described in constraints

### `vercel.json` (project root)
- Single catch-all rewrite rule

### `.env.example` (project root)
- Two keys with empty values

### `tsconfig.app.json`
- Set `target: "es2023"`, `moduleResolution: "bundler"`, `verbatimModuleSyntax: true`
- Enable `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`
- Add `paths: { "@/*": ["./src/*"] }`

---

## Verification Checklist

- [ ] `npm run dev` starts without TypeScript errors
- [ ] Navigating to `http://localhost:5173/` renders without crashing
- [ ] `import { supabase } from '@/lib/supabase'` resolves correctly in any file
- [ ] `vercel.json` exists at project root — deploy to Vercel and confirm `/dashboard` does not return a 404 on page refresh
