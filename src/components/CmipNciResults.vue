<template>
  <div class="overflow-hidden rounded-xl border border-sky-200 bg-white dark:border-sky-800 dark:bg-gray-800">
    <div class="bg-sky-50 px-4 py-3 dark:bg-sky-950/30">
      <p role="status" class="font-semibold text-sky-950 dark:text-sky-100">
        {{
          loading
            ? 'Grouping NCI datasets…'
            : error
              ? 'NCI search could not finish'
              : `${total.toLocaleString()} matching ${total === 1 ? 'dataset' : 'datasets'}`
        }}
      </p>
    </div>
    <div v-if="error" role="alert" class="p-4 text-sm text-amber-900 dark:text-amber-200">
      {{ error }} Dataset counts require all selected NCI sources to finish successfully.
      <button type="button" class="ml-2 underline" @click="load">Retry NCI search</button>
    </div>
    <div v-if="datasets.length" class="overflow-x-auto">
      <table class="w-full min-w-[50rem] text-left text-sm">
        <caption class="sr-only">
          {{
            project
          }}
          dataset search results on NCI
        </caption>
        <thead class="text-gray-600 dark:text-gray-300">
          <tr>
            <th scope="col" class="p-3">Dataset / version</th>
            <th scope="col" class="p-3">Matching files</th>
            <th scope="col" class="p-3">Time coverage</th>
            <th scope="col" class="p-3">File access</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(dataset, index) in datasets" :key="dataset.key">
            <tr
              class="border-t border-gray-200 align-top dark:border-gray-700"
              :class="expanded === dataset.key ? 'bg-sky-50 dark:bg-sky-950/30' : ''"
            >
              <td class="min-w-80 max-w-xl p-3">
                <p class="font-semibold">{{ title(dataset) }}</p>
                <CopyPath
                  v-for="directory in dataset.directories"
                  :key="directory"
                  class="mt-2"
                  :path="directory"
                  kind="directory"
                  compact
                />
                <div class="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <span class="rounded bg-sky-100 px-2 py-1 dark:bg-sky-900">{{ versionLabel(dataset) }}</span>
                  <span v-if="dataset.facets.member_id || dataset.facets.variant_label" class="py-1">{{
                    dataset.facets.member_id ?? dataset.facets.variant_label
                  }}</span>
                  <span v-if="dataset.facets.grid_label" class="py-1">Grid: {{ dataset.facets.grid_label }}</span>
                  <span v-if="dataset.facets.table_id" class="py-1">Table: {{ dataset.facets.table_id }}</span>
                  <span v-if="dataset.facets.frequency" class="py-1">{{ dataset.facets.frequency }}</span>
                </div>
              </td>
              <td class="p-3 whitespace-nowrap">
                {{ dataset.fileCount.toLocaleString() }} {{ dataset.fileCount === 1 ? 'file' : 'files' }}
              </td>
              <td class="p-3 text-xs">{{ dataset.timeRange ?? 'Not supplied / fixed field' }}</td>
              <td class="p-3">
                <button
                  type="button"
                  :aria-expanded="expanded === dataset.key"
                  :aria-controls="`${id}-${index}`"
                  class="whitespace-nowrap rounded-lg border border-blue-300 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950"
                  @click="expanded = expanded === dataset.key ? null : dataset.key"
                >
                  <i
                    class="pi mr-1"
                    :class="expanded === dataset.key ? 'pi-chevron-up' : 'pi-folder-open'"
                    aria-hidden="true"
                  ></i
                  >{{ expanded === dataset.key ? 'Hide files' : 'View files' }}
                </button>
              </td>
            </tr>
            <tr
              v-if="expanded === dataset.key"
              :id="`${id}-${index}`"
              class="border-t border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20"
            >
              <td colspan="4" class="p-4">
                <section aria-label="Files for this dataset" class="min-w-0">
                  <h3 class="mb-3 font-semibold">Files for {{ title(dataset) }} · {{ versionLabel(dataset) }}</h3>
                  <CmipPathDownload
                    v-if="search"
                    class="mb-4"
                    :search="search"
                    :dataset-key="dataset.key"
                    :filename="`${project.toLowerCase()}-nci-dataset-paths.txt`"
                    :large="dataset.fileCount > 100000"
                    allow-copy
                  />
                  <CmipResultFiles v-if="search" :search="search" :dataset-key="dataset.key" />
                  <details class="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    <summary class="w-fit cursor-pointer">Source details</summary>
                    <ul class="mt-2 space-y-1">
                      <li v-for="name in dataset.collections" :key="name">
                        <code>{{ name }}</code> ·
                        <RouterLink :to="collectionLink(name)" class="text-blue-700 underline dark:text-blue-300"
                          >Collection details (optional)</RouterLink
                        >
                      </li>
                    </ul>
                  </details>
                </section>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-else-if="!loading && !error" role="status" class="p-4 text-sm text-gray-600 dark:text-gray-300">
      <p>No datasets in the NCI catalogue match these filters.</p>
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
    <details class="border-t border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
      <summary class="w-fit cursor-pointer">Search source details</summary>
      <p class="mt-2">
        Datasets are grouped across the selected sources before pagination. File counts and time coverage describe the
        files matching your filters; coverage does not guarantee a complete time series.
      </p>
      <p class="mt-1">
        Paths are matched by dataset identity, version date and filename. Undated latest paths form separate datasets
        because their target version is not supplied. Unrecognised layouts remain separate with an unverified version.
      </p>
      <ul class="mt-2 space-y-1">
        <li v-for="collection in collections" :key="collection.name" :aria-label="`${collection.label} at NCI`">
          <RouterLink :to="collectionLink(collection.name)" class="text-blue-700 underline dark:text-blue-300"
            >{{ collection.label }} · {{ collection.name }}</RouterLink
          >
        </li>
      </ul>
    </details>
    <nav
      v-if="total > pageSize || page > 0"
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
      <span>Page {{ page + 1 }} of {{ Math.max(1, Math.ceil(total / pageSize)).toLocaleString() }}</span>
      <button
        type="button"
        class="rounded border px-3 py-1 disabled:opacity-40"
        :disabled="loading || !!error || (page + 1) * pageSize >= total"
        @click="page++"
      >
        Next
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useId, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { buildFilterQuery } from '../composables/useFilterUrlSync';
import { cmipNciCollections } from '../services/cmipSearch';
import {
  createCmipDatasetSearch,
  type CmipDatasetSearch,
  type CmipNciDataset,
  type CmipPathExportState,
} from '../services/cmipDatasets';
import CopyPath from './CopyPath.vue';
import CmipResultFiles from './CmipResultFiles.vue';
import CmipPathDownload from './CmipPathDownload.vue';
import type { FilterMap } from '../types/datastore';
import type { CmipProject } from '../services/cmipEsmvalcoreCode';

const props = defineProps<{ project: CmipProject; filters: FilterMap; accessOnly?: boolean }>();
const emit = defineEmits<{ 'search-esgf': []; 'export-state': [state: CmipPathExportState] }>();
const id = useId();
const expanded = ref<string | null>(null);
const collections = computed(() => cmipNciCollections(props.project, props.accessOnly));
const datasets = ref<CmipNciDataset[]>([]);
const search = shallowRef<CmipDatasetSearch>();
const page = ref(0);
const pageSize = 20;
const total = ref(0);
const loading = ref(false);
const error = ref('');
watch(
  [search, total, loading, error],
  () => {
    emit('export-state', { search: search.value, total: total.value, loading: loading.value, error: error.value });
  },
  { immediate: true, flush: 'sync' },
);
let controller: AbortController | undefined;
let pageRequest = 0;
const title = (dataset: CmipNciDataset) =>
  dataset.version
    ? `${dataset.facets.source_id} · ${dataset.facets.experiment_id} · ${dataset.facets.branded_variable ?? dataset.facets.variable_id}`
    : 'File with an unrecognised dataset layout';
const versionLabel = (dataset: CmipNciDataset) =>
  dataset.version === 'latest' ? 'Latest · version unverified' : (dataset.version ?? 'Version unverified');
const collectionLink = (name: string) => ({
  name: 'DatastoreDetail',
  params: { name },
  query: buildFilterQuery(props.filters),
});

async function loadPage() {
  if (!search.value) return;
  const request = ++pageRequest;
  expanded.value = null;
  datasets.value = [];
  loading.value = true;
  error.value = '';
  try {
    const result = await search.value.page(page.value * pageSize, pageSize);
    if (request !== pageRequest) return;
    datasets.value = result.datasets;
    total.value = result.total;
  } catch (cause) {
    if (request === pageRequest) error.value = cause instanceof Error ? cause.message : 'NCI search is unavailable.';
  } finally {
    if (request === pageRequest) loading.value = false;
  }
}
async function load() {
  controller?.abort();
  pageRequest++;
  search.value = undefined;
  const current = new AbortController();
  controller = current;
  page.value = 0;
  expanded.value = null;
  datasets.value = [];
  total.value = 0;
  loading.value = true;
  error.value = '';
  try {
    const result = await (props.accessOnly
      ? createCmipDatasetSearch(props.project, props.filters, current.signal, true)
      : createCmipDatasetSearch(props.project, props.filters, current.signal));
    if (current.signal.aborted) {
      await result.dispose();
      return;
    }
    search.value = result;
    await loadPage();
  } catch (cause) {
    if (!current.signal.aborted) {
      error.value = cause instanceof Error ? cause.message : 'NCI search is unavailable.';
      loading.value = false;
    }
  }
}
watch([() => props.project, () => props.filters, () => props.accessOnly], load, { immediate: true, deep: true });
watch(page, loadPage, { flush: 'sync' });
onBeforeUnmount(() => {
  pageRequest++;
  controller?.abort();
  emit('export-state', { total: 0, loading: true, error: '' });
});
</script>
