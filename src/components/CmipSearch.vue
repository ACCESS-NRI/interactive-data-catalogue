<template>
  <main class="mx-auto w-full p-2 text-gray-900 dark:text-gray-100 md:max-w-[calc(100vw-4rem)] md:p-8">
    <nav
      aria-label="breadcrumb"
      class="mb-8 min-h-10 pl-[104px] pt-3 text-sm min-[375px]:pl-[136px] md:pl-[144px] lg:pl-[184px]"
    >
      <RouterLink to="/" class="text-blue-700 hover:underline dark:text-blue-300">Catalogue</RouterLink>
      <span aria-hidden="true" class="mx-2 text-gray-400">/</span>
      <span aria-current="page">CMIP</span>
    </nav>
    <header class="mb-6">
      <h1 class="text-3xl font-bold">CMIP data</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-300">Search data held at NCI and international data on ESGF.</p>
    </header>

    <section
      aria-labelledby="search-scope-heading"
      class="mb-6 rounded-xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-800 dark:bg-blue-950/30"
    >
      <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 id="search-scope-heading" class="text-lg font-semibold">Search scope</h2>
        <fieldset class="flex items-center gap-3 text-sm font-semibold">
          <legend class="sr-only">CMIP era</legend>
          <span aria-hidden="true">CMIP era</span>
          <div class="inline-flex rounded-lg border border-blue-200 bg-white p-1 dark:border-blue-800 dark:bg-gray-800">
            <label v-for="era in eras" :key="era" class="cursor-pointer">
              <input
                type="radio"
                name="cmip-era"
                :value="era"
                :aria-label="era"
                :checked="project === era"
                class="peer sr-only"
                @change="setProject(era)"
              />
              <span
                class="block rounded-md px-4 py-2 text-gray-600 peer-checked:bg-blue-600 peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 dark:text-gray-300"
                >{{ era }}</span
              >
            </label>
          </div>
        </fieldset>
      </div>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
        Start with all ESGF data, or narrow your search with either switch. Changing era resets the filters.
      </p>
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <label
          v-for="scope in scopes"
          :key="scope.key"
          class="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-600 dark:bg-gray-800"
        >
          <span>
            <span class="block font-semibold">{{ scope.label }}</span>
            <span :id="`${scope.key}-help`" class="mt-1 block text-sm text-gray-600 dark:text-gray-300">{{
              scope.description
            }}</span>
          </span>
          <span class="relative inline-flex shrink-0">
            <input
              type="checkbox"
              role="switch"
              :checked="scope.key === 'nci' ? nciOnly : accessOnly"
              :aria-label="scope.label"
              :aria-describedby="`${scope.key}-help`"
              class="peer sr-only"
              @change="setScope(scope.key, ($event.target as HTMLInputElement).checked)"
            />
            <span
              aria-hidden="true"
              class="h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-2 dark:bg-gray-600"
            ></span>
            <span
              aria-hidden="true"
              class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
            ></span>
          </span>
        </label>
      </div>
      <p aria-live="polite" class="mt-4 text-sm font-medium text-blue-900 dark:text-blue-200">
        {{
          nciOnly
            ? accessOnly
              ? `Searching ${project} ACCESS data held at NCI`
              : `Searching all ${project} data held at NCI`
            : accessOnly
              ? `Searching ${project} ACCESS data across ESGF`
              : `Searching all ${project} data across ESGF`
        }}
      </p>
    </section>

    <div
      v-if="optionsLoading || optionsError"
      class="mb-4 text-sm text-gray-600 dark:text-gray-300"
      :role="optionsError ? 'alert' : 'status'"
    >
      <template v-if="optionsLoading">Loading {{ nciOnly ? 'NCI' : 'ESGF' }} filter options…</template>
      <template v-else
        >{{ optionsError }}
        <button type="button" class="ml-2 text-blue-700 underline dark:text-blue-300" @click="retryOptions">
          Retry filter options
        </button></template
      >
    </div>
    <FilterSelectors
      :key="project"
      v-model="currentFilters"
      compact
      :filter-options="filterOptions"
      :dynamic-filter-options="{}"
      :default-visible-columns="defaultColumns"
      analytics-context="datastore"
      @clear="currentFilters = {}"
    />

    <p
      v-if="accessOnly && !optionsLoading && !optionsError && !effectiveFilters"
      role="status"
      class="rounded-xl bg-white p-5 dark:bg-gray-800"
    >
      No ACCESS models match the selected filters. Remove the model filter or switch off Only ACCESS data.
    </p>
    <template v-else-if="effectiveFilters && (!accessOnly || (!optionsLoading && !optionsError))">
      <CmipAccessCode :project="project" :filters="effectiveFilters" :nci-only="nciOnly" />
      <section
        v-if="nciOnly"
        aria-label="NCI results"
        class="rounded-xl border border-sky-200 border-t-4 border-t-sky-600 bg-sky-50/50 p-4 dark:border-sky-800 dark:bg-sky-950/20"
      >
        <h2 class="text-lg font-bold text-sky-950 dark:text-sky-100">
          <i class="pi pi-database mr-2" aria-hidden="true"></i>NCI · Local files on Gadi
        </h2>
        <p class="mb-4 mt-1 text-sm text-sky-800 dark:text-sky-200">
          Searches Australian submissions and ESGF replicas held at NCI. Open a collection for file paths and access
          code.
        </p>
        <CmipNciResults :project="project" :filters="effectiveFilters" />
      </section>
      <CmipEsgfSearch v-else standalone :model-value="true" :project="project" :filters="effectiveFilters" />
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import FilterSelectors from './FilterSelectors.vue';
import CmipEsgfSearch from './CmipEsgfSearch.vue';
import CmipNciResults from './CmipNciResults.vue';
import CmipAccessCode from './CmipAccessCode.vue';
import { useEsgfFilterOptions } from '../composables/useEsgfFilterOptions';
import { buildFilterQuery, parseFiltersFromQuery } from '../composables/useFilterUrlSync';
import { getDefaultVisibleFilterColumns } from '../services/datastoreFilterDefaults';
import { accessFilters, fetchCmipNciOptions } from '../services/cmipSearch';
import type { FilterMap, FilterOptions } from '../types/datastore';
import type { CmipProject } from '../services/cmipEsmvalcoreCode';

const route = useRoute();
const router = useRouter();
const eras = ['CMIP6', 'CMIP7'] as const;
const project = computed<CmipProject>(() => (route.query.project === 'CMIP6' ? 'CMIP6' : 'CMIP7'));
function setProject(value: CmipProject) {
  if (value === project.value) return;
  // Facet names and model IDs differ between versions. Keep scopes, reset selections.
  const query = Object.fromEntries(Object.entries(route.query).filter(([key]) => !key.endsWith('_filter')));
  router.replace({ query: { ...query, project: value } });
}
const nciOnly = computed(() => route.query.nci === 'true');
const accessOnly = computed(() => route.query.access === 'true');
const scopes = [
  { key: 'nci', label: 'Only data at NCI', description: 'Files held locally on Gadi' },
  { key: 'access', label: 'Only ACCESS data', description: 'Data from ACCESS models' },
] as const;
function setScope(key: 'nci' | 'access', enabled: boolean) {
  router.replace({ query: { ...route.query, [key]: enabled ? 'true' : undefined } });
}
const currentFilters = computed<FilterMap>({
  get: () => parseFiltersFromQuery(route.query),
  set: (filters) => {
    const scopeQuery = Object.fromEntries(Object.entries(route.query).filter(([key]) => !key.endsWith('_filter')));
    router.replace({ query: { ...scopeQuery, ...buildFilterQuery(filters) } });
  },
});
const esgf = useEsgfFilterOptions(computed(() => (nciOnly.value ? null : project.value)));
const nciOptions = ref<Partial<Record<CmipProject, FilterOptions>>>({});
const nciLoading = ref(false);
const nciError = ref('');
let nciController: AbortController | undefined;
async function loadNciOptions() {
  nciController?.abort();
  const request = new AbortController();
  nciController = request;
  nciLoading.value = false;
  nciError.value = '';
  const requestProject = project.value;
  if (!nciOnly.value || nciOptions.value[requestProject]) return;
  nciLoading.value = true;
  try {
    const options = await fetchCmipNciOptions(requestProject, request.signal);
    if (!request.signal.aborted) nciOptions.value[requestProject] = options;
  } catch (cause) {
    if (!request.signal.aborted)
      nciError.value = cause instanceof Error ? cause.message : 'NCI filter options are unavailable.';
  } finally {
    if (!request.signal.aborted) nciLoading.value = false;
  }
}
watch([nciOnly, project], loadNciOptions, { immediate: true });
onBeforeUnmount(() => nciController?.abort());
const optionsLoading = computed(() => (nciOnly.value ? nciLoading.value : esgf.loading.value));
const optionsError = computed(() => (nciOnly.value ? nciError.value : esgf.error.value));
const options = computed(() => (nciOnly.value ? (nciOptions.value[project.value] ?? {}) : esgf.options.value));
const retryOptions = () => (nciOnly.value ? loadNciOptions() : esgf.retry());
const defaultColumns = computed(() =>
  project.value === 'CMIP7'
    ? getDefaultVisibleFilterColumns('cmip7_replicated')
    : ['frequency', 'variable_id', 'table_id', 'source_id', 'experiment_id', 'member_id'],
);
const filterOptions = computed(() => {
  // Keep selected fields visible across scope changes so users can always clear them.
  const fields = new Set([
    ...defaultColumns.value,
    ...Object.keys(options.value),
    ...Object.keys(currentFilters.value),
  ]);
  return Object.fromEntries(
    [...fields].map((field) => [
      field,
      field === 'source_id' && accessOnly.value
        ? (accessFilters({}, options.value)?.source_id ?? [])
        : (options.value[field] ?? []),
    ]),
  );
});
const effectiveFilters = computed(() =>
  accessOnly.value ? accessFilters(currentFilters.value, options.value) : currentFilters.value,
);
</script>
