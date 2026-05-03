# Code Improvements Plan

This is a staged cleanup plan for the Vue catalogue app.

The main point is to make future work less annoying: clearer ownership boundaries, saner types, and less copy-paste between the catalogue, eager datastore, and lazy datastore paths.

## Current Shape

The app is Vue 3 + TypeScript with Pinia, Vue Router, PrimeVue, VueUse, DuckDB WASM, Tailwind, and Vitest. There is already a decent test base around the store and components, but a few bits are doing too much at once:

- `src/stores/catalogStore.ts` is carrying a pretty heroic amount of responsibility: remote URLs, fetches, DuckDB lifecycle, parquet normalisation, datastore cache coordination, row types, and debug logging.
- The eager and lazy datastore views duplicate a lot of the same plumbing: route/query sync, filters, column setup, analytics, loading states, and table behaviour.
- Shared structures are often typed locally or just left as `any`, especially datastore rows, columns, filter maps, API responses, and modal payloads.
- Filtering logic is repeated across `MetacatTable.vue`, `EagerDatastoreDetail.vue`, `LazyDatastoreDetail.vue`, and `FilterSelectors.vue`.
- The eager/lazy split is real and important, but right now it mostly shows up as two parallel component trees instead of shared composables with small strategy-specific differences.
- Tests cover visible component behaviour reasonably well, but some of the actually reusable logic is still trapped inside components, which makes it harder to test cleanly.

## Goals

- Put the domain types somewhere obvious.
- Move fetching and normalisation out of UI-facing store code.
- Extract shared composables for filtering, column selection, URL query sync, and datastore loading strategy.
- Reduce eager/lazy duplication without changing the current UX.
- Replace broad `any` usage with explicit but still flexible types where the backend is genuinely dynamic.
- Make it easier to add datastore features without touching two or three near-duplicate code paths.

## Non-Goals

- No UI redesign.
- No backend or endpoint contract changes.
- No change to the eager/lazy threshold behaviour unless tests flush out an existing bug that should be fixed separately.
- No big dependency churn.

## Proposed PR Sequence

### 1. Establish shared types

Create a small domain type layer under `src/types/`, for example:

- `catalog.ts` for `CatalogRow`, catalogue filter fields, and catalogue table columns.
- `datastore.ts` for `DatastoreRow`, `DatastoreCellValue`, `DatastoreCache`, `DatastoreMetadata`, paged datastore responses, and filter option maps.
- `table.ts` for shared `{ field, header }` column descriptors.

Then update components and tests to import those types instead of redefining shapes locally or reaching into the Pinia store for them.

Acceptance criteria:

- `CatalogRow` and `DatastoreCache` no longer live in `catalogStore.ts`.
- Datastore table/detail props use shared types.
- Obvious `any[]` table props become `DatastoreRow[]` or a named response type.
- Existing tests still pass.

### 2. Split data access from store state

Move API and DuckDB work into focused modules:

- `src/services/catalogApi.ts`: metacatalog fetch, datastore metadata fetch, paged datastore fetch, project fetch.
- `src/services/duckdbClient.ts`: DuckDB worker/bundle setup and cleanup.
- `src/services/parquetTransforms.ts`: list normalisation, catalog row normalisation, datastore row normalisation, sidecar filter option extraction.
- `src/config/catalogEndpoints.ts`: base URLs, object store paths, and environment-specific service URL selection.

`catalogStore.ts` should then be mostly the state/cache orchestrator: call services, update refs, expose getters/actions, and stop knowing about DuckDB vectors or endpoint string assembly details.

Acceptance criteria:

- The store is materially smaller and mostly reads like state orchestration.
- Normalisation helpers have isolated unit tests without Pinia in the middle.
- Endpoint construction is covered by small tests or table-driven cases.
- Debug logging is either removed, guarded, or pushed behind a tiny helper.

### 3. Extract filter and URL composables

Introduce composables for the shared filtering workflows:

- `useFilterState` for current filter maps, clearing, and update helpers.
- `useFilterUrlSync` for reading `*_filter` query params and writing current filters back to the router.
- `useDynamicFilterOptions` for computing valid options under cross-column filters in eager/catalogue flows.
- `useBufferedDynamicFilterOptions` for the lazy flow, where dynamic options come back from the API while dropdowns may still be open.

Acceptance criteria:

- `MetacatTable.vue`, `EagerDatastoreDetail.vue`, and `LazyDatastoreDetail.vue` stop hand-rolling the same filter matching and URL query logic.
- Filter matching behaviour is tested once at the composable level.
- `FilterSelectors.vue` gets typed filter maps and emits typed updates.

### 4. Consolidate datastore detail setup

Create a shared `useDatastoreDetail` composable to own:

- `datastoreName` from route params.
- cache lookup and load flow.
- common loading/error/table-loading state.
- total records, columns, filter options, selected columns, and available columns.
- analytics capture for detail views.
- route-change cleanup.

Then layer the strategy differences on top:

- Eager strategy provides `rawData`, local `filteredData`, and local dynamic filter options.
- Lazy strategy provides API-backed table params and dynamic filter option updates.

Acceptance criteria:

- The eager and lazy detail components become mostly composition plus template.
- Route watching and unmount cleanup live in one place.
- Existing component tests still assert the same visible behaviour.

### 5. Consolidate datastore table rendering

The eager and lazy tables share most of their column-body and modal behaviour. Pull the reusable bits out:

- `DatastoreTableCell.vue` for field-specific value rendering.
- `useDatastoreEntryModal` for modal title/items/open state.
- A shared column-selection handler composable or utility.

Keep two thin wrappers only where pagination mode really differs:

- Eager wrapper: local array data, local paginator.
- Lazy wrapper: server-backed paginator, sort, page state, URL construction.

Acceptance criteria:

- Field formatting logic exists once.
- Modal state logic exists once.
- Eager and lazy table components are small wrappers around shared rendering.
- Tests for array truncation, "more" links, and field-specific badges move to shared tests.

### 6. Improve quick-start code structure

`useQuickStartCode.ts` is already heading in the right direction. The cleanup here is to separate pure generation from Vue side effects:

- `src/services/quickStartCode.ts` for pure code generation from typed inputs.
- Keep clipboard, toast, router, analytics, and dialog state in the composable.

Acceptance criteria:

- Code generation is testable without mounting Vue components.
- Existing quick-start tests stay focused on UI behaviour.
- Required project detection uses typed datastore cache metadata.

### 7. Tighten tests and tooling

Once the structural refactors are in, add or update tests around the extracted logic:

- row normalisation and DuckDB vector handling.
- filter matching and dynamic option pruning.
- URL query parse/write behaviour.
- eager vs lazy strategy selection around the `5000` record threshold.
- datastore table cell rendering.

It may also be worth adding ESLint later if we want stronger guardrails, but I would do the structural cleanup first and let existing TypeScript strictness pull its weight before adding more tooling.

## Suggested branch / PR strategy

This is much easier to review as a run of small PRs than as one giant heroic rewrite:

1. Types-only extraction.
2. Service and transform extraction from the store.
3. Filter and URL composables.
4. Datastore detail composable.
5. Shared datastore table cell/modal extraction.
6. Quick-start code pure generator extraction.

Each PR should preserve behaviour and bring its own focused tests. That keeps review sane and gives us clean rollback points if one of the extractions turns out to be hiding a weird dependency.

## First implementation slice

The safest first PR is probably:

1. Add shared `src/types/catalog.ts`, `src/types/datastore.ts`, and `src/types/table.ts`.
2. Move exported interfaces out of `catalogStore.ts`.
3. Replace duplicated local column and filter-map types in components.
4. Run `npm run build` and the affected Vitest suites.

That should buy a useful chunk of clarity with fairly low behavioural risk, and it sets up the later service/composable work cleanly.
