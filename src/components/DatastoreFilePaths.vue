<template>
  <details
    class="mb-6 rounded-lg border border-teal-200 bg-teal-50/70 dark:border-teal-800 dark:bg-teal-950/30"
    @toggle="onToggle"
  >
    <summary class="cursor-pointer px-4 py-3 font-semibold text-teal-900 dark:text-teal-100">Dataset paths</summary>
    <div v-if="isOpen" class="px-4 pb-4">
      <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">
        One directory per dataset, grouping the files matching your filters. When files span subdirectories, their
        common parent is shown. A directory may also contain other datasets or versions.
      </p>
      <p v-if="loading" role="status" class="text-sm text-gray-600 dark:text-gray-300">Loading dataset paths…</p>
      <div v-else-if="error" role="alert" class="text-sm text-red-700 dark:text-red-300">
        <p>{{ error }}</p>
        <Button label="Retry" outlined size="small" class="mt-2" @click="retryCount++" />
      </div>
      <p v-else-if="!datasets.length" role="status" class="text-sm text-gray-600 dark:text-gray-300">
        No datasets match the current selection.
      </p>
      <template v-else>
        <p v-if="groupedByDirectory" class="mb-3 text-sm text-gray-700 dark:text-gray-300">
          This CSV has no dataset IDs. Files are grouped by parent directory.
        </p>
        <ul
          class="max-h-80 overflow-auto divide-y divide-gray-200 rounded-lg bg-white dark:divide-gray-700 dark:bg-gray-900"
        >
          <li v-for="dataset in datasets" :key="dataset.id" class="p-3">
            <div class="mb-1 flex flex-wrap items-start justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span class="min-w-0 flex-1 break-all">{{ dataset.id }}</span>
              <span class="whitespace-nowrap"
                >{{ dataset.fileCount.toLocaleString() }} {{ dataset.fileCount === 1 ? 'file' : 'files' }}</span
              >
            </div>
            <CopyPath :path="dataset.path" kind="directory" />
          </li>
        </ul>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <Button
            :label="copied ? 'Copied' : 'Copy displayed paths'"
            icon="pi pi-copy"
            outlined
            size="small"
            @click="copyPaths"
          />
          <span role="status" class="text-sm text-gray-600 dark:text-gray-300">
            Showing {{ groupedByDirectory ? 'directories' : 'datasets' }}
            {{ (page * PAGE_SIZE + 1).toLocaleString() }}–{{ (page * PAGE_SIZE + datasets.length).toLocaleString() }}
          </span>
          <div v-if="page > 0 || hasMore" class="flex gap-2 sm:ml-auto">
            <Button label="Previous" outlined size="small" :disabled="page === 0" @click="page--" />
            <Button label="Next" outlined size="small" :disabled="!hasMore" @click="page++" />
          </div>
        </div>
        <p v-if="copyError" role="alert" class="mt-2 text-sm text-red-700 dark:text-red-300">{{ copyError }}</p>
      </template>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Button from 'primevue/button';
import CopyPath from './CopyPath.vue';
import {
  fetchDatastorePaths,
  fetchDatasetGrouping,
  groupLocalDatasetPaths,
  type DatasetPath,
  type DatastorePathPage,
} from '../services/datastorePaths';
import type { DatastoreRow, FilterMap } from '../types/datastore';

const props = defineProps<{
  datastoreName: string;
  currentFilters: FilterMap;
  source?: 'builtin' | 'personal';
  /** Already filtered rows for small and personal datastores. Omit for remote searches. */
  rows?: DatastoreRow[];
}>();

const PAGE_SIZE = 25;
const isOpen = ref(false);
const page = ref(0);
const datasets = ref<DatasetPath[]>([]);
const groupedByDirectory = ref(false);
const paths = computed(() => datasets.value.map((dataset) => dataset.path));
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');
const copied = ref(false);
const copyError = ref('');
const retryCount = ref(0);
const filterKey = computed(() => JSON.stringify(props.currentFilters));

const onToggle = (event: Event) => {
  isOpen.value = (event.target as HTMLDetailsElement).open;
};

watch([() => props.datastoreName, filterKey, () => props.rows], () => (page.value = 0), { flush: 'sync' });

watch([isOpen, page, () => props.datastoreName, filterKey, () => props.rows, retryCount], async (_, __, onCleanup) => {
  let active = true;
  onCleanup(() => (active = false));
  if (!isOpen.value) return;

  datasets.value = [];
  error.value = '';
  copied.value = false;
  copyError.value = '';
  loading.value = true;
  const offset = page.value * PAGE_SIZE;

  try {
    let result: DatastorePathPage;
    if (props.rows !== undefined) {
      const rows = props.rows;
      const grouping = props.source === 'personal' ? undefined : await fetchDatasetGrouping(props.datastoreName);
      result = groupLocalDatasetPaths(rows, offset, PAGE_SIZE, grouping);
    } else {
      result = await fetchDatastorePaths(props.datastoreName, JSON.parse(filterKey.value), offset, PAGE_SIZE);
    }
    if (active) {
      datasets.value = result.datasets;
      hasMore.value = result.hasMore;
      groupedByDirectory.value = result.groupedByDirectory ?? false;
    }
  } catch (cause) {
    if (active)
      error.value = cause instanceof Error ? cause.message : 'Unable to load dataset paths. Please try again.';
  } finally {
    if (active) loading.value = false;
  }
});

async function copyPaths() {
  copyError.value = '';
  const text = paths.value.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    if (text === paths.value.join('\n')) copied.value = true;
  } catch {
    copyError.value = 'Could not copy the paths. You can select and copy them directly from the box above.';
  }
}
</script>
