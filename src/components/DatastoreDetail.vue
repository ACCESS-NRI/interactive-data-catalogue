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
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          ESM Datastore: {{ datastoreName }}
        </h1>
        <p class="text-gray-600 dark:text-gray-300">
          Detailed view of the {{ datastoreName }} ESM datastore containing {{ totalRecords?.toLocaleString() }} records.
        </p>
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
        :raw-data="rawData"
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
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCatalogStore } from '../stores/catalogStore'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import MultiSelect from 'primevue/multiselect'
import QuickStartCode from './QuickStartCode.vue'

// Get the datastore name from route params
const route = useRoute()
const datastoreName = computed(() => route.params.name as string)

// Get access to the catalog store utilities
const catalogStore = useCatalogStore()

// Reactive state
const loading = ref(false)
const tableLoading = ref(false)
const error = ref<string | null>(null)
const totalRecords = ref<number | null>(null)
const columns = ref<string[]>([])
const rawData = ref<any[]>([])
const filterOptions = ref<Record<string, string[]>>({})
const currentFilters = ref<Record<string, string[]>>({})

// Column management
const availableColumns = ref<{field: string, header: string}[]>([])
const selectedColumns = ref<{field: string, header: string}[]>([])

// Computed properties
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

// Helper functions
const formatColumnName = (column: string): string => {
  return column
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const setupColumns = (dataColumns: string[]) => {
  // Filter out the index column from display but keep it for data-key
  const displayColumns = dataColumns.filter(col => col !== '__index_level_0__')
  
  availableColumns.value = displayColumns.map(col => ({
    field: col,
    header: formatColumnName(col)
  }))
  
  // Select all columns by default
  selectedColumns.value = [...availableColumns.value]
}

const onColumnToggle = (value: any[]) => {
  selectedColumns.value = availableColumns.value.filter(col => value.includes(col))
}

const generateFilterOptions = (data: any[]) => {
  const options: Record<string, Set<string>> = {}
  
  data.forEach(row => {
    for (const [column, value] of Object.entries(row)) {
      if (!options[column]) {
        options[column] = new Set()
      }
      
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item != null && String(item).trim()) {
            options[column]?.add(String(item))
          }
        })
      } else if (value != null && String(value).trim()) {
        options[column]?.add(String(value))
      }
    }
  })
  
  // Convert Sets to sorted arrays
  const result: Record<string, string[]> = {}
  for (const [column, optionSet] of Object.entries(options)) {
    result[column] = Array.from(optionSet).sort()
  }
  
  return result
}

// Load datastore information
const loadDatastore = async () => {
  loading.value = true
  tableLoading.value = true
  error.value = null
  
  let db: any = null
  let conn: any = null
  
  try {
    console.log(`🚀 Loading ESM datastore: ${datastoreName.value}`)
    
    // Construct the parquet file URL for this specific datastore
    const parquetUrl = process.env.NODE_ENV === 'production'
      ? `https://corsproxy.io/?https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog/source/${datastoreName.value}.parquet`
      : `/api/parquet/source/${datastoreName.value}.parquet`
    console.log(`📦 Fetching parquet file from: ${parquetUrl}`)
    
    // Fetch parquet file for this specific datastore
    const response = await fetch(parquetUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch datastore parquet file: ${response.status}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    console.log(`📦 Downloaded ${uint8Array.length} bytes for ${datastoreName.value}`)
    
    // Initialize DuckDB using store utilities
    const dbConnection = await catalogStore.initializeDuckDB()
    db = dbConnection.db
    conn = dbConnection.conn
    
    // Query the ESM datastore data
    const datastoreData = await catalogStore.queryEsmDatastore(
      db, 
      conn, 
      uint8Array, 
      datastoreName.value
    )
    
    rawData.value = datastoreData
    totalRecords.value = datastoreData.length
    columns.value = Object.keys(datastoreData[0] || {})
    setupColumns(columns.value)
    filterOptions.value = generateFilterOptions(datastoreData)
    
    console.log(`✅ Loaded ${datastoreData.length} records for ${datastoreName.value}`)
    console.log('📋 Available columns:', columns.value)
    console.log('🔍 Generated filter options:', filterOptions.value)
    
  } catch (err) {
    console.error('❌ Error loading datastore:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load datastore'
  } finally {
    // Cleanup DuckDB resources
    if (conn) await conn.close()
    if (db) await db.terminate()
    loading.value = false
    tableLoading.value = false
  }
}

// Filter methods
const applyFilters = () => {
  // Filters are applied automatically via computed property
  console.log('Filters applied:', currentFilters.value)
}

const clearFilters = () => {
  currentFilters.value = {}
  console.log('Filters cleared')
}

// Load data on component mount
onMounted(() => {
  loadDatastore()
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