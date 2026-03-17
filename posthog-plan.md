# PostHog Analytics Plan

## Implementation Status

**Phase 1 complete** (11 March 2026, branch `add-telemetry`). All events from the plan are instrumented and all 414 tests pass.

**Simplified** (17 March 2026). Switched to PostHog Cloud EU; composable refactored to remove `initAnalytics`/`initialized` complexity; `persistence: 'memory'` to avoid cookie banner requirement.

### What was built

| File                              | Purpose                                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/composables/usePosthog.ts` | Central PostHog wrapper. Top-level `posthog.init()` with EU cloud host hardcoded. Exports `posthog`, `capture()`, and `usePostHog()`. |
| `src/router/index.ts`             | Imports `posthog` directly and fires `$pageview` in `router.afterEach` for correct SPA navigation tracking                       |
| `src/test/setup.ts`               | Globally mocks `posthog-js` so tests never need a real key                                                                       |

Events are wired directly into the components and composables — no bus, no global store. All tracking calls go through `usePostHog()` / `capture()` so PostHog is never imported directly in component code.

### To activate

Add to `.env` (or `.env.local` if you don't want to commit the key):

```
VITE_PUBLIC_POSTHOG_KEY=phc_xxxx
```

The EU cloud host (`https://eu.i.posthog.com`) is hardcoded in the composable — no host env var needed. PostHog init runs unconditionally; if the key is undefined PostHog silently no-ops.

---

### Implementation notes & speedbumps

- **SPA pageviews**: PostHog's built-in `capture_pageview` only fires on the initial HTML load. Disabled it and wired `$pageview` into `router.afterEach` instead. Uses `window.location.origin + to.fullPath` to reconstruct the full URL correctly with hash routing.

- **`FilterSelectors` is shared between catalogue and datastore views**: Added an optional `analyticsContext: 'catalogue' | 'datastore'` prop. Events only fire when the prop is provided, so the component stays safe as a general-purpose filter widget. Both usage sites (`MetacatTable`, `EagerDatastoreDetail`, `LazyDatastoreDetail`) now pass the prop.

- **`RequiredProjectsWarning` didn't know its datastore context**: Added an optional `datastoreName` prop so `required_project_link_clicked` events can carry that context. Existing usages without the prop still work fine.

- **`EagerDatastoreTable` originally used `defineProps` without capturing the return value**: The `props` variable was needed to reference `props.datastoreName` in `capture()` calls. Changed to `const props = defineProps<...>()`.

- **Duplicate `const props =` typo**: One multi-edit pass produced `const props = const props = defineProps<...>()` in `EagerDatastoreTable.vue`. Caught immediately by the test run (syntax error), fixed in one follow-up edit.

- **`useQuickStartCode` needed `watch` imported**: Adding `watch(isXArrayMode, ...)` for mode toggle tracking required adding `watch` to the existing `{ computed, ref }` import.

- **`search_link_copied` fires at two points**: Normal path (URL fits within limit) and confirmed long-URL path. Both fire the same event name but with `url_exceeded_limit: true/false` as a property so you can distinguish them in PostHog.

---

## Next Steps

### Immediate (before merging)

- [ ] **Smoke-test in the browser** — check that events appear in the PostHog Cloud EU Live Events view.
- [ ] **Add `VITE_PUBLIC_POSTHOG_KEY` to CI/CD secrets** so production builds are instrumented.

### Soon

- [ ] **Build the core funnel in PostHog** once data starts flowing:
      `$pageview (/) → catalogue_row_detail_opened → $pageview (/datastore/:name) → quick_start_code_copied`
- [ ] **Set up a PostHog dashboard** with: top datastores viewed, top filters applied, code-copy rate, xarray vs ESM mode split.
- [ ] **Review the `catalogue_searched` data** after a few weeks to identify gap terms — search queries with no subsequent filter interaction may indicate missing catalogue coverage.

### Later / Optional

- [ ] **`EagerDatastoreTable` pagination** (`table_page_changed`) is wired but `@page` couldn't be confirmed in the template during this pass — verify it fires correctly in the browser.
- [ ] **Add `datastore_name` to the `$pageview` event** for datastore routes so PostHog path analysis doesn't collapse all `/datastore/:name` views into one URL.
- [ ] **Session recordings** — enable in PostHog project settings (off by default). Particularly valuable for watching filter interaction flows on large lazy datastores.
- [ ] **Funnels for ARE usage** — `open_are_clicked` is captured. Once enough data exists, analyse what filter state precedes ARE opens to understand which data workflows are most common.
- [ ] **`commit_sha_copied`** — very low traffic, consider dropping from the plan if it adds noise.

---

## Why PostHog

- App is **event-driven**, not page-view-driven — the core value is in interactions, not traffic
- Need **custom events with rich properties** (e.g. which datastore, which filters, which mode)
- **Session recordings** will help understand how scientists navigate the filter UI
- **Funnel analysis** on the core journey: `catalogue → datastore detail → code copied`
- URL-based filter state (`?model_filter=...`) means filter context is automatically capturable
- **PostHog Cloud EU** — data stored in EU region; no self-hosting overhead
- `persistence: 'memory'` — no cookies, no consent banner required

---

## Core User Journey (The Funnel)

```
Catalogue table loaded
  → Datastore row opened (modal or navigation)
    → Datastore detail page loaded
      → Filter(s) applied
        → Code copied (xarray or ESM mode)  ← PRIMARY SUCCESS METRIC
```

---

## Events to Track

### Page/View Events

| Event                     | Properties                                                            | Notes                                                                         |
| ------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `$pageview`               | `$current_url` (auto)                                                 | Fired in `router.afterEach` on every route transition — covers SPA navigation |
| `datastore_detail_viewed` | `datastore_name`, `loading_strategy` (`eager`/`lazy`), `record_count` | On datastore detail mount                                                     |

### Catalogue Interactions

| Event                           | Properties                                      | Notes                                                 |
| ------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| `catalogue_searched`            | `query` (debounced 500ms)                       | Global search input; gap analysis for uncovered terms |
| `catalogue_filter_applied`      | `column`, `values[]`                            | Filter selector on home table                         |
| `filter_dropdown_opened`        | `column`, `context: 'catalogue' \| 'datastore'` | Opened regardless of selection; intent signal         |
| `catalogue_row_detail_opened`   | `datastore_name`                                | MetacatRowDetailModal opened                          |
| `datastore_detail_link_clicked` | `datastore_name`                                | "View datastore" from row modal                       |

### Datastore Detail Interactions

| Event                       | Properties                                                                      | Notes                                         |
| --------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| `datastore_filter_applied`  | `datastore_name`, `column`, `values[]`, `result_count`                          | Filter changed on detail page                 |
| `datastore_filters_cleared` | `datastore_name`                                                                | Clear filters button                          |
| `datastore_table_toggled`   | `datastore_name`, `visible: boolean`                                            | Show/hide table toggle                        |
| `tag_chip_clicked`          | `datastore_name`, `column`, `value`                                             | TagList chip click → auto-filters detail view |
| `quick_start_mode_toggled`  | `datastore_name`, `mode: 'xarray' \| 'esm'`                                     | xarray ↔ ESM switch                          |
| `quick_start_code_copied`   | `datastore_name`, `mode`, `active_filters`, `num_datasets`                      | 🎯 PRIMARY METRIC                             |
| `search_link_copied`        | `datastore_name`, `active_filters`, `url_length`, `url_exceeded_limit: boolean` | Share URL                                     |
| `open_are_clicked`          | `datastore_name`, `mode`, `active_filters`                                      | Copy & Open ARE button                        |

### Table UI

| Event                   | Properties                                                                    | Notes                                      |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| `table_columns_changed` | `context: 'catalogue' \| 'datastore'`, `datastore_name?`, `visible_columns[]` | Column visibility toggled                  |
| `table_page_changed`    | `context: 'catalogue' \| 'datastore'`, `datastore_name?`, `page`, `page_size` | Pagination — are people going past page 1? |

### Onboarding / UI

| Event                           | Properties                       | Notes                      |
| ------------------------------- | -------------------------------- | -------------------------- |
| `welcome_modal_shown`           | `trigger: 'auto' \| 'button'`    | First visit vs re-opened   |
| `welcome_modal_dont_show_again` | —                                | Checked "don't show again" |
| `feedback_button_clicked`       | —                                | GitHub issue button        |
| `commit_sha_copied`             | —                                | Probably low priority      |
| `required_project_link_clicked` | `project_code`, `datastore_name` | NCI project access links   |

---

## Decisions

1. **PostHog Cloud EU** ✅
   - Using `https://eu.i.posthog.com` — hardcoded in composable, no env var needed
   - `persistence: 'memory'` — no cookies written, no consent banner required
   - Self-hosting on ARDC Nectar was considered but dropped in favour of simplicity

2. **Log full filter objects** ✅
   - No PII risk — all values are scientific metadata (model names, realms, frequencies, variables)
   - Full filter context on `quick_start_code_copied` is the most valuable signal

3. **Log filter interactions** ✅ (added to events table)
   - `filter_dropdown_opened` — which dimensions scientists explore (even if they don't select)
   - Tag chip clicks (`datastore_detail_link_clicked` via TagList) — distinct path from dropdown

4. **Debounce `catalogue_searched` at 500ms** ✅
   - Captures final search intent, not keystrokes
   - Primary use: gap analysis — what are people searching for that the dropdowns don't cover?

5. **Identifying users**
   - Anonymous only (PostHog auto-assigns anonymous IDs) — no auth system in app
   - Revisit if NCI auth is ever added

6. **SPA pageviews via router `afterEach`** ✅
   - Disable PostHog's auto-capture (`capture_pageview: false`) — it only fires once on initial HTML load
   - Hook `router.afterEach` to manually fire `$pageview` on every client-side route transition
   - Necessary because Vue Router navigation doesn't trigger browser load events (app uses hash routing)
   - Replaces the removed `catalogue_viewed` event — PostHog's `$pageview` with the URL is equivalent

7. **Top-level init in `usePosthog.ts`** ✅
   - `posthog.init()` runs at module import time — no `initAnalytics()` call needed in `main.ts`
   - PostHog silently no-ops if the key is `undefined` (e.g. in dev without `.env`)

8. **Mock PostHog in Vitest** ✅
   - Add mock to existing `test/setup.ts`

---

## Implementation Plan

### 1. Install

```bash
npm install posthog-js
```

### 2. Initialise in `usePosthog.ts`

Top-level init — runs at module import, no explicit call needed in `main.ts`.

```ts
posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: 'https://eu.i.posthog.com',
  defaults: '2026-01-30',
  persistence: 'memory',
  capture_pageview: false,
  capture_pageleave: true,
});
```

### 3. `usePostHog()` composable

Exports `posthog` directly, a standalone `capture()` function, and a `usePostHog()` composable returning `{ capture }`. Keeps all component code clean and makes mocking in tests trivial.

### 4. Wire up events

Per the events table above, add `track()` calls at each interaction site.

### 5. Mock in tests

In `test/setup.ts`, mock `posthog-js` so test suites don't need a real key and events don't fire.

### 6. `.env` setup

```
VITE_PUBLIC_POSTHOG_KEY=phc_xxxx
```

No host var needed — EU cloud endpoint is hardcoded.


