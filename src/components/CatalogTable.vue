<template>
  <div class="catalog-table-container">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Interactive Catalog
      </h1>
      <p class="text-gray-600 dark:text-gray-300">
        Explore the metadata catalog with {{ catalogStore.data.length }} entries
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="catalogStore.loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <span class="ml-3 text-lg text-gray-600 dark:text-gray-300">Loading catalog data...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="catalogStore.error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
      <div class="flex items-center">
        <i class="pi pi-exclamation-triangle text-red-500 mr-2"></i>
        <span class="text-red-700 dark:text-red-300 font-medium">Error loading catalog:</span>
      </div>
      <p class="text-red-600 dark:text-red-400 mt-1">{{ catalogStore.error }}</p>
      <button 
        @click="catalogStore.fetchCatalogData"
        class="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
      >
        <i class="pi pi-refresh mr-2"></i>
        Retry
      </button>
    </div>

    <!-- Data Table -->
    <div v-else-if="catalogStore.data.length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <DataTable 
        :value="filteredData" 
        :paginator="true" 
        :rows="25"
        :rows-per-page-options="[10, 25, 50, 100]"
        :total-records="filteredData.length"
        :loading="catalogStore.loading"
        data-key="name"
        show-gridlines
        striped-rows
        removable-sort
        resizable-columns
        column-resize-mode="expand"
        :export-filename="'catalog-' + new Date().toISOString().split('T')[0]"
        class="catalog-datatable"
        selection-mode="single"
        :meta-key-selection="false"
        @row-click="showRowDetail($event.data)"
      >
        <template #header>
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700">
            <div class="flex items-center gap-2">
              <i class="pi pi-database text-blue-600 text-xl"></i>
              <span class="text-lg font-semibold text-gray-900 dark:text-white">
                Catalog Entries ({{ catalogStore.data.length }})
              </span>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <!-- Global Search -->
              <div class="relative">
                <i class="pi pi-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                <InputText 
                  v-model="globalSearchValue"
                  placeholder="Search all fields..."
                  class="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-80"
                />
              </div>
              
              <!-- Column Toggle -->
              <MultiSelect
                :model-value="selectedColumns" 
                @update:model-value="onToggle"
                :options="columns" 
                option-label="header" 
                placeholder="Select Columns"
                class="min-w-48"
                display="chip"
              >
                <template #option="{ option }">
                  <span>{{ option.header }}</span>
                </template>
              </MultiSelect>
            </div>
          </div>
        </template>

        <template #empty>
          <div class="text-center py-8">
            <i class="pi pi-inbox text-gray-400 text-4xl mb-3 block"></i>
            <p class="text-gray-500 dark:text-gray-400">No catalog entries found</p>
          </div>
        </template>

        <!-- Dynamic Columns -->
        <Column 
          v-for="col in selectedColumns" 
          :key="col.field" 
          :field="col.field" 
          :header="col.header"
          :sortable="true"
          :show-filter-operator="false"
          :show-clear-button="false"
          :show-apply-button="false"
          :show-match-modes="false"
          class="min-w-32"
        >
          <template #body="{ data }">
            <!-- Array fields (realm, frequency, variable) -->
            <div v-if="isArrayField(col.field)" class="flex items-center gap-2">
              <span class="font-medium text-gray-900 dark:text-gray-100">
                {{ getArrayPreview(data[col.field]) }}
              </span>
              <Button
                v-if="data[col.field].length > 1"
                icon="pi pi-eye"
                size="small"
                text
                rounded
                class="text-blue-600 hover:bg-blue-50"
                @click="openArrayModal(data[col.field], col.header)"
                :title="`View all ${col.header.toLowerCase()}`"
              />
            </div>
            <!-- Regular string fields -->
            <span v-else class="font-medium text-gray-900 dark:text-gray-100">
              {{ data[col.field] }}
            </span>
          </template>
          
          <template #filter="{ filterModel }">
            <InputText 
              v-model="filterModel.value" 
              type="text" 
              :placeholder="`Search ${col.header}`"
              class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- No Data State -->
    <div v-else class="text-center py-12">
      <i class="pi pi-database text-gray-400 text-6xl mb-4 block"></i>
      <p class="text-xl text-gray-500 dark:text-gray-400 mb-2">No catalog data available</p>
      <p class="text-gray-400 dark:text-gray-500">The catalog appears to be empty</p>
    </div>

    <!-- Array Modal -->
    <Dialog 
      v-model:visible="arrayModalVisible" 
      modal 
      :header="arrayModalTitle"
      :style="{ width: '32rem' }"
      class="mx-4"
    >
      <div class="space-y-3">
        <div 
          v-for="(item, index) in arrayModalItems" 
          :key="index"
          class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
        >
          <div class="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
            {{ index + 1 }}
          </div>
          <span class="text-gray-900 dark:text-gray-100 font-medium">{{ item }}</span>
        </div>
      </div>
      
      <template #footer>
        <Button 
          label="Close" 
          icon="pi pi-times" 
          @click="arrayModalVisible = false"
          autofocus
        />
      </template>
    </Dialog>

    <!-- Row Detail Modal -->
    <CatalogRowDetailModal 
      :visible="detailModalVisible"
      :row-data="selectedRowData"
      @hide="hideRowDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import MultiSelect from 'primevue/multiselect'
import Dialog from 'primevue/dialog'
import CatalogRowDetailModal from './CatalogRowDetailModal.vue'
import { useCatalogStore } from '../stores/catalogStore'

const catalogStore = useCatalogStore()

// Trigger data fetch on component mount
catalogStore.fetchCatalogData()

// Global search
const globalSearchValue = ref('')

// Filtered data based on search
const filteredData = computed(() => {
  if (!globalSearchValue.value.trim()) {
    return catalogStore.data
  }
  
  const searchTerm = globalSearchValue.value.toLowerCase()
  
  return catalogStore.data.filter(row => {
    return (
      row.name?.toLowerCase().includes(searchTerm) ||
      row.description?.toLowerCase().includes(searchTerm) ||
      row.searchableModel?.toLowerCase().includes(searchTerm) ||
      row.searchableRealm?.toLowerCase().includes(searchTerm) ||
      row.searchableFrequency?.toLowerCase().includes(searchTerm) ||
      row.searchableVariable?.toLowerCase().includes(searchTerm)
    )
  })
})

// Define available columns
const columns = ref([
  { field: 'name', header: 'Name' },
  { field: 'model', header: 'Model' },
  { field: 'description', header: 'Description' },
  { field: 'realm', header: 'Realm' },
  { field: 'frequency', header: 'Frequency' },
  { field: 'variable', header: 'Variable' }
])

// Selected columns (all by default)
const selectedColumns = ref([...columns.value])

// Array modal state
const arrayModalVisible = ref(false)
const arrayModalTitle = ref('')
const arrayModalItems = ref<string[]>([])

// Row detail modal state  
const detailModalVisible = ref(false)
const selectedRowData = ref(null)

// Array field detection
const arrayFields = ['model', 'realm', 'frequency', 'variable']
const isArrayField = (fieldName: string) => arrayFields.includes(fieldName)

// Get preview text for array fields
const getArrayPreview = (value: string[] | string) => {
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None'
    if (value.length === 1) return value[0]
    return `${value[0]} (+${value.length - 1} more)`
  }
  return value || ''
}

// Open array modal
const openArrayModal = (items: string[], title: string) => {
  arrayModalTitle.value = title
  arrayModalItems.value = items
  arrayModalVisible.value = true
}

// Show row detail modal
const showRowDetail = (rowData: any) => {
  selectedRowData.value = rowData
  detailModalVisible.value = true
}

// Hide row detail modal
const hideRowDetail = () => {
  detailModalVisible.value = false
  selectedRowData.value = null
}

// Column toggle handler
const onToggle = (value: any[]) => {
  selectedColumns.value = columns.value.filter(col => value.includes(col))
}
</script>

<style scoped>
.catalog-table-container {
  width: 100%;
  max-width: calc(100vw - 4rem); /* Full width minus margin */
  margin: 0 auto;
  padding: 2rem;
}

:deep(.catalog-datatable) {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

:deep(.p-datatable-header) {
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

:deep(.p-datatable-thead > tr > th) {
  background-color: #f3f4f6;
  color: #111827;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
}

:deep(.p-datatable-tbody > tr) {
  border-bottom: 1px solid #f3f4f6;
  transition: all 0.15s ease;
  cursor: pointer;
}

:deep(.p-datatable-tbody > tr:hover) {
  background-color: #f9fafb;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

:deep(.p-datatable-tbody > tr > td) {
  color: #111827;
  border-bottom: 1px solid #f3f4f6;
}

:deep(.p-paginator) {
  background-color: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

:deep(.p-inputtext) {
  background-color: #ffffff;
  color: #111827;
}

:deep(.p-multiselect) {
  background-color: #ffffff;
  border-color: #d1d5db;
}

@media (prefers-color-scheme: dark) {
  :deep(.catalog-datatable) {
    border-color: #4b5563;
  }

  :deep(.p-datatable-header) {
    background-color: #374151;
    border-bottom-color: #4b5563;
  }

  :deep(.p-datatable-thead > tr > th) {
    background-color: #374151;
    color: #f9fafb;
    border-bottom-color: #4b5563;
  }

  :deep(.p-datatable-tbody > tr) {
    border-bottom-color: #374151;
  }

  :deep(.p-datatable-tbody > tr:hover) {
    background-color: #374151;
  }

  :deep(.p-datatable-tbody > tr > td) {
    color: #f9fafb;
    border-bottom-color: #374151;
  }

  :deep(.p-paginator) {
    background-color: #374151;
    border-top-color: #4b5563;
  }

  :deep(.p-inputtext) {
    background-color: #1f2937;
    color: #f9fafb;
  }

  :deep(.p-multiselect) {
    background-color: #1f2937;
    border-color: #4b5563;
  }
}
</style>