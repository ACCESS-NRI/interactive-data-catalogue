<template>
  <div class="overflow-hidden rounded-xl border border-sky-200 bg-white dark:border-sky-800 dark:bg-gray-800">
    <div class="grid gap-3 bg-sky-50 p-4 sm:grid-cols-2 dark:bg-sky-950/30">
      <section v-for="collection in collections" :key="collection.name" :aria-label="`${collection.label} at NCI`">
        <RouterLink
          :to="collectionLink(collection.name)"
          class="text-sm font-semibold text-blue-700 underline dark:text-blue-300"
        >
          {{ collection.label }} · {{ collection.name }}
        </RouterLink>
        <p role="status" class="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {{
            collection.loading
              ? 'Searching NCI…'
              : collection.total === null
                ? 'Results unavailable'
                : `${collection.total.toLocaleString()} local file records`
          }}
        </p>
        <p v-if="collection.error" role="alert" class="mt-2 text-sm text-amber-900 dark:text-amber-200">
          {{ collection.error }}
          <button type="button" class="ml-2 underline" @click="retry(collection)">Retry NCI search</button>
        </p>
      </section>
    </div>
    <p class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
      One list across both collections, showing up to {{ pageSize }} files from each collection per page. These are file
      records; a dataset may span several files or occur in both collections.
    </p>
    <div v-if="rows.length" class="overflow-x-auto">
      <table class="w-full min-w-[56rem] text-left text-sm">
        <caption class="sr-only">
          {{
            project
          }}
          files across NCI collections
        </caption>
        <thead class="text-gray-600 dark:text-gray-300">
          <tr>
            <th v-for="column in columns" :key="column.field" scope="col" class="p-3">{{ column.label }}</th>
            <th scope="col" class="p-3">Collection</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" class="border-t border-gray-200 align-top dark:border-gray-700">
            <td v-for="column in columns" :key="column.field" class="max-w-md break-words p-3">
              {{ display(row.record[column.field]) }}
            </td>
            <td class="p-3">
              <RouterLink :to="collectionLink(row.collection)" class="text-blue-700 underline dark:text-blue-300">{{
                row.collection
              }}</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="!loading && !hasErrors" role="status" class="p-4 text-sm text-gray-600 dark:text-gray-300">
      <p>No files in the NCI catalogue match these filters.</p>
      <p class="mt-2">
        Can't find it on NCI?
        <button
          type="button"
          class="font-semibold text-blue-700 underline dark:text-blue-300"
          @click="emit('search-esgf')"
        >
          Try searching ESGF
        </button>
        with the same filters.
      </p>
    </div>
    <p v-if="hasErrors" role="status" class="px-4 pb-3 text-sm text-amber-900 dark:text-amber-200">
      Results are incomplete. Retry the unavailable collection to continue paging.
    </p>
    <nav
      v-if="pageCount > 1 || page > 0"
      aria-label="NCI result pages"
      class="flex flex-wrap items-center gap-4 border-t border-gray-200 p-3 text-sm dark:border-gray-700"
    >
      <button
        type="button"
        class="rounded border px-3 py-1 disabled:opacity-40"
        :disabled="loading || page === 0"
        @click="page--"
      >
        Previous
      </button>
      <span
        >Page {{ page + 1
        }}<template v-if="!loading && !hasErrors"> of {{ pageCount.toLocaleString() }}</template></span
      >
      <button
        type="button"
        class="rounded border px-3 py-1 disabled:opacity-40"
        :disabled="loading || hasErrors || page + 1 >= pageCount"
        @click="page++"
      >
        Next
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { buildFilterQuery } from '../composables/useFilterUrlSync';
import { CMIP_COLLECTIONS, fetchCmipNciPage } from '../services/cmipSearch';
import type { DatastoreCellValue, DatastoreRow, FilterMap } from '../types/datastore';
import type { CmipProject } from '../services/cmipEsmvalcoreCode';

const props = defineProps<{ project: CmipProject; filters: FilterMap }>();
const emit = defineEmits<{ 'search-esgf': [] }>();
interface CollectionPage {
  name: string;
  label: string;
  records: DatastoreRow[];
  total: number | null;
  loading: boolean;
  error: string;
}
const collections = ref<CollectionPage[]>([]);
const page = ref(0);
const pageSize = 10;
const loading = computed(() => collections.value.some((collection) => collection.loading));
const hasErrors = computed(() => collections.value.some((collection) => collection.error));
const pageCount = computed(() =>
  Math.max(1, ...collections.value.map((collection) => Math.ceil((collection.total ?? 0) / pageSize))),
);
// Interleave each collection's page so both sources remain visible in one table.
const rows = computed(() =>
  Array.from({ length: pageSize }, (_, index) =>
    collections.value.flatMap((collection) => {
      const record = collection.records[index];
      return record ? [{ key: `${collection.name}:${index}`, record, collection: collection.name }] : [];
    }),
  ).flat(),
);
const columns = computed(() => [
  { field: 'source_id', label: 'Model' },
  { field: 'experiment_id', label: 'Experiment' },
  { field: props.project === 'CMIP6' ? 'variable_id' : 'branded_variable', label: 'Variable' },
  { field: props.project === 'CMIP6' ? 'member_id' : 'variant_label', label: 'Member' },
  { field: 'frequency', label: 'Frequency' },
  ...(props.project === 'CMIP6'
    ? [
        { field: 'table_id', label: 'Table' },
        { field: 'time_range', label: 'Time range' },
      ]
    : [
        { field: 'start_time', label: 'Start time' },
        { field: 'end_time', label: 'End time' },
      ]),
]);
const display = (value: DatastoreCellValue | undefined) => (Array.isArray(value) ? value.join(', ') : (value ?? '—'));
const collectionLink = (name: string) => ({
  name: 'DatastoreDetail',
  params: { name },
  query: buildFilterQuery(props.filters),
});
let controller: AbortController | undefined;
async function loadCollection(collection: CollectionPage, signal: AbortSignal) {
  collection.loading = true;
  collection.error = '';
  collection.records = [];
  collection.total = null;
  try {
    const result = await fetchCmipNciPage(collection.name, props.filters, signal, page.value * pageSize, pageSize);
    if (signal.aborted) return;
    collection.records = result.records;
    collection.total = result.total;
  } catch (cause) {
    if (!signal.aborted) collection.error = cause instanceof Error ? cause.message : 'NCI search is unavailable.';
  } finally {
    if (!signal.aborted) collection.loading = false;
  }
}
function load() {
  controller?.abort();
  controller = new AbortController();
  collections.value = CMIP_COLLECTIONS[props.project].map((collection) => ({
    ...collection,
    records: [],
    total: null,
    loading: true,
    error: '',
  }));
  for (const collection of collections.value) void loadCollection(collection, controller.signal);
}
function retry(collection: CollectionPage) {
  if (controller && !collection.loading) void loadCollection(collection, controller.signal);
}
watch(
  [() => props.project, () => props.filters],
  () => {
    page.value = 0;
  },
  { deep: true, flush: 'sync' },
);
watch([() => props.project, () => props.filters, page], load, { immediate: true, deep: true });
onBeforeUnmount(() => controller?.abort());
</script>
