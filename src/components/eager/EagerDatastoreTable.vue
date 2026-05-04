<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
    <!-- Header Section - Always Visible -->
    <div
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
    >
      <div class="flex items-center gap-2">
        <i class="pi pi-database text-blue-600 text-xl"></i>
        <span class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ datastoreName }} Data ({{ filteredData.length?.toLocaleString() }} Data Files)
        </span>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-start sm:items-center">
        <Button
          :label="showTable ? 'Hide Entries' : 'Show Datastore Entries'"
          :icon="showTable ? 'pi pi-eye-slash' : 'pi pi-eye'"
          @click="toggleTable"
          outlined
          size="small"
        />

        <MultiSelect
          v-if="showTable"
          :model-value="selectedColumns"
          @update:model-value="onColumnToggle"
          :options="availableColumns"
          option-label="header"
          placeholder="Select Columns"
          class="w-full sm:w-80"
          display="chip"
        >
          <template #option="{ option }">
            <span>{{ option.header }}</span>
          </template>
        </MultiSelect>
      </div>
    </div>

    <!-- DataTable - Conditionally Rendered -->
    <DataTable
      v-if="showTable"
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
      @page="onTablePage"
    >
      <Column
        v-for="column in selectedColumns"
        :key="column.field"
        :field="column.field"
        :header="column.header"
        :sortable="true"
      >
        <template #body="{ data }">
          <DatastoreTableCell
            :field="column.field"
            :header="column.header"
            :value="data[column.field]"
            @open-modal="openDatastoreEntryModal"
          />
        </template>
      </Column>
    </DataTable>
    <DatastoreEntryModal v-model="showDataStoreEntryModal" :title="modalTitle" :items="modalItems" />
  </div>
</template>

<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import MultiSelect from 'primevue/multiselect';
import { ref } from 'vue';
import DatastoreEntryModal from '../DatastoreEntryModal.vue';
import DatastoreTableCell from '../DatastoreTableCell.vue';
import { capture } from '../../composables/usePosthog';
import { useDatastoreEntryModal } from '../../composables/useDatastoreEntryModal';
import type { DatastoreRow } from '../../types/datastore';
import type { TableColumn } from '../../types/table';

const props = defineProps<{
  filteredData: DatastoreRow[];
  tableLoading: boolean;
  selectedColumns: TableColumn[];
  availableColumns: TableColumn[];
  columns: string[];
  datastoreName: string;
}>();

const emit = defineEmits(['update:selectedColumns']);

// Table visibility state
const showTable = ref(false);

const toggleTable = () => {
  showTable.value = !showTable.value;
  capture('datastore_table_toggled', { datastore_name: props.datastoreName, visible: showTable.value });
};

const onColumnToggle = (value: TableColumn[]) => {
  emit('update:selectedColumns', value);
  capture('table_columns_changed', {
    context: 'datastore',
    datastore_name: props.datastoreName,
    visible_columns: value.map((c) => c.field),
  });
};

const onTablePage = (event: { page: number; rows: number }) => {
  capture('table_page_changed', {
    context: 'datastore',
    datastore_name: props.datastoreName,
    page: event.page + 1,
    page_size: event.rows,
  });
};

const { showDataStoreEntryModal, modalTitle, modalItems, openDatastoreEntryModal } = useDatastoreEntryModal();
</script>

<style scoped></style>
