import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalogStore';
import { capture } from './usePosthog';
import type { DatastoreCache } from '../types/datastore';
import type { TableColumn } from '../types/table';

/**
 * Configuration for the shared datastore-detail lifecycle composable.
 */
interface UseDatastoreDetailOptions {
  /** Whether the caller is the eager or lazy datastore detail implementation. */
  loadingStrategy: 'eager' | 'lazy';
  /** Checks whether a cache entry is usable for the caller's loading mode. */
  isCacheReady: (cache: DatastoreCache) => boolean;
  /** Hydrates filter state from the current URL before loading begins. */
  initializeFiltersFromUrl: () => void;
  /** Stops the caller-owned filter watcher during cleanup. */
  stopFilterWatcher: () => void;
  /** Optional hook for mode-specific cache hydration work. */
  onCacheReady?: (cache: DatastoreCache) => void;
  /** Optional hook for caller-specific unmount cleanup. */
  onUnmount?: () => void;
  /** When provided, overrides the route-derived datastore name. */
  nameOverride?: string;
  /** When provided, overrides the cache key used for cache lookups/stores. */
  cacheKeyOverride?: string;
  /** When true, the cache entry is NOT deleted on unmount. */
  persistCacheOnUnmount?: boolean;
  /** When true, the route-param watcher is not registered. */
  skipRouteWatch?: boolean;
  /** Optional hook called when `loadDatastore` finds no cache entry and no loader is triggered. */
  onCacheMissing?: () => void;
}

/**
 * Reactive state and actions exposed by {@link useDatastoreDetail}.
 */
interface UseDatastoreDetailResult {
  /** Datastore name derived from the current route params. */
  datastoreName: ComputedRef<string>;
  /** Full-page loading state for the datastore detail screen. */
  loading: Ref<boolean>;
  /** Table-level loading state for datastore entry rendering. */
  tableLoading: Ref<boolean>;
  /** Current datastore loading error, if any. */
  error: Ref<string | null>;
  /** All visible columns available for selection in the table UI. */
  availableColumns: Ref<TableColumn[]>;
  /** Currently selected columns for table display. */
  selectedColumns: Ref<TableColumn[]>;
  /** Cached datastore entry associated with the current route, if present. */
  cachedDatastore: ComputedRef<DatastoreCache | null>;
  /** Total number of records in the currently cached datastore. */
  totalRecords: ComputedRef<number>;
  /** Raw datastore column names from the cache. */
  columns: ComputedRef<string[]>;
  /** Static filter options derived from the cached datastore metadata. */
  filterOptions: ComputedRef<Record<string, string[]>>;
  /** Loads datastore data, reusing cache entries when possible. */
  loadDatastore: () => Promise<void>;
}

/**
 * Formats a datastore column identifier into a human-readable table header.
 *
 * @param column - Raw datastore column name.
 * @returns A title-cased, space-separated header label.
 */
const formatColumnName = (column: string) =>
  column
    .split('_')
    .map((word) => {
      const value = word || '';
      return value.length ? value.charAt(0).toUpperCase() + value.slice(1) : '';
    })
    .join(' ');

/**
 * Centralises the shared eager/lazy datastore-detail lifecycle.
 *
 * This handles route-derived datastore naming, cache reuse, load/error state, analytics,
 * column setup, route-change refresh, and unmount cleanup so the eager and lazy views can stay
 * focused on the behaviour that actually differs between them.
 *
 * @param options - Mode-specific lifecycle hooks and cache-readiness rules.
 * @returns Shared datastore-detail reactive state and the load action.
 */
export function useDatastoreDetail({
  loadingStrategy,
  isCacheReady,
  initializeFiltersFromUrl,
  stopFilterWatcher,
  onCacheReady,
  onUnmount,
  nameOverride,
  cacheKeyOverride,
  persistCacheOnUnmount = false,
  skipRouteWatch = false,
  onCacheMissing,
}: UseDatastoreDetailOptions): UseDatastoreDetailResult {
  const route = useRoute();
  const catalogStore = useCatalogStore();

  const datastoreName = computed(() => nameOverride ?? (route.params.name as string));
  const cacheKey = computed(() => cacheKeyOverride ?? datastoreName.value);
  const loading = ref(false);
  const tableLoading = ref(false);
  const error = ref<string | null>(null);
  const availableColumns = ref<TableColumn[]>([]);
  const selectedColumns = ref<TableColumn[]>([]);

  const cachedDatastore = computed(() => catalogStore.getDatastoreFromCache(cacheKey.value));
  const totalRecords = computed(() => cachedDatastore.value?.totalRecords || 0);
  const columns = computed(() => cachedDatastore.value?.columns || []);
  const filterOptions = computed(() => cachedDatastore.value?.filterOptions || {});

  /**
   * Derives visible table-column metadata from the datastore columns, excluding internal path-like
   * fields that should not be shown by default.
   *
   * @param dataColumns - Raw datastore column names.
   */
  const setupColumns = (dataColumns: string[]) => {
    const visibleColumns = dataColumns.filter((column) => column !== 'path' && column !== 'filename');
    availableColumns.value = visibleColumns.map((column) => ({ field: column, header: formatColumnName(column) }));
    selectedColumns.value = [...availableColumns.value];
  };

  /**
   * Emits the shared analytics event for viewing a datastore detail page.
   *
   * @param cache - Cache entry used to populate the page.
   */
  const trackViewed = (cache: DatastoreCache) => {
    capture('datastore_detail_viewed', {
      datastore_name: datastoreName.value,
      loading_strategy: loadingStrategy,
      record_count: cache.totalRecords,
    });
  };

  /**
   * Applies shared cache-derived state and then delegates any mode-specific cache hydration work.
   *
   * @param cache - Cache entry being applied to the current view.
   */
  const hydrateFromCache = (cache: DatastoreCache) => {
    setupColumns(cache.columns);
    onCacheReady?.(cache);
  };

  /**
   * Loads the current datastore, preferring a suitable cached entry when available.
   *
   * When no usable cache entry exists, this falls back to the catalog store's async loader and
   * updates loading/error state around that request.
   */
  const loadDatastore = async () => {
    const existingCache = catalogStore.getDatastoreFromCache(cacheKey.value);
    if (existingCache && isCacheReady(existingCache)) {
      hydrateFromCache(existingCache);
      loading.value = false;
      tableLoading.value = false;
      trackViewed(existingCache);
      return;
    }

    // For personal/override datastores that haven't been loaded yet, notify the caller
    if (cacheKeyOverride) {
      onCacheMissing?.();
      return;
    }

    loading.value = true;
    tableLoading.value = true;
    error.value = null;

    try {
      const datastoreCache = await catalogStore.loadDatastore(datastoreName.value);
      if (isCacheReady(datastoreCache)) hydrateFromCache(datastoreCache);
      trackViewed(datastoreCache);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load datastore';
    } finally {
      loading.value = false;
      tableLoading.value = false;
    }
  };

  onMounted(() => {
    initializeFiltersFromUrl();
    const existingCache = catalogStore.getDatastoreFromCache(cacheKey.value);
    if (existingCache && isCacheReady(existingCache)) {
      hydrateFromCache(existingCache);
      loading.value = false;
      tableLoading.value = false;
    } else {
      void loadDatastore();
    }
  });

  const stopRouteWatcher = skipRouteWatch
    ? () => {}
    : watch(
        () => route.params.name,
        (newName, oldName) => {
          if (oldName && newName !== oldName) catalogStore.clearDatastoreCache(oldName as string);
          if (newName) {
            initializeFiltersFromUrl();
            void loadDatastore();
          }
        },
      );

  onUnmounted(() => {
    onUnmount?.();
    if (!persistCacheOnUnmount) {
      catalogStore.clearDatastoreCache(cacheKey.value);
    }
    stopRouteWatcher();
    stopFilterWatcher();
  });

  return {
    datastoreName,
    loading,
    tableLoading,
    error,
    availableColumns,
    selectedColumns,
    cachedDatastore,
    totalRecords,
    columns,
    filterOptions,
    loadDatastore,
  };
}
