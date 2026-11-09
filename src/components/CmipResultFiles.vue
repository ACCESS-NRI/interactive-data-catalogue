<template>
  <div>
    <p v-if="loading" role="status" class="text-sm text-gray-600 dark:text-gray-300">Looking up file paths on NCI…</p>
    <div v-else-if="error" role="alert" class="text-sm text-red-700 dark:text-red-300">
      <p>{{ error }}</p>
      <button type="button" class="mt-2 font-semibold underline" @click="retry++">Retry file paths</button>
    </div>
    <p v-else-if="!paths.length" role="status" class="text-sm text-gray-600 dark:text-gray-300">
      No file paths were found for this result. The catalogue may have changed; refresh the search and try again.
    </p>
    <template v-else>
      <p class="mb-3 text-sm text-gray-600 dark:text-gray-300">
        Exact files matching this result and your current filters. Use these paths on Gadi.
      </p>
      <ul aria-label="File paths for this result" class="space-y-4">
        <li
          v-for="path in paths"
          :key="path"
          class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
        >
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">File path</p>
          <CopyPath :path="path" kind="file path" />
          <details v-if="directory(path)" class="mt-3 border-t border-gray-100 pt-2 dark:border-gray-700">
            <summary class="w-fit cursor-pointer text-sm font-medium text-blue-700 dark:text-blue-300">
              Containing directory
            </summary>
            <CopyPath class="mt-2" :path="directory(path)" kind="directory" />
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              This directory may also contain files outside your filters.
            </p>
          </details>
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
import CopyPath from './CopyPath.vue';
import { fetchCmipFilePaths } from '../services/cmipFiles';
import type { DatastoreRow, FilterMap } from '../types/datastore';

const props = defineProps<{ datastoreName: string; filters: FilterMap; record: DatastoreRow }>();
const paths = ref<string[]>([]);
const page = ref(0);
const hasMore = ref(false);
const loading = ref(false);
const error = ref('');
const retry = ref(0);
const pageSize = 10;
const directory = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);
watch(
  [() => props.datastoreName, () => props.filters, () => props.record],
  () => {
    page.value = 0;
  },
  { deep: true, flush: 'sync' },
);
watch(
  [() => props.datastoreName, () => props.filters, () => props.record, page, retry],
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
      const result = await fetchCmipFilePaths(
        props.datastoreName,
        props.filters,
        props.record,
        page.value * pageSize,
        pageSize,
      );
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
