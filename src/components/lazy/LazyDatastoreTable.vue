<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
    <!-- Header Section - Always Visible -->
    <div
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
    >
      <div class="flex items-center gap-2">
        <i class="pi pi-database text-blue-600 text-xl"></i>
        <span class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ datastoreName }} Data ({{ totalRecords?.toLocaleString() }} Data Files)
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
      lazy
      :value="results"
      :loading="isFetching"
      paginator
      :first="offset"
      :rows="limit"
      :rowsPerPageOptions="rowOptions"
      :totalRecords="totalRecords"
      tableStyle="min-width: 50rem"
      @page="onPageChange"
      @sort="onSort"
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
import { ref, computed, watch } from 'vue';
import { useFetch } from '@vueuse/core';
import DatastoreEntryModal from '../DatastoreEntryModal.vue';
import DatastoreTableCell from '../DatastoreTableCell.vue';
import type { DataTableSortEvent } from 'primevue/datatable';
import { buildEsmDatastoreTableUrl } from '../../config/catalogEndpoints';
import { capture } from '../../composables/usePosthog';
import { useDatastoreEntryModal } from '../../composables/useDatastoreEntryModal';
import type { FilterMap, PagedDatastoreResponse } from '../../types/datastore';
import type { TableColumn } from '../../types/table';

type PageEvent = {
  page: number;
  first: number;
  rows: number;
  pageCount: number;
};

const props = defineProps<{
  tableLoading: boolean;
  filters: FilterMap;
  selectedColumns: TableColumn[];
  availableColumns: TableColumn[];
  columns: string[];
  datastoreName: string;
}>();

const page = ref(0);
const sortField = ref<string | null>(null);
const sortOrder = ref<1 | -1 | null>(null);

const url = computed(() => {
  const params = new URLSearchParams({
    offset: String(offset.value),
    limit: String(limit.value),
    filters: JSON.stringify(props.filters || {}),
  });
  if (sortField.value) {
    params.append('sortField', sortField.value);
  }
  if (sortOrder.value) {
    params.append('sortOrder', String(sortOrder.value));
  }

  const endpoint = buildEsmDatastoreTableUrl(props.datastoreName, params.toString());

  console.log('Fetching data from URL: ', endpoint);

  return endpoint;
});

const results = computed(() => data.value?.records || []);
const totalRecords = computed(() => data.value?.total);
const numDatasets = computed(() => data.value?.unique_file_ids?.length || 0);
const dynamicFilterOptions = computed(() => data.value?.dynamic_filter_options || {});

const showTable = ref(false);
const toggleTable = () => {
  showTable.value = !showTable.value;
  capture('datastore_table_toggled', { datastore_name: props.datastoreName, visible: showTable.value });
};

const rowOptions: number[] = [5, 10, 25, 50];

const limit = ref(rowOptions[0]);
const offset = computed(() => Number((limit.value ?? 0) * page.value));

// error is not used - but we will probably want to later!
// @ts-expect-error
const { isFetching, error, data } = useFetch(url, { refetch: true }).json<PagedDatastoreResponse>();

async function onPageChange(event: PageEvent) {
  page.value = event.page;
  limit.value = event.rows;
  capture('table_page_changed', {
    context: 'datastore',
    datastore_name: props.datastoreName,
    page: event.page + 1,
    page_size: event.rows,
  });
}

function onSort(event: DataTableSortEvent) {
  if (typeof event.sortField === 'string') {
    sortField.value = event.sortField;
  } else {
    sortField.value = null;
  }
  sortOrder.value = event.sortOrder === 0 ? null : (event.sortOrder as 1 | -1);
  page.value = 0; // Reset to first page when sorting
}

const { showDataStoreEntryModal, modalTitle, modalItems, openDatastoreEntryModal } = useDatastoreEntryModal();

const emit = defineEmits(['update:selectedColumns', 'setNumDatasets', 'setDynamicFilterOptions']);

const onColumnToggle = (value: TableColumn[]) => {
  emit('update:selectedColumns', value);
  capture('table_columns_changed', {
    context: 'datastore',
    datastore_name: props.datastoreName,
    visible_columns: value.map((c) => c.field),
  });
};

watch(numDatasets, (newVal) => {
  emit('setNumDatasets', newVal);
});

watch(dynamicFilterOptions, (newVal) => {
  emit('setDynamicFilterOptions', newVal);
});
</script>

<style scoped></style>
