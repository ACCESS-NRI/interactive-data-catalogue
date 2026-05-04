<template>
  <div class="datastore-detail-container">
    <nav class="mb-6" aria-label="breadcrumb">
      <ol class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
        <li class="flex items-center">
          <RouterLink to="/" class="flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <i class="pi pi-table mr-1"></i>
            Catalogue
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
        <DatastoreHeader :datastore-name="datastoreName" :total-records="totalRecords" />

        <!-- Beta Warning -->
        <div
          class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6"
        >
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div class="flex items-center">
                <i class="pi pi-exclamation-triangle text-yellow-600 mr-2"></i>
                <strong class="text-yellow-700 dark:text-yellow-300">Beta Software:</strong>
              </div>
              <p class="text-yellow-700 dark:text-yellow-300 mt-1">
                The interactive catalogue interface is currently in beta and under active development. Features and
                functionality may change in future releases.
              </p>
            </div>

            <!-- Vertical divider (hidden on mobile) -->
            <div class="hidden lg:block w-px h-16 bg-gray-300 dark:bg-gray-600 mx-6"></div>

            <!-- Right side - Actions -->
            <div class="flex-shrink-0 flex items-center space-x-3 lg:justify-end">
              <GithubFeedbackButton />
            </div>
          </div>
        </div>

        <LazyQuickStartCode
          :datastore-name="datastoreName"
          :current-filters="currentFilters"
          :dynamic-filter-options="dynamicFilterOptions"
          :num-datasets="numDatasets"
          class="mb-6"
        />

        <FilterSelectors
          v-model="currentFilters"
          :filter-options="filterOptions"
          :dynamic-filter-options="dynamicFilterOptions"
          @clear="handleClearFilters"
          @dropdown-opened="handleDropdownOpened"
          @dropdown-closed="handleDropdownClosed"
          :toast="true"
          analytics-context="datastore"
        />

        <LazyDatastoreTable
          :table-loading="tableLoading"
          v-model:selectedColumns="selectedColumns"
          :available-columns="availableColumns"
          :columns="columns"
          :datastore-name="datastoreName"
          :filters="currentFilters"
          @set-num-datasets="numDatasets = $event"
          @set-dynamic-filter-options="handleDynamicFilterOptionsUpdate"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DatastoreHeader from '../DatastoreHeader.vue';
import LazyQuickStartCode from './LazyQuickStartCode.vue';
import LazyDatastoreTable from './LazyDatastoreTable.vue';
import FilterSelectors from '../FilterSelectors.vue';
import GithubFeedbackButton from '../GithubFeedbackButton.vue';
import { capture } from '../../composables/usePosthog';
import { useDatastoreDetail } from '../../composables/useDatastoreDetail';
import { useFilterState } from '../../composables/useFilterState';
import { useFilterUrlSync } from '../../composables/useFilterUrlSync';
import { useBufferedDynamicFilterOptions } from '../../composables/useBufferedDynamicFilterOptions';

const route = useRoute();
const router = useRouter();
const { currentFilters, clearFilters } = useFilterState();
const numDatasets = ref(0);

const { initializeFiltersFromUrl, stopFilterWatcher } = useFilterUrlSync(route, router, currentFilters, 'DatastoreDetail');
const bufferedDynamicFilterOptions = useBufferedDynamicFilterOptions();
const {
  dynamicFilterOptions,
  handleDynamicFilterOptionsUpdate,
  handleDropdownOpened,
  handleDropdownClosed,
  resetBufferedDynamicFilterOptions,
} = bufferedDynamicFilterOptions;

const {
  datastoreName,
  loading,
  tableLoading,
  error,
  availableColumns,
  selectedColumns,
  totalRecords,
  columns,
  filterOptions,
  loadDatastore,
} = useDatastoreDetail({
  loadingStrategy: 'lazy',
  isCacheReady: (cache) => cache.columns.length > 0,
  initializeFiltersFromUrl,
  stopFilterWatcher,
  onCacheReady: (cache) => {
    dynamicFilterOptions.value = cache.filterOptions;
  },
  onUnmount: () => {
    resetBufferedDynamicFilterOptions();
  },
});

defineExpose({
  openDropdowns: bufferedDynamicFilterOptions.openDropdowns,
  pendingFilterUpdates: bufferedDynamicFilterOptions.pendingFilterUpdates,
});

const handleClearFilters = () => {
  clearFilters();
  capture('datastore_filters_cleared', { datastore_name: datastoreName.value });
};
</script>

<style scoped>
.datastore-detail-container {
  width: 100%;
  max-width: calc(100vw - 4rem);
  margin: 0 auto;
  padding: 2rem;
}
</style>
