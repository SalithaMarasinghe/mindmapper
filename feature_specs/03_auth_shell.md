# SPEC-03: Authentication & Route Protection

> **Status:** DONE
> **Session:** 2
> **Tracker ref:** SPEC-03

---

## Goal

Implement full email/password authentication backed by Supabase Auth, with a persistent session that survives page reloads. Protect all authenticated routes behind a `ProtectedRoute` component that redirects unauthenticated users to `/login`. The auth layer must be fully initialized before any protected component attempts to fetch data.

---

## Design / Technical Constraints

- **State manager:** `authStore` (Zustand). All auth state and actions live here. No component may call `supabase.auth.*` directly — all calls route through the store.
- **Session hydration timeout:** Wrap `supabase.auth.getSession()` in a `Promise.race` with a 4-second timeout. If the timeout fires first, set `isLoading: false` and `user: null`. This prevents a permanent loading spinner on network failure.
- **Reactive session sync:** Subscribe to `supabase.auth.onAuthStateChange` in `initAuth()`. Update `user` and `profile` on every `SIGNED_IN`, `SIGNED_OUT`, and `TOKEN_REFRESHED` event. The subscription must be set up once and never torn down.
- **`ProtectedRoute` guard:** Read `user` and `isLoading` from `useAuthStore()`. While `isLoading === true`, render a full-screen spinner (`<Loader2 className="h-8 w-8 animate-spin text-teal-600" />`). If `isLoading === false` and `user === null`, `<Navigate to="/login" replace />`. Otherwise render `<Outlet />`.
- **Store access in store actions:** Other Zustand stores that need the current user must call `useAuthStore.getState().user` — a synchronous snapshot. They must NEVER call `useAuthStore()` (the hook) inside a store action.
- **Forms:** Email + password fields. No OAuth, no magic link, no social login for MVP.
- **Styling:** Dark theme. Input fields: `bg-[#1e2433] border border-[#2d3748] text-slate-100`. Primary CTA button: `bg-teal-600 hover:bg-teal-700`.

---

## Implementation Steps

### `src/store/authStore.ts`
- Create Zustand store with state: `user: User | null`, `profile: UserProfile | null`, `isLoading: boolean`, `error: string | null`
- Implement `initAuth()`: call `Promise.race([supabase.auth.getSession(), 4-second timeout reject])`. On success, set `user` from session. On timeout or error, set `user: null`. Always set `isLoading: false`. Then subscribe to `onAuthStateChange`.
- Implement `signUp(email, password, displayName)`: call `supabase.auth.signUp(...)`. On success, insert a row into `profiles` with `display_name`. Return `ApiResult<null>`.
- Implement `signIn(email, password)`: call `supabase.auth.signInWithPassword(...)`. Return `ApiResult<null>`.
- Implement `signOut()`: call `supabase.auth.signOut()`. Set `user: null`, `profile: null`.
- Implement `fetchProfile(userId)`: SELECT from `profiles` WHERE `id = userId`. Set `profile` in state.
- Implement `updateProfile(updates)`: UPDATE `profiles` WHERE `id = user.id`. Merge updates into `profile` state.
- Call `initAuth()` immediately at store creation (outside the store factory, at module level)

### `src/components/auth/ProtectedRoute.tsx`
- Import `useAuthStore`
- If `isLoading`: return centered full-screen spinner div
- If `!user`: return `<Navigate to="/login" replace />`
- Otherwise: return `<Outlet />`

### `src/components/auth/AuthForm.tsx`
- Shared form component used by both `LoginPage` and `RegisterPage`
- Props: `mode: 'login' | 'register'`, `onSubmit: (email, password, displayName?) => Promise<void>`, `isLoading: boolean`, `error: string | null`
- Fields: email, password, displayName (register only)
- Submit button shows `<Loader2>` spinner when `isLoading`
- Error shown as a red alert box below the form

### `src/pages/LoginPage.tsx`
- Use `useAuthStore` to call `signIn(email, password)`
- On success, navigate to `/dashboard`
- On error, display the error string from `ApiResult`
- Include a "Don't have an account? Register" link to `/register`

### `src/pages/RegisterPage.tsx`
- Use `useAuthStore` to call `signUp(email, password, displayName)`
- On success, navigate to `/dashboard`
- Include a "Already have an account? Login" link to `/login`

### `src/App.tsx` (update)
- Replace the `ProtectedRoute` stub with the real component
- Ensure `/share/:token` remains OUTSIDE the `<ProtectedRoute>` wrapper — public access is enforced by RLS, not by the route guard

---

## Verification Checklist

- [ ] New user can register with email + password and is redirected to `/dashboard`
- [ ] Registered user can sign in, close the tab, reopen, and land directly on `/dashboard` (session persisted)
- [ ] Navigating directly to `/dashboard` while logged out redirects to `/login`
- [ ] Navigating directly to `/share/:token` while logged out renders the page (no redirect to login)
