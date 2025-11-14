<template>
  <div class="datastore-detail-container">
    <!-- Breadcrumb Navigation -->
    <nav class="mb-6" aria-label="breadcrumb">
      <ol class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
        <li class="flex items-center">
          <RouterLink 
            to="/" 
            class="flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
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

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <span class="ml-3 text-lg text-gray-600 dark:text-gray-300">Loading datastore...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
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

    <!-- Alpha Warning -->
    <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
      <div class="flex items-center">
        <i class="pi pi-exclamation-triangle text-yellow-600 mr-2"></i>
        <strong class="text-yellow-700 dark:text-yellow-300">Alpha Software:</strong>
      </div>
      <p class="text-yellow-700 dark:text-yellow-300 mt-1">
        The intake catalog interface is currently in alpha and under active development. 
        Features and functionality may change in future releases.
      </p>
    </div>

    <!-- Content -->
    <div v-if="!loading && !error">
      <!-- Header -->
   <div class="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          ESM Datastore: {{ datastoreName }}
        </h1>
        <p class="text-gray-600 dark:text-gray-300">
          Detailed view of the {{ datastoreName }} ESM datastore containing {{ totalRecords?.toLocaleString() }} records.
        </p>
      </div>
      
      <!-- Vertical divider (hidden on mobile) -->
      <div class="hidden lg:block w-px h-16 bg-gray-300 dark:bg-gray-600 mx-6"></div>
      
      <!-- Right side - Documentation links -->
      <div class="flex-shrink-0">
        <div class="text-sm text-gray-500 dark:text-gray-400 mb-2 lg:text-right">
          Documentation
        </div>
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

      <!-- Datastore Info -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Records</div>
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {{ totalRecords?.toLocaleString() }}
            </div>
          </div>
          <div>
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Columns</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ availableColumns?.length || 0 }}
            </div>
          </div>
          <div>
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Available Columns</div>
            <div class="flex flex-wrap gap-1 mt-2">
              <span 
                v-for="column in availableColumns.slice(0, 5)" 
                :key="column.field"
                class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
              >
                {{ column.header }}
              </span>
              <span 
                v-if="availableColumns.length > 5"
                class="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 rounded text-xs"
              >
                +{{ availableColumns.length - 5 }} more
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Start Code -->
      <QuickStartCode 
        :datastore-name="datastoreName" 
        :current-filters="currentFilters"
        :raw-data="filteredData"
        class="mb-6"
      />

      <!-- Filter Section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
        <h6 class="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200 flex items-center">
          <i class="pi pi-filter mr-2"></i>
          Filters & Search
        </h6>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div v-for="(options, column) in filterOptions" :key="column" class="flex flex-col">
            <label :for="`${column}_filter`" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ formatColumnName(column) }}
              <span class="text-gray-500 text-xs">({{ options.length }} options)</span>
            </label>
            <MultiSelect 
              :id="`${column}_filter`"
              v-model="currentFilters[column]"
              :options="options"
              :placeholder="`Select ${formatColumnName(column)}`"
              :showClear="true"
              :maxSelectedLabels="2"
              selectedItemsLabel="{0} items selected"
              @change="applyFilters"
              class="w-full"
              display="chip"
            />
          </div>
        </div>
        
        <div class="mt-4">
          <Button 
            label="Clear Filters" 
            icon="pi pi-times-circle" 
            @click="clearFilters"
            outlined
            severity="secondary"
            size="small"
          />
        </div>
      </div>

      <!-- Data Table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <DataTable 
          :value="filteredData" 
          :paginator="true" 
          :rows="25"
          :rows-per-page-options="[10, 25, 50, 100]"
          :total-records="filteredData.length"
          :loading="tableLoading"
          data-key="__index_level_0__"
          show-gridlines
          striped-rows
          removable-sort
          resizable-columns
          column-resize-mode="expand"
          :global-filter-fields="columns"
          class="datastore-table"
        >
          <template #header>
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700">
              <div class="flex items-center gap-2">
                <i class="pi pi-database text-blue-600 text-xl"></i>
                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ datastoreName }} Data ({{ filteredData.length?.toLocaleString() }} records)
                </span>
              </div>
              
              <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <!-- Column Toggle -->
                <MultiSelect
                  :model-value="selectedColumns" 
                  @update:model-value="onColumnToggle"
                  :options="availableColumns" 
                  option-label="header" 
                  placeholder="Select Columns"
                  class="min-w-48"
                  display="chip"
                >
                  <template #option="{ option }">
                    <span>{{ option.header }}</span>
                  </template>
                </MultiSelect>
                
                <Button 
                  label="Refresh" 
                  icon="pi pi-refresh" 
                  @click="loadDatastore"
                  outlined
                  size="small"
                />
              </div>
            </div>
          </template>

          <Column 
            v-for="column in selectedColumns" 
            :key="column.field" 
            :field="column.field" 
            :header="column.header"
            :sortable="true"
          >
            <template #body="{ data }">
              <!-- Special formatting for different column types -->
              <div v-if="column.field === 'variable' && Array.isArray(data[column.field])">
                <div class="flex flex-wrap gap-1">
                  <span 
                    v-for="variable in data[column.field].slice(0, 3)" 
                    :key="variable"
                    class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
                  >
                    {{ variable }}
                  </span>
                  <span 
                    v-if="data[column.field].length > 3"
                    class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                  >
                    +{{ data[column.field].length - 3 }} more
                  </span>
                </div>
              </div>
              
              <div v-else-if="column.field === 'variable_units' && Array.isArray(data[column.field])">
                <div class="flex flex-wrap gap-1">
                  <span 
                    v-for="unit in data[column.field].slice(0, 2)" 
                    :key="unit"
                    class="px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded text-xs"
                  >
                    {{ unit }}
                  </span>
                  <span 
                    v-if="data[column.field].length > 2"
                    class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                  >
                    +{{ data[column.field].length - 2 }} more
                  </span>
                </div>
              </div>
              
              <span v-else-if="column.field === 'frequency'" class="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs font-medium">
                {{ data[column.field] || '-' }}
              </span>
              
              <span v-else-if="column.field === 'realm'" class="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-xs font-medium">
                {{ data[column.field] || '-' }}
              </span>
              
              <!-- Long text fields with truncation -->
              <div v-else-if="column.field.includes('variable_long_name') || column.field.includes('variable_standard_name') || column.field.includes('variable_cell_methods')">
                <div v-if="Array.isArray(data[column.field])">
                  <div 
                    v-for="(item, index) in data[column.field].slice(0, 2)" 
                    :key="index"
                    class="mb-1 text-sm"
                  >
                    <span 
                      v-if="item && item.length > 40"
                      :title="item"
                      class="text-gray-700 dark:text-gray-300"
                    >
                      {{ item.substring(0, 40) }}...
                    </span>
                    <span v-else class="text-gray-700 dark:text-gray-300">{{ item || '-' }}</span>
                  </div>
                  <span 
                    v-if="data[column.field].length > 2"
                    class="text-xs text-gray-500"
                  >
                    +{{ data[column.field].length - 2 }} more
                  </span>
                </div>
                <span v-else class="text-gray-700 dark:text-gray-300">{{ data[column.field] || '-' }}</span>
              </div>
              
              <!-- Default formatting -->
              <span v-else class="text-gray-900 dark:text-gray-100">
                {{ data[column.field] || '-' }}
              </span>
            </template>
          </Column>
        </DataTable>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalogStore } from '../stores/catalogStore'
import type { DatastoreCache } from '../stores/catalogStore'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import MultiSelect from 'primevue/multiselect'
import QuickStartCode from './QuickStartCode.vue'

// Get the datastore name from route params
const route = useRoute()
const router = useRouter()
const datastoreName = computed(() => route.params.name as string)

// Get access to the catalog store
const catalogStore = useCatalogStore()

// Local reactive state (for UI state not in cache)
const loading = ref(false)
const tableLoading = ref(false)
const error = ref<string | null>(null)
const currentFilters = ref<Record<string, string[]>>({})

// Column management
const availableColumns = ref<{field: string, header: string}[]>([])
const selectedColumns = ref<{field: string, header: string}[]>([])

// Computed properties that use cached data
const cachedDatastore = computed(() => 
  catalogStore.getDatastoreFromCache(datastoreName.value)
)

const rawData = computed(() => cachedDatastore.value?.data || [])
const totalRecords = computed(() => cachedDatastore.value?.totalRecords || 0)
const columns = computed(() => cachedDatastore.value?.columns || [])
const filterOptions = computed(() => cachedDatastore.value?.filterOptions || {})

// Helper functions (defined before watchers to avoid hoisting issues)
const formatColumnName = (column: string): string => {
  return column
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const setupColumns = (dataColumns: string[]) => {
  availableColumns.value = dataColumns.map(col => ({
    field: col,
    header: formatColumnName(col)
  }))
  
  // Select all columns by default
  selectedColumns.value = [...availableColumns.value]
}

const onColumnToggle = (value: any[]) => {
  selectedColumns.value = availableColumns.value.filter(col => value.includes(col))
}

// Watch for changes in cached data to update UI and loading states
watch(cachedDatastore, (newCache: DatastoreCache | null) => {
  if (newCache && newCache.data.length > 0) {
    setupColumns(newCache.columns)
    error.value = null
    loading.value = false
    tableLoading.value = false
  } else if (newCache?.error) {
    error.value = newCache.error
    loading.value = false
    tableLoading.value = false
  } else if (newCache?.loading) {
    loading.value = true
    tableLoading.value = true
  }
}, { immediate: true })

// Also watch for loading state changes from the store
watch(
  () => catalogStore.isDatastoreLoading(datastoreName.value),
  (isLoading) => {
    if (isLoading) {
      loading.value = true
      tableLoading.value = true
    } else {
      // Only set to false if we have data or an error
      const cached = cachedDatastore.value
      if (cached && (cached.data.length > 0 || cached.error)) {
        loading.value = false
        tableLoading.value = false
      }
    }
  },
  { immediate: true }
)
const filteredData = computed(() => {
  let data = rawData.value
  
  // Apply filters
  for (const [column, filterValues] of Object.entries(currentFilters.value)) {
    if (filterValues && filterValues.length > 0) {
      data = data.filter(row => {
        const cellValue = row[column]
        
        // Check if any of the selected filter values match the cell value
        return filterValues.some(filterValue => {
          if (Array.isArray(cellValue)) {
            return cellValue.some(item => String(item).toLowerCase().includes(filterValue.toLowerCase()))
          }
          return String(cellValue || '').toLowerCase().includes(filterValue.toLowerCase())
        })
      })
    }
  }
  
  return data
})

// Load datastore information using cached store
const loadDatastore = async () => {
  // Check if we already have cached data for this datastore
  const existingCache = catalogStore.getDatastoreFromCache(datastoreName.value)
  if (existingCache && existingCache.data.length > 0) {
    console.log(`✅ Using cached data for ${datastoreName.value}`)
    // Data is already available, just setup columns
    setupColumns(existingCache.columns)
    loading.value = false
    tableLoading.value = false
    return
  }
  
  loading.value = true
  tableLoading.value = true
  error.value = null
  
  try {
    console.log(`🚀 Loading ESM datastore: ${datastoreName.value}`)
    
    // Use the store's caching system
    const datastoreCache = await catalogStore.loadDatastore(datastoreName.value)
    
    // The cache data will automatically update through computed properties
    // Just need to setup columns if we have data
    if (datastoreCache.data.length > 0) {
      setupColumns(datastoreCache.columns)
    }
    
    console.log(`✅ Loaded datastore ${datastoreName.value}`)
    
  } catch (err) {
    console.error('❌ Error loading datastore:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load datastore'
  } finally {
    loading.value = false
    tableLoading.value = false
  }
}

// Filter methods
const initializeFiltersFromUrl = () => {
  const filters: Record<string, string[]> = {}
  
  // Parse query parameters that end with '_filter'
  for (const [key, value] of Object.entries(route.query)) {
    if (key.endsWith('_filter') && typeof value === 'string') {
      const column = key.replace('_filter', '')
      filters[column] = value.split(',').filter(v => v.trim())
    }
  }
  
  currentFilters.value = filters
  console.log('Initialized filters from URL:', filters)
}

const updateUrlWithFilters = () => {
  const query: Record<string, string> = {}
  
  // Convert filters to query parameters
  for (const [column, values] of Object.entries(currentFilters.value)) {
    if (values && values.length > 0) {
      query[`${column}_filter`] = values.join(',')
    }
  }
  
  // Update the route query parameters without triggering navigation
  router.replace({
    name: route.name || 'DatastoreDetail',
    params: route.params,
    query
  })
}

const applyFilters = () => {
  // Filters are applied automatically via computed property
  // URL updates are handled automatically by the watcher
  console.log('Filters applied:', currentFilters.value)
}

const clearFilters = () => {
  currentFilters.value = {}
  console.log('Filters cleared')
}

// Cleanup function for memory management
const cleanup = () => {
  // Clear the cache for this specific datastore when navigating away
  catalogStore.clearDatastoreCache(datastoreName.value)
  console.log(`🗑️ Cleaned up cache for ${datastoreName.value}`)
}

// Load data on component mount
onMounted(() => {
  // Initialize filters from URL query parameters first
  initializeFiltersFromUrl()
  
  // Check if we already have data cached (e.g., from prefetching)
  const existingCache = catalogStore.getDatastoreFromCache(datastoreName.value)
  if (existingCache && existingCache.data.length > 0) {
    console.log(`🎯 Found prefetched data for ${datastoreName.value}`)
    setupColumns(existingCache.columns)
    loading.value = false
    tableLoading.value = false
  } else {
    loadDatastore()
  }
})

// Watch for route changes to handle navigation between different datastores
const stopWatcher = watch(
  () => route.params.name,
  (newName, oldName) => {
    if (oldName && newName !== oldName) {
      // Clean up cache for the old datastore
      catalogStore.clearDatastoreCache(oldName as string)
      console.log(`🗑️ Cleaned up cache for ${oldName} due to navigation`)
    }
    if (newName) {
      // Load the new datastore and reinitialize filters from URL
      initializeFiltersFromUrl()
      loadDatastore()
    }
  }
)

// Watch for filter changes to update URL automatically
const stopFilterWatcher = watch(
  currentFilters,
  () => {
    updateUrlWithFilters()
  },
  { deep: true }
)

// Cleanup on unmount
onUnmounted(() => {
  cleanup()
  stopWatcher() // Stop the route watcher
  stopFilterWatcher() // Stop the filter watcher
})
</script>

<style scoped>
.datastore-detail-container {
  width: 100%;
  max-width: calc(100vw - 4rem);
  margin: 0 auto;
  padding: 2rem;
}
</style>