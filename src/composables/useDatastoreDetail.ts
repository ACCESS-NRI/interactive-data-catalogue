import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useRoute } from 'vue-router';
import { useCatalogStore } from '../stores/catalogStore';
import { capture } from './usePosthog';
import type { DatastoreCache } from '../types/datastore';
import type { TableColumn } from '../types/table';

interface UseDatastoreDetailOptions {
  loadingStrategy: 'eager' | 'lazy';
  isCacheReady: (cache: DatastoreCache) => boolean;
  initializeFiltersFromUrl: () => void;
  stopFilterWatcher: () => void;
  onCacheReady?: (cache: DatastoreCache) => void;
  onUnmount?: () => void;
}

interface UseDatastoreDetailResult {
  datastoreName: ComputedRef<string>;
  loading: Ref<boolean>;
  tableLoading: Ref<boolean>;
  error: Ref<string | null>;
  availableColumns: Ref<TableColumn[]>;
  selectedColumns: Ref<TableColumn[]>;
  cachedDatastore: ComputedRef<DatastoreCache | null>;
  totalRecords: ComputedRef<number>;
  columns: ComputedRef<string[]>;
  filterOptions: ComputedRef<Record<string, string[]>>;
  loadDatastore: () => Promise<void>;
}

const formatColumnName = (column: string) =>
  column
    .split('_')
    .map((word) => {
      const value = word || '';
      return value.length ? value.charAt(0).toUpperCase() + value.slice(1) : '';
    })
    .join(' ');

export function useDatastoreDetail({
  loadingStrategy,
  isCacheReady,
  initializeFiltersFromUrl,
  stopFilterWatcher,
  onCacheReady,
  onUnmount,
}: UseDatastoreDetailOptions): UseDatastoreDetailResult {
  const route = useRoute();
  const catalogStore = useCatalogStore();

  const datastoreName = computed(() => route.params.name as string);
  const loading = ref(false);
  const tableLoading = ref(false);
  const error = ref<string | null>(null);
  const availableColumns = ref<TableColumn[]>([]);
  const selectedColumns = ref<TableColumn[]>([]);

  const cachedDatastore = computed(() => catalogStore.getDatastoreFromCache(datastoreName.value));
  const totalRecords = computed(() => cachedDatastore.value?.totalRecords || 0);
  const columns = computed(() => cachedDatastore.value?.columns || []);
  const filterOptions = computed(() => cachedDatastore.value?.filterOptions || {});

  const setupColumns = (dataColumns: string[]) => {
    const visibleColumns = dataColumns.filter((column) => column !== 'path' && column !== 'filename');
    availableColumns.value = visibleColumns.map((column) => ({ field: column, header: formatColumnName(column) }));
    selectedColumns.value = [...availableColumns.value];
  };

  const trackViewed = (cache: DatastoreCache) => {
    capture('datastore_detail_viewed', {
      datastore_name: datastoreName.value,
      loading_strategy: loadingStrategy,
      record_count: cache.totalRecords,
    });
  };

  const hydrateFromCache = (cache: DatastoreCache) => {
    setupColumns(cache.columns);
    onCacheReady?.(cache);
  };

  const loadDatastore = async () => {
    const existingCache = catalogStore.getDatastoreFromCache(datastoreName.value);
    if (existingCache && isCacheReady(existingCache)) {
      hydrateFromCache(existingCache);
      loading.value = false;
      tableLoading.value = false;
      trackViewed(existingCache);
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
    const existingCache = catalogStore.getDatastoreFromCache(datastoreName.value);
    if (existingCache && isCacheReady(existingCache)) {
      hydrateFromCache(existingCache);
      loading.value = false;
      tableLoading.value = false;
    } else {
      void loadDatastore();
    }
  });

  const stopRouteWatcher = watch(
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
    catalogStore.clearDatastoreCache(datastoreName.value);
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
