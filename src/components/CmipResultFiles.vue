<template>
  <div>
    <p v-if="loading" role="status" class="text-sm text-gray-600 dark:text-gray-300">Looking up file paths on NCI…</p>
    <div v-else-if="error" role="alert" class="text-sm text-red-700 dark:text-red-300">
      <p>{{ error }}</p>
      <button type="button" class="mt-2 font-semibold underline" @click="retry++">Retry file paths</button>
    </div>
    <p v-else-if="!paths.length" role="status" class="text-sm text-gray-600 dark:text-gray-300">
      No file paths were found for this dataset. The catalogue may have changed; refresh the search and try again.
    </p>
    <template v-else>
      <p class="mb-3 text-sm text-gray-600 dark:text-gray-300">Individual file paths matching your search filters.</p>
      <ul
        aria-label="File paths for this dataset"
        class="max-h-96 overflow-auto rounded-lg border border-gray-200 bg-white p-3 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >
        <li v-for="path in paths" :key="path" class="break-all py-1.5">
          {{ path }}
        </li>
      </ul>
      <nav v-if="page > 0 || hasMore" aria-label="File path pages" class="mt-3 flex items-center gap-3 text-sm">
        <button
          type="button"
          class="rounded border px-3 py-1 disabled:opacity-40"
          :disabled="page === 0"
          @click="page--"
        >
          Previous files
        </button>
        <span>Page {{ page + 1 }}</span>
        <button type="button" class="rounded border px-3 py-1 disabled:opacity-40" :disabled="!hasMore" @click="page++">
          Next files
        </button>
      </nav>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { CmipDatasetSearch } from '../services/cmipDatasets';

const props = defineProps<{ search: CmipDatasetSearch; datasetKey: string }>();
const paths = ref<string[]>([]);
const page = ref(0);
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');
const retry = ref(0);
const pageSize = 10;
watch(
  [() => props.search, () => props.datasetKey],
  () => {
    page.value = 0;
  },
  { deep: true, flush: 'sync' },
);
watch(
  [() => props.search, () => props.datasetKey, page, retry],
  async (_, __, onCleanup) => {
    let active = true;
    onCleanup(() => {
      active = false;
    });
    paths.value = [];
    error.value = '';
    hasMore.value = false;
    loading.value = true;
    try {
      const result = await props.search.files(props.datasetKey, page.value * pageSize, pageSize);
      if (active) {
        paths.value = result.paths;
        hasMore.value = result.hasMore;
      }
    } catch (cause) {
      if (active) error.value = cause instanceof Error ? cause.message : 'Unable to look up file paths.';
    } finally {
      if (active) loading.value = false;
    }
  },
  { immediate: true, deep: true },
);
</script>
