import posthog from 'posthog-js';

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: '2026-01-30',
  persistence: 'memory',
  capture_pageview: false,
  capture_pageleave: true,
});

export { posthog };

export function capture(event: string, properties?: Record<string, unknown>): void {
  posthog.capture(event, properties);
}

export function usePostHog() {
  return { capture };
}
