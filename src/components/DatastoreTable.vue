<template>
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
        <div
          class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700"
        >
          <div class="flex items-center gap-2">
            <i class="pi pi-database text-blue-600 text-xl"></i>
            <span class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ datastoreName }} Data ({{ filteredData.length?.toLocaleString() }}
              records)
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

            <Button label="Refresh" icon="pi pi-refresh" @click="onRefresh" outlined size="small" />
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

          <span
            v-else-if="column.field === 'frequency'"
            class="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs font-medium"
          >
            {{ data[column.field] || '-' }}
          </span>

          <span
            v-else-if="column.field === 'realm'"
            class="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-xs font-medium"
          >
            {{ data[column.field] || '-' }}
          </span>

          <!-- Long text fields with truncation -->
          <div
            v-else-if="
              column.field.includes('variable_long_name') ||
              column.field.includes('variable_standard_name') ||
              column.field.includes('variable_cell_methods')
            "
          >
            <div v-if="Array.isArray(data[column.field])">
              <div v-for="(item, index) in data[column.field].slice(0, 2)" :key="index" class="mb-1 text-sm">
                <span v-if="item && item.length > 40" :title="item" class="text-gray-700 dark:text-gray-300">
                  {{ item.substring(0, 40) }}...
                </span>
                <span v-else class="text-gray-700 dark:text-gray-300">{{ item || '-' }}</span>
              </div>
              <span v-if="data[column.field].length > 2" class="text-xs text-gray-500">
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
</template>

<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import MultiSelect from 'primevue/multiselect';

defineProps<{
  filteredData: any[];
  tableLoading: boolean;
  selectedColumns: Array<{ field: string; header: string }>;
  availableColumns: Array<{ field: string; header: string }>;
  columns: string[];
  datastoreName: string;
}>();

const emit = defineEmits(['update:selectedColumns', 'refresh']);

const onColumnToggle = (value: any[]) => {
  emit('update:selectedColumns', value);
};

const onRefresh = () => {
  emit('refresh');
};
</script>

<style scoped></style>
