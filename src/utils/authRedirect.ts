/**
 * Authentication and Redirection Helper
 * 
 * Intelligently manages redirection after login, register, and OAuth sign-in.
 * Specifically handles standalone PWA mode (iOS/iPadOS "Add to Home Screen" apps)
 * and mobile viewports so that users are seamlessly routed to /mobile without getting
 * trapped in the desktop /dashboard.
 */

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS / iPadOS Safari standalone mode
  const isIosStandalone = (window.navigator as any)?.standalone === true;
  // Standard PWA standalone query (Android, Chrome, Safari 17+)
  const isPwaStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
  return Boolean(isIosStandalone || isPwaStandalone);
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768;
}

const REDIRECT_STORAGE_KEY = 'jarvis_auth_redirect_target';

export function setIntendedRedirect(path: string): void {
  try {
    if (path && path !== '/login' && path !== '/register' && path.startsWith('/')) {
      localStorage.setItem(REDIRECT_STORAGE_KEY, path);
    }
  } catch (e) {
    console.warn('Failed to set intended redirect:', e);
  }
}

export function getAndClearIntendedRedirect(): string | null {
  try {
    const target = localStorage.getItem(REDIRECT_STORAGE_KEY);
    if (target) {
      localStorage.removeItem(REDIRECT_STORAGE_KEY);
      if (target !== '/login' && target !== '/register' && target.startsWith('/')) {
        return target;
      }
    }
  } catch (e) {
    console.warn('Failed to get intended redirect:', e);
  }
  return null;
}

export function peekIntendedRedirect(): string | null {
  try {
    const target = localStorage.getItem(REDIRECT_STORAGE_KEY);
    if (target && target !== '/login' && target !== '/register' && target.startsWith('/')) {
      return target;
    }
  } catch {}
  return null;
}

/**
 * Calculates where the user should be redirected after successful authentication.
 * Priority:
 * 1. Explicitly stored redirect target in localStorage (e.g. user visited /mobile before login)
 * 2. Query parameter ?redirect=... or ?returnTo=...
 * 3. Standalone PWA app (installed on iPhone / iPad) -> ALWAYS /mobile
 * 4. Mobile screen viewport (<=768px) unless desktop view was explicitly requested
 * 5. Default fallback -> /dashboard
 */
export function getPreferredAuthDestination(fallback = '/dashboard'): string {
  // 1. Explicit target stored in localStorage
  const stored = peekIntendedRedirect();
  if (stored) {
    getAndClearIntendedRedirect();
    return stored;
  }

  // 2. Query parameter in current URL
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const redirectParam = params.get('redirect') || params.get('returnTo');
    if (redirectParam && redirectParam.startsWith('/') && redirectParam !== '/login' && redirectParam !== '/register') {
      return redirectParam;
    }
  }

  // 3. Standalone PWA mode (installed to Home Screen on iOS / iPadOS)
  if (isStandaloneApp()) {
    if (sessionStorage.getItem('prefer_desktop') === 'true') {
      return '/dashboard';
    }
    return '/mobile';
  }

  // 4. Mobile screen size
  if (isMobileViewport()) {
    if (sessionStorage.getItem('prefer_desktop') === 'true') {
      return '/dashboard';
    }
    return '/mobile';
  }

  // 5. Desktop fallback
  return fallback;
}
