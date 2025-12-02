<template>
  <div class="datastore-detail-container">
    <nav class="mb-6" aria-label="breadcrumb">
      <ol class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
        <li class="flex items-center">
          <RouterLink to="/" class="flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <i class="pi pi-table mr-1"></i>
            Catalog
          </RouterLink>
        </li>
        <li class="flex items-center">
          <i class="pi pi-angle-right mx-2 text-gray-400"></i>
          <i class="pi pi-database mr-1"></i>
          <span class="font-medium text-gray-900 dark:text-gray-100">{{ datastoreName }}</span>
        </li>
      </ol>
    </nav>

    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <span class="ml-3 text-lg text-gray-600 dark:text-gray-300">Loading datastore...</span>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6"
    >
      <div class="flex items-center">
        <i class="pi pi-exclamation-triangle text-red-500 mr-2"></i>
        <span class="text-red-700 dark:text-red-300 font-medium">Error loading datastore:</span>
      </div>
      <p class="text-red-600 dark:text-red-400 mt-1">{{ error }}</p>
      <button
        @click="loadDatastore"
        class="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
      >
        <i class="pi pi-refresh mr-2"></i>
        Retry
      </button>
    </div>

    <div v-else>
      <!-- Content -->
      <div v-if="!loading && !error">
        <!-- Header -->
        <div class="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">ESM Datastore: {{ datastoreName }}</h1>
            <p class="text-gray-600 dark:text-gray-300">
              Detailed view of the {{ datastoreName }} ESM datastore containing
              {{ totalRecords?.toLocaleString() }} records.
            </p>
          </div>

          <!-- Vertical divider (hidden on mobile) -->
          <div class="hidden lg:block w-px h-16 bg-gray-300 dark:bg-gray-600 mx-6"></div>

          <!-- Right side - Documentation links -->
          <div class="flex-shrink-0">
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-2 lg:text-right">Documentation</div>
            <div class="flex flex-col space-y-2">
              <a
                href="https://intake-esm.readthedocs.io/"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm font-medium"
              >
                <i class="pi pi-external-link text-xs"></i>
                intake-esm Documentation
              </a>
              <a
                href="https://access-nri-intake-catalog.readthedocs.io/"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm font-medium"
              >
                <i class="pi pi-external-link text-xs"></i>
                ACCESS-NRI Intake Documentation
              </a>
            </div>
          </div>
        </div>
        <!-- Alpha Warning -->
        <div
          class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6"
        >
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div class="flex items-center">
                <i class="pi pi-exclamation-triangle text-yellow-600 mr-2"></i>
                <strong class="text-yellow-700 dark:text-yellow-300">Alpha Software:</strong>
              </div>
              <p class="text-yellow-700 dark:text-yellow-300 mt-1">
                The intake catalog interface is currently in alpha and under active development. Features and
                functionality may change in future releases.
              </p>
            </div>

            <!-- Vertical divider (hidden on mobile) -->
            <div class="hidden lg:block w-px h-16 bg-gray-300 dark:bg-gray-600 mx-6"></div>

            <!-- Right side - Actions -->
            <div class="flex-shrink-0 flex items-center space-x-3 lg:justify-end">
              <Button
                type="button"
                icon="pi pi-github"
                label="Give us feedback"
                class="p-button-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                title="Open a new issue pre-filled with the feedback template"
                @click="openFeedbackIssue"
              />
            </div>
          </div>
        </div>

        <QuickStartCode
          :datastore-name="datastoreName"
          :current-filters="currentFilters"
          :raw-data="filteredData"
          class="mb-6"
        />

        <FilterSelectors
          v-model="currentFilters"
          :filter-options="filterOptions"
          :raw-data="rawData"
          @clear="clearFilters"
        />

        <DatastoreTable
          :filtered-data="filteredData"
          :table-loading="tableLoading"
          v-model:selectedColumns="selectedColumns"
          :available-columns="availableColumns"
          :columns="columns"
          :datastore-name="datastoreName"
          @refresh="loadDatastore"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCatalogStore } from '../stores/catalogStore';
import Button from 'primevue/button';
import QuickStartCode from './QuickStartCode.vue';
import DatastoreTable from './DatastoreTable.vue';
import FilterSelectors from './FilterSelectors.vue';

const route = useRoute();
const router = useRouter();
const catalogStore = useCatalogStore();

const datastoreName = computed(() => route.params.name as string);
const loading = ref(false);
const tableLoading = ref(false);
const error = ref<string | null>(null);
const currentFilters = ref<Record<string, string[]>>({});

const availableColumns = ref<{ field: string; header: string }[]>([]);
const selectedColumns = ref<{ field: string; header: string }[]>([]);

const cachedDatastore = computed(() => catalogStore.getDatastoreFromCache(datastoreName.value));
const rawData = computed(() => cachedDatastore.value?.data || []);
const totalRecords = computed(() => cachedDatastore.value?.totalRecords || 0);
const columns = computed(() => cachedDatastore.value?.columns || []);
const filterOptions = computed(() => cachedDatastore.value?.filterOptions || {});

const formatColumnName = (c: string) =>
  c
    .split('_')
    .map((w) => {
      const s = w || '';
      return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    })
    .join(' ');

const setupColumns = (dataColumns: string[]) => {
  availableColumns.value = dataColumns.map((col) => ({ field: col, header: formatColumnName(col) }));
  selectedColumns.value = [...availableColumns.value];
};

const filteredData = computed(() => {
  let data = rawData.value;
  for (const [column, filterValues] of Object.entries(currentFilters.value)) {
    if (filterValues && filterValues.length > 0) {
      data = data.filter((row: Record<string, any>) => {
        const cellValue = row[column];
        return filterValues.some((fv) => {
          if (Array.isArray(cellValue))
            return cellValue.some((it: any) => String(it).toLowerCase().includes(fv.toLowerCase()));
          return String(cellValue || '')
            .toLowerCase()
            .includes(fv.toLowerCase());
        });
      });
    }
  }
  return data;
});

const loadDatastore = async () => {
  const existingCache = catalogStore.getDatastoreFromCache(datastoreName.value);
  if (existingCache && existingCache.data.length > 0) {
    setupColumns(existingCache.columns);
    loading.value = false;
    tableLoading.value = false;
    return;
  }
  loading.value = true;
  tableLoading.value = true;
  error.value = null;
  try {
    const datastoreCache = await catalogStore.loadDatastore(datastoreName.value);
    if (datastoreCache.data.length > 0) setupColumns(datastoreCache.columns);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load datastore';
  } finally {
    loading.value = false;
    tableLoading.value = false;
  }
};

const initializeFiltersFromUrl = () => {
  const filters: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(route.query)) {
    if (key.endsWith('_filter') && typeof value === 'string') {
      const column = key.replace('_filter', '');
      filters[column] = value.split(',').filter((v) => v.trim());
    }
  }
  currentFilters.value = filters;
};

const updateUrlWithFilters = () => {
  const query: Record<string, string> = {};
  for (const [column, values] of Object.entries(currentFilters.value)) {
    if (values && values.length > 0) query[`${column}_filter`] = values.join(',');
  }
  router.replace({ name: route.name || 'DatastoreDetail', params: route.params, query });
};

const clearFilters = () => {
  currentFilters.value = {};
};

const cleanup = () => {
  catalogStore.clearDatastoreCache(datastoreName.value);
};

// Open the repository's issue creation page using the feedback issue template
const openFeedbackIssue = () => {
  const url = 'https://github.com/charles-turner-1/catalog-viewer-spa/issues/new?template=feedback.yml';
  const newWin = window.open(url, '_blank', 'noopener,noreferrer');
  if (newWin) newWin.opener = null;
};

onMounted(() => {
  initializeFiltersFromUrl();
  const existingCache = catalogStore.getDatastoreFromCache(datastoreName.value);
  if (existingCache && existingCache.data.length > 0) {
    setupColumns(existingCache.columns);
    loading.value = false;
    tableLoading.value = false;
  } else {
    loadDatastore();
  }
});

const stopWatcher = watch(
  () => route.params.name,
  (newName, oldName) => {
    if (oldName && newName !== oldName) catalogStore.clearDatastoreCache(oldName as string);
    if (newName) {
      initializeFiltersFromUrl();
      loadDatastore();
    }
  },
);

const stopFilterWatcher = watch(currentFilters, () => updateUrlWithFilters(), { deep: true });

onUnmounted(() => {
  cleanup();
  stopWatcher();
  stopFilterWatcher();
});
</script>

<style scoped>
.datastore-detail-container {
  width: 100%;
  max-width: calc(100vw - 4rem);
  margin: 0 auto;
  padding: 2rem;
}
</style>
