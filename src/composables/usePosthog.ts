import posthog from 'posthog-js';

let initialized = false;

/**
 * Initialise PostHog. Must be called once at app startup (main.ts).
 *
 * No-ops when VITE_POSTHOG_KEY is not set, so analytics are safely
 * disabled in dev/test environments.
 */
export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;

  posthog.init(key, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://app.posthog.com',
    // We fire $pageview manually via router.afterEach so that SPA navigation is
    // captured correctly (the browser never triggers a real page load event).
    capture_pageview: false,
  });

  initialized = true;
}

/**
 * Fire a PostHog event. Safe to call unconditionally — silently no-ops when
 * PostHog has not been initialised (e.g. no VITE_POSTHOG_KEY in env).
 */
export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}

/**
 * Vue composable that returns {@link capture} for use inside component setup().
 * Also usable directly outside components (router, composables) via the named
 * export above.
 */
export function usePostHog() {
  return { capture };
}
