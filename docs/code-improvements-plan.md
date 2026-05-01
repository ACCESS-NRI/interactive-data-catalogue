# Code Improvements Plan

This plan proposes a staged cleanup of the Vue catalogue app so future feature work has clearer ownership boundaries, better type safety, and less duplication between the catalogue, eager datastore, and lazy datastore flows.

## Current Shape

The project is a Vue 3 + TypeScript app using Pinia, Vue Router, PrimeVue, VueUse, DuckDB WASM, Tailwind, and Vitest. It already has a useful test suite around the store and components, but a few areas are carrying too much responsibility:

- `src/stores/catalogStore.ts` owns remote URLs, fetch calls, DuckDB lifecycle, parquet normalization, datastore cache coordination, catalog row types, datastore row types, and debug logging.
- Eager and lazy datastore components duplicate route/filter/query synchronization, column setup, analytics capture, loading states, and table rendering behavior.
- Shared data structures are typed locally or as `any`, especially datastore rows, table columns, filter maps, API responses, and modal payloads.
- Filtering logic is repeated across `MetacatTable.vue`, `EagerDatastoreDetail.vue`, `LazyDatastoreDetail.vue`, and `FilterSelectors.vue`.
- The eager/lazy split is behaviorally important, but it is expressed by two mostly parallel component trees rather than shared composables with small strategy-specific adapters.
- Tests cover many visible components, but the most reusable logic is still embedded inside components, making isolated unit coverage harder than it needs to be.

## Goals

- Make domain types discoverable from one place.
- Move data fetching and normalization out of UI-facing store code.
- Extract reusable composables for filtering, column selection, URL query synchronization, and datastore loading strategy.
- Reduce eager/lazy duplication while preserving the current user experience.
- Replace broad `any` usage with explicit flexible types where the backend is naturally dynamic.
- Make future datastore features easier to add without editing multiple parallel components.

## Non-Goals

- No UI redesign in this cleanup.
- No endpoint or backend contract changes.
- No change to the eager versus lazy threshold behavior unless tests reveal an existing bug that should be fixed separately.
- No broad dependency churn.

## Proposed PR Sequence

### 1. Establish Shared Types

Create a small domain type layer under `src/types/`, for example:

- `catalog.ts` for `CatalogRow`, catalog filter fields, and catalogue table columns.
- `datastore.ts` for `DatastoreRow`, `DatastoreCellValue`, `DatastoreCache`, `DatastoreMetadata`, paged datastore responses, and filter option maps.
- `table.ts` for common `{ field, header }` column descriptors.

Then update components and tests to import these types instead of redefining shapes locally or importing them from the Pinia store.

Acceptance criteria:

- `CatalogRow` and `DatastoreCache` no longer live in `catalogStore.ts`.
- Datastore table/detail props use shared types.
- Obvious `any[]` table prop types become `DatastoreRow[]` or a named response type.
- Existing tests still pass.

### 2. Split Data Access From Store State

Move API and DuckDB responsibilities into focused modules:

- `src/services/catalogApi.ts`: metacatalog fetch, datastore metadata fetch, paged datastore fetch, project fetch.
- `src/services/duckdbClient.ts`: DuckDB worker/bundle setup and cleanup.
- `src/services/parquetTransforms.ts`: list normalization, catalog row normalization, datastore row normalization, sidecar filter option extraction.
- `src/config/catalogEndpoints.ts`: base URLs, object store paths, and environment-specific service URL selection.

Keep `catalogStore.ts` as the state/cache orchestrator. It should call services, update refs, expose getters/actions, and avoid knowing the details of DuckDB vectors or endpoint string construction.

Acceptance criteria:

- Store file is materially smaller and mostly reads as state orchestration.
- Normalization helpers have isolated unit tests without Pinia.
- Endpoint construction is covered by small tests or table-driven cases.
- Debug logs are either removed, guarded, or centralized behind a tiny logger helper.

### 3. Extract Filter And URL Composables

Introduce composables for shared filtering workflows:

- `useFilterState` for current filter map, clearing, and update helpers.
- `useFilterUrlSync` for reading `*_filter` query params and writing current filters back to the router.
- `useDynamicFilterOptions` for computing valid options under cross-column filters in eager/catalogue flows.
- `useBufferedDynamicFilterOptions` for the lazy flow where dynamic options arrive from the API while dropdowns may be open.

Acceptance criteria:

- `MetacatTable.vue`, `EagerDatastoreDetail.vue`, and `LazyDatastoreDetail.vue` no longer hand-roll the same filter matching and URL query logic.
- Filter matching behavior is covered once in composable tests.
- `FilterSelectors.vue` receives typed filter maps and emits typed updates.

### 4. Consolidate Datastore Detail Setup

Create a shared `useDatastoreDetail` composable that owns:

- `datastoreName` from route params.
- cache lookup and load flow.
- common loading/error/table loading state.
- total records, columns, filter options, selected columns, and available columns.
- analytics event capture for detail views.
- route-change cleanup.

Layer the strategy differences on top:

- Eager strategy provides `rawData`, local `filteredData`, and local dynamic filter options.
- Lazy strategy provides API-backed table params and dynamic filter option updates.

Acceptance criteria:

- Eager and lazy detail components become mainly composition plus template.
- Route watcher and unmount cleanup are implemented in one place.
- Existing eager/lazy component tests are updated to assert the same visible behavior.

### 5. Consolidate Datastore Table Rendering

The eager and lazy datastore tables share nearly identical column body templates and modal behavior. Extract reusable pieces:

- `DatastoreTableCell.vue` for field-specific value rendering.
- `useDatastoreEntryModal` for modal title/items/open state.
- A shared column-selection handler composable or utility.

Then keep two thin table wrappers only where PrimeVue pagination mode differs:

- Eager wrapper: local array data, local paginator.
- Lazy wrapper: server-backed paginator, sort, page state, URL construction.

Acceptance criteria:

- Field formatting logic exists once.
- Modal state logic exists once.
- Eager and lazy table components are small wrappers around shared rendering.
- Tests for array truncation, "more" links, and field-specific badges move to the shared cell/component tests.

### 6. Improve Quick Start Code Structure

`useQuickStartCode.ts` is already a good extraction. Improve it by separating pure generation from Vue side effects:

- `src/services/quickStartCode.ts` for pure code generation from typed inputs.
- Keep clipboard, toast, router, analytics, and dialog state in the composable.

Acceptance criteria:

- Code generation can be tested without mounting Vue components.
- Existing eager/lazy quick start component tests stay focused on UI behavior.
- Required project detection uses typed datastore cache metadata.

### 7. Tighten Tests And Tooling

After the structural refactors, add or update tests around the newly extracted logic:

- row normalization and DuckDB vector handling.
- filter matching and dynamic option pruning.
- URL query parse/write behavior.
- eager versus lazy strategy selection around the `5000` record threshold.
- datastore table cell rendering.

Also consider adding ESLint in a later PR if the team wants stronger ongoing guardrails. TypeScript strictness is already enabled, so the first cleanup should lean on that before introducing another tool.

## Suggested Branch/PR Strategy

This work is best reviewed as several small PRs rather than one sweeping rewrite:

1. Types-only extraction.
2. Service and transform extraction from the store.
3. Filter and URL composables.
4. Datastore detail composable.
5. Shared datastore table cell/modal extraction.
6. Quick start code pure generator extraction.

Each PR should preserve behavior and carry its own focused tests. That keeps review manageable and gives the team clean rollback points if an extraction exposes hidden coupling.

## First Implementation Slice

The safest first implementation PR would be:

1. Add shared `src/types/catalog.ts`, `src/types/datastore.ts`, and `src/types/table.ts`.
2. Move exported interfaces out of `catalogStore.ts`.
3. Replace local duplicated column and filter map types in components.
4. Run `npm run build` and the affected Vitest suites.

This should produce meaningful clarity with low behavioral risk and sets up the later service/composable refactors.
