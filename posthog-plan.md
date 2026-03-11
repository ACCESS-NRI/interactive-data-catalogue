# PostHog Analytics Plan

## Implementation Status

**Phase 1 complete** (11 March 2026, branch `add-telemetry`). All events from the plan are instrumented and all 414 tests pass.

### What was built

| File                              | Purpose                                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/composables/useAnalytics.ts` | Central PostHog wrapper. `initAnalytics()` gates init behind `VITE_POSTHOG_KEY`. `track()` is a safe no-op when not initialised. |
| `src/main.ts`                     | Calls `initAnalytics()` at app startup                                                                                           |
| `src/router/index.ts`             | Fires `$pageview` in `router.afterEach` for correct SPA navigation tracking                                                      |
| `src/test/setup.ts`               | Globally mocks `posthog-js` so tests never need a real key                                                                       |

Events are wired directly into the components and composables — no bus, no global store. All tracking calls go through `useAnalytics()` / `track()` so PostHog is never imported directly in component code.

### To activate

Create `.env.local` (gitignored) with:

```
VITE_POSTHOG_KEY=phc_xxxx
VITE_POSTHOG_HOST=https://your-nectar-instance
```

No key → no tracking. Safe to deploy without analytics configured.

---

### Implementation notes & speedbumps

- **SPA pageviews**: PostHog's built-in `capture_pageview` only fires on the initial HTML load. Disabled it and wired `$pageview` into `router.afterEach` instead. Uses `window.location.origin + to.fullPath` to reconstruct the full URL correctly with hash routing.

- **`FilterSelectors` is shared between catalogue and datastore views**: Added an optional `analyticsContext: 'catalogue' | 'datastore'` prop. Events only fire when the prop is provided, so the component stays safe as a general-purpose filter widget. Both usage sites (`MetacatTable`, `EagerDatastoreDetail`, `LazyDatastoreDetail`) now pass the prop.

- **`RequiredProjectsWarning` didn't know its datastore context**: Added an optional `datastoreName` prop so `required_project_link_clicked` events can carry that context. Existing usages without the prop still work fine.

- **`EagerDatastoreTable` originally used `defineProps` without capturing the return value**: The `props` variable was needed to reference `props.datastoreName` in `track()` calls. Changed to `const props = defineProps<...>()`.

- **Duplicate `const props =` typo**: One multi-edit pass produced `const props = const props = defineProps<...>()` in `EagerDatastoreTable.vue`. Caught immediately by the test run (syntax error), fixed in one follow-up edit.

- **`useQuickStartCode` needed `watch` imported**: Adding `watch(isXArrayMode, ...)` for mode toggle tracking required adding `watch` to the existing `{ computed, ref }` import.

- **`search_link_copied` fires at two points**: Normal path (URL fits within limit) and confirmed long-URL path. Both fire the same event name but with `url_exceeded_limit: true/false` as a property so you can distinguish them in PostHog.

---

## Next Steps

### Immediate (before merging)

- [ ] **Set up PostHog Cloud or self-hosted instance** — get a real `phc_` key to do a smoke-test in the browser before merging. Check that events appear in the PostHog Live Events view.
- [ ] **Add `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` to the CI/CD secrets** so production builds are instrumented. Dev builds remain silent.
- [ ] **Brief the infra colleague** on the self-hosting guide in this document (see below).

### Soon

- [ ] **Build the core funnel in PostHog** once data starts flowing:
      `$pageview (/) → catalogue_row_detail_opened → $pageview (/datastore/:name) → quick_start_code_copied`
- [ ] **Set up a PostHog dashboard** with: top datastores viewed, top filters applied, code-copy rate, xarray vs ESM mode split.
- [ ] **Review the `catalogue_searched` data** after a few weeks to identify gap terms — search queries with no subsequent filter interaction may indicate missing catalogue coverage.

### Later / Optional

- [ ] **`EagerDatastoreTable` pagination** (`table_page_changed`) is wired but `@page` couldn't be confirmed in the template during this pass — verify it fires correctly in the browser.
- [ ] **Add `datastore_name` to the `$pageview` event** for datastore routes so PostHog path analysis doesn't collapse all `/datastore/:name` views into one URL.
- [ ] **Session recordings** — enable in PostHog project settings (off by default). Particularly valuable for watching filter interaction flows on large lazy datastores.
- [ ] **Funnels for ARE usage** — `open_are_clicked` is tracked. Once enough data exists, analyse what filter state precedes ARE opens to understand which data workflows are most common.
- [ ] **`commit_sha_copied`** — very low traffic, consider dropping from the plan if it adds noise.

---

## Why PostHog

- App is **event-driven**, not page-view-driven — the core value is in interactions, not traffic
- Need **custom events with rich properties** (e.g. which datastore, which filters, which mode)
- **Session recordings** will help understand how scientists navigate the filter UI
- **Funnel analysis** on the core journey: `catalogue → datastore detail → code copied`
- URL-based filter state (`?model_filter=...`) means filter context is automatically capturable
- Potential for **self-hosting** to satisfy research institution data sovereignty requirements (NCI/ARDC)
- Cookieless mode available — avoids consent banners

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

1. **Self-hosted on ARDC Nectar** ✅ — [see full setup guide below](#self-hosting-on-ardc-nectar)
   - Deploy via PostHog's Docker Compose bundle on a Nectar VM (~`m3.large`, 4 vCPU / 8 GB RAM)
   - Stack: PostHog app + ClickHouse + PostgreSQL + Redis + Kafka + ZooKeeper
   - ~half a day to set up, ~30 min/month to maintain (upgrades are `docker compose pull && up`)
   - No licensing cost; data stays on AU infrastructure
   - Set `VITE_POSTHOG_HOST` to the Nectar instance URL

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

7. **Initialise in `main.ts`, gate behind `VITE_POSTHOG_KEY`** ✅
   - No key = no tracking (safe in dev/test environments)

8. **Mock PostHog in Vitest** ✅
   - Add mock to existing `test/setup.ts`

---

## Implementation Plan

### 1. Install

```bash
npm install posthog-js
```

### 2. Initialise in `main.ts`

Gate behind `VITE_POSTHOG_KEY` env var — no key, no tracking.

```ts
if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://app.posthog.com',
    capture_pageview: false, // we'll fire manual view events
  });
}
```

### 3. `useAnalytics()` composable

Wraps PostHog calls. Returns a `track()` function that's a no-op when PostHog isn't initialised. Keeps all component code clean and makes mocking in tests trivial.

### 4. Wire up events

Per the events table above, add `track()` calls at each interaction site.

### 5. Mock in tests

In `test/setup.ts`, mock `posthog-js` so test suites don't need a real key and events don't fire.

### 6. `.env` setup

```
# .env.local (gitignored)
VITE_POSTHOG_KEY=phc_xxxx
VITE_POSTHOG_HOST=https://your-nectar-instance.example.com  # self-hosted URL
```

---

## Self-Hosting on ARDC Nectar

> This section is for the colleague setting up the infrastructure. The app team only needs the `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` values that come out of this process.

### What you're deploying

PostHog's self-hosted stack is a standard Docker Compose application. It runs entirely on one VM. The services are:

| Service               | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `posthog`             | Main web app + API                                              |
| `posthog-worker`      | Background job processor                                        |
| `clickhouse`          | Analytics data store (fast columnar DB — where all events live) |
| `postgresql`          | App metadata (users, projects, feature flags)                   |
| `redis`               | Queue / cache                                                   |
| `kafka` + `zookeeper` | Event ingestion pipeline                                        |
| `caddy` (or nginx)    | Reverse proxy + TLS termination                                 |

### VM requirements

| Resource | Minimum          | Recommended                          |
| -------- | ---------------- | ------------------------------------ |
| CPU      | 4 vCPU           | 8 vCPU                               |
| RAM      | 8 GB             | 16 GB                                |
| Disk     | 50 GB            | 100 GB+ (ClickHouse grows over time) |
| OS       | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS                     |

On Nectar this is roughly an `m3.large` (minimum) or `m3.xlarge` (recommended). Use a separate Nectar volume for ClickHouse data so you can resize it independently of the root disk.

### Prerequisites on the VM

- Docker Engine (≥ 24) and Docker Compose plugin
- A domain name or stable IP pointing at the VM (needed for TLS)
- Port 80 and 443 open in the Nectar security group

### Setup steps

```bash
# 1. Clone PostHog's deployment repo
git clone https://github.com/PostHog/posthog.git
cd posthog

# 2. Run the guided setup script
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/posthog/posthog/HEAD/bin/deploy-hobby)"
```

The script will ask for:

- Your domain name (e.g. `posthog.your-nectar-domain.cloud.edu.au`)
- An email address for TLS cert registration

It generates a `.env` file with secrets and starts all services. The first startup takes ~5 minutes while ClickHouse initialises.

### After setup

1. Navigate to `https://your-domain` and create the initial admin account
2. Create a new **Project** called something like `interactive-data-catalogue`
3. Go to **Project Settings → Project API Key** — copy the key starting with `phc_`
4. Hand that key and the host URL to the app team to put in their `.env.local`:
   ```
   VITE_POSTHOG_KEY=phc_xxxxxxxxxxxx
   VITE_POSTHOG_HOST=https://your-domain
   ```

### Ongoing maintenance

**Upgrades** (do whenever PostHog releases a new version — roughly monthly):

```bash
cd posthog
docker compose pull
docker compose up -d
```

**Disk management**: ClickHouse is the main consumer. Monitor with:

```bash
docker exec posthog-clickhouse-1 clickhouse-client --query \
  "SELECT database, formatReadableSize(sum(bytes)) FROM system.parts GROUP BY database"
```

**Backups**: Snapshot the Nectar volume that holds ClickHouse data (`/var/lib/docker/volumes/posthog_clickhouse-data`) on a regular schedule. PostgreSQL data is smaller but also worth snapshotting.

### Useful links

- [PostHog self-host docs](https://posthog.com/docs/self-host)
- [PostHog hobby deploy script](https://github.com/PostHog/posthog/blob/master/bin/deploy-hobby)
- [ClickHouse disk usage docs](https://clickhouse.com/docs/en/operations/system-tables/parts)
