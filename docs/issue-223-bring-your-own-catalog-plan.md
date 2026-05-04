# Issue 223 Plan: Personal Datastore Page

## Issue Context

GitHub issue: https://github.com/ACCESS-NRI/interactive-data-catalogue/issues/223

The goal is to let a user explore their own locally generated intake-esm datastore inside the same interactive catalogue UI. The first version should stay deliberately small:

- Add a `personal-datastore/` route.
- Upload CSV only, unless later implementation proves the JSON is needed.
- Keep state in Pinia only; refresh loses the upload.
- Support one personal datastore at a time; a new upload replaces the previous one.
- Reuse existing eager datastore components and keep the UI as close as possible to the built-in datastore detail page.

The motivating upstream support issue is https://github.com/ACCESS-NRI/access-nri-intake-catalog/issues/590. The user there had generated paired `.csv` and `.json` files, but the interactive use case is mainly browsing/filtering the tabular datastore rows so they can refine variables, file IDs, grids, and frequencies.

## JSON Usage Check

The current app does not read or use an uploaded intake-esm `.json` metadata file.

Relevant findings:

- Built-in metacatalog data is loaded from `metacatalog.parquet` in `src/stores/catalogStore.ts`.
- Built-in datastore table content comes from tracking-service JSON endpoints or object-store parquet files.
- Built-in datastore metadata and filter options come from server endpoints and sidecar parquet files, not intake-esm JSON.
- Existing `.json()` calls are HTTP response parsing only:
  - `getEsmDatastoreRecordCount`
  - `queryEsmDatastore`
  - `getEsmDatastoreProject`
  - lazy datastore table API fetches
- Quick-start code displays `intake.cat.access_nri["NAME"]`; it does not inspect an intake-esm JSON file.
- `MetacatRowDetailModal` parses YAML embedded in metacatalog rows, but that is unrelated to intake-esm JSON upload.

Conclusion: for the first personal datastore route, CSV-only upload matches how the current app actually explores data. The JSON file can be dropped for now. Quick-start code can show a placeholder line telling the user to open their local JSON in Python.

## Current Code Shape

- `src/router/index.ts` defines `/` and `/datastore/:name`.
- `src/components/MetacatTable.vue` is the home page and should get the entry point.
- `src/stores/catalogStore.ts` owns all metacatalog and datastore cache state.
- `src/components/DatastoreDetail.vue` chooses lazy vs eager for built-in datastores.
- `src/components/eager/EagerDatastoreDetail.vue` provides the target UI for small datastores.
- `src/components/eager/EagerDatastoreTable.vue` and `src/components/eager/EagerQuickStartCode.vue` are the key reusable pieces.
- `src/composables/useQuickStartCode.ts` owns generated Python snippets, copy-link behavior, and ARE actions.

The main mismatch is that `EagerDatastoreDetail.vue` currently assumes a route param named `name` and calls `catalogStore.loadDatastore(datastoreName)` when cache is missing. The personal route needs the same UI, but a different loading source.

## Proposed Implementation

Build `/personal-datastore/` as a single-page flow:

1. User opens `/personal-datastore/`.
2. If no personal datastore is in Pinia, show an upload scaffold.
3. User uploads one CSV file.
4. The store parses and normalizes the CSV into the existing `DatastoreCache` shape.
5. The same route switches to an eager datastore exploration view.
6. A new upload replaces the previous personal datastore cache.

Use a fixed internal cache key, for example:

```ts
const PERSONAL_DATASTORE_CACHE_KEY = '__personal_datastore__';
```

Display name can default to the CSV filename without extension, with an optional user override later if desired.

## Store Plan

Extend `catalogStore` with personal datastore state instead of creating a separate store.

Suggested state:

```ts
interface PersonalDatastoreState {
  name: string;
  csvFileName: string;
  loadedAt: Date;
}

const personalDatastore = ref<PersonalDatastoreState | null>(null);
```

Suggested actions:

- `loadPersonalDatastoreCsv(file: File): Promise<DatastoreCache>`
- `replacePersonalDatastore(file: File): Promise<void>`
- `clearPersonalDatastore(): void`
- `hasPersonalDatastore: computed<boolean>`
- `personalDatastoreCacheKey` exported or returned from the store

Implementation detail:

- Clear the old fixed cache key before registering the new upload.
- Parse the CSV into rows.
- Put the normalized rows into `datastoreCache[PERSONAL_DATASTORE_CACHE_KEY]`.
- Set `totalRecords`, `columns`, `filterOptions`, `loading: false`, `error: null`, `project: null`.

### CSV Parsing

Use DuckDB WASM because the app already ships it.

Implementation sketch:

1. `await file.arrayBuffer()`
2. `initializeDuckDB()`
3. `db.registerFileBuffer('personal-datastore.csv', new Uint8Array(arrayBuffer))`
4. `conn.query("SELECT * FROM read_csv_auto('personal-datastore.csv')")`
5. Normalize each field with the existing scalar/list handling currently inside `loadEsmDatastore`.
6. Derive filter options directly from the normalized rows.

Refactor opportunity: extract reusable helpers from `catalogStore.ts`:

- `normalizeDatastoreField(value: unknown): string | string[] | null`
- `normalizeDatastoreRows(rows: any[], columns: string[]): any[]`
- `deriveFilterOptionsFromRows(rows: any[], columns: string[]): Record<string, string[]>`

This keeps built-in parquet and personal CSV behavior aligned.

## UI Reuse Plan

Create `src/components/PersonalDatastore.vue` for the route.

It should render either:

- Upload state, when `catalogStore.personalDatastore` is null.
- Eager detail state, when the fixed personal cache exists.

To keep UI close to existing datastore detail, lightly refactor `EagerDatastoreDetail.vue` so it can be reused by both built-in and personal routes.

Recommended prop additions:

```ts
const props = withDefaults(
  defineProps<{
    datastoreName?: string;
    cacheKey?: string;
    autoLoad?: boolean;
    source?: 'builtin' | 'personal';
  }>(),
  {
    autoLoad: true,
    source: 'builtin',
  },
);
```

Behavior:

- Built-in route keeps working unchanged by falling back to `route.params.name`.
- Personal route passes:
  - `datastoreName`: personal display name
  - `cacheKey`: `PERSONAL_DATASTORE_CACHE_KEY`
  - `autoLoad`: `false`
  - `source`: `personal`
- Existing `DatastoreHeader`, beta warning, `FilterSelectors`, and `EagerDatastoreTable` should remain visually unchanged.
- For personal source, breadcrumb can read `Catalog > Personal datastore > {name}`.
- For personal source, cache should not be cleared on unmount unless the user uploads/replaces/clears explicitly; otherwise navigating away and back within the session would lose the data.

## Route And Entry Point

Add this route in `src/router/index.ts`:

```ts
{
  path: '/personal-datastore',
  name: 'PersonalDatastore',
  component: () => import('../components/PersonalDatastore.vue'),
  meta: { title: 'Personal Datastore' },
}
```

Add a clear home-page entry point in `MetacatTable.vue` or `MetacatHeader.vue`.

Recommendation: put a compact secondary action near the existing page header so it is visible before users interact with the table:

- Label: `Explore my personal datastore`
- Icon: PrimeIcons database/upload style, whichever best matches existing controls.
- Route: `{ name: 'PersonalDatastore' }`

## Quick-Start Code

Keep quick-start visible for personal datastores, but change only the opening block.

Current built-in opening:

```python
datastore = intake.cat.access_nri["DATASTORE_NAME"]
```

Personal opening should be a placeholder users can edit:

```python
# Open your local ESM datastore, for example:
datastore = intake.open_esm_datastore("path/to/your/datastore.json")
```

After that, reuse the existing generated `.search(...)`, `.to_dask()`, and `.to_dataset_dict()` code.

Recommended implementation: add an optional `source` argument to `useQuickStartCode`, passed through `EagerQuickStartCode.vue`. When `source === 'personal'`, generate the placeholder opening and route copy-link behavior to `PersonalDatastore` instead of `DatastoreDetail`.

Open question for implementation: copy-link-to-search on personal datastores will only work while the Pinia upload still exists. That is acceptable for the first version, but the UI may need a short session-only notice.

## Validation

Keep validation permissive:

- Require a CSV file.
- Reject empty CSV files.
- Reject files DuckDB cannot parse.
- Warn, but do not block, if common useful columns are absent:
  - `file_id`
  - `variable`
  - `path`
  - `frequency`
  - `realm`

No intake-esm JSON validation in the first version.

## Tests

Add or update focused tests:

- `src/stores/__tests__/catalogStore.spec.ts`
  - loads a personal datastore CSV into the fixed cache key.
  - replaces the previous personal datastore on a second upload.
  - derives columns and filter options from CSV rows.
  - clears the personal datastore.
- `src/components/__tests__/PersonalDatastore.spec.ts`
  - shows upload state when no personal datastore is loaded.
  - rejects missing/invalid/empty CSV.
  - renders eager detail state after successful upload.
  - replacing the upload updates the displayed datastore.
- `src/components/__tests__/EagerDatastoreDetail.spec.ts`
  - built-in default behavior still calls `loadDatastore`.
  - personal mode uses the provided cache key and does not call built-in `loadDatastore`.
  - personal mode does not clear the cache on unmount.
- Quick-start tests
  - built-in code still uses `intake.cat.access_nri["NAME"]`.
  - personal code uses the `intake.open_esm_datastore(...)` placeholder and preserves filter generation.

Run:

```bash
npm run test
npm run build
```

## Suggested Milestones

1. Add `/personal-datastore/` route, upload state, and home-page entry point.
2. Add Pinia personal datastore state and CSV parsing into the existing `DatastoreCache` shape.
3. Refactor `EagerDatastoreDetail` and quick-start code just enough to support `source: 'personal'`.
4. Add tests for store, route component, reuse behavior, and quick-start output.
5. Run build and test verification.

## Risks

- Very large CSV files may be slow or memory-heavy in the browser. The first version can rely on the issue expectation that personal datastores are reasonably small.
- `EagerDatastoreDetail` has route and lifecycle assumptions baked in. Keep the refactor narrow and preserve built-in defaults.
- Copy-link-to-search for personal datastores is session-only and will not reconstruct uploaded data after refresh.
