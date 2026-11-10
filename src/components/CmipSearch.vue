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
      <p class="mt-2 text-gray-600 dark:text-gray-300">
        Find CMIP data at NCI or across the international ESGF federation.
      </p>
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
        Choose one place to search. Changing era resets the filters.
      </p>
      <fieldset class="mt-4">
        <legend class="mb-2 text-sm font-semibold">Where to search</legend>
        <div class="grid gap-3 sm:grid-cols-2">
          <label v-for="location in locations" :key="location.nci ? 'nci' : 'esgf'" class="cursor-pointer">
            <input
              type="radio"
              name="cmip-location"
              :value="location.nci ? 'nci' : 'esgf'"
              :checked="nciOnly === location.nci"
              :aria-label="location.label"
              :aria-describedby="`${location.nci ? 'nci' : 'esgf'}-help`"
              class="peer sr-only"
              @change="setLocation(location.nci)"
            />
            <span
              class="flex h-full items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-4 peer-checked:border-blue-600 peer-checked:bg-blue-100 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:peer-checked:border-blue-400 dark:peer-checked:bg-blue-950"
            >
              <span
                aria-hidden="true"
                class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                :class="nciOnly === location.nci ? 'border-blue-600 dark:border-blue-400' : 'border-gray-400'"
              >
                <span
                  v-if="nciOnly === location.nci"
                  class="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-400"
                ></span>
              </span>
              <span>
                <span class="block font-semibold">{{ location.label }}</span>
                <span
                  :id="`${location.nci ? 'nci' : 'esgf'}-help`"
                  class="mt-1 block text-sm text-gray-600 dark:text-gray-300"
                  >{{ location.description }}</span
                >
              </span>
            </span>
          </label>
        </div>
      </fieldset>
      <label
        class="mt-5 flex cursor-pointer items-center gap-4 rounded-lg border-2 p-4 transition-colors"
        :class="
          accessOnly
            ? 'border-teal-600 bg-teal-100 dark:border-teal-400 dark:bg-teal-950'
            : 'border-teal-200 bg-teal-50 hover:border-teal-400 dark:border-teal-800 dark:bg-teal-950/30'
        "
      >
        <input
          type="checkbox"
          :checked="accessOnly"
          aria-label="Only ACCESS data"
          aria-describedby="access-help"
          class="h-6 w-6 shrink-0 rounded border-teal-600 text-teal-700 focus:ring-teal-600"
          @change="setAccessOnly(($event.target as HTMLInputElement).checked)"
        />
        <span class="flex-1">
          <span class="block font-semibold text-teal-950 dark:text-teal-100">Only ACCESS data</span>
          <span id="access-help" class="block text-sm text-gray-600 dark:text-gray-300"
            >Include only ACCESS models in your {{ nciOnly ? 'NCI' : 'ESGF' }} search.</span
          >
        </span>
        <span
          class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-800 dark:bg-gray-800 dark:text-teal-200"
          >{{ accessOnly ? 'ACCESS only' : 'All models' }}</span
        >
      </label>
      <p aria-live="polite" class="mt-4 text-sm font-medium text-blue-900 dark:text-blue-200">
        {{
          nciOnly
            ? accessOnly
              ? `Searching ${project} ACCESS data held at NCI`
              : `Searching ${project} data held at NCI`
            : accessOnly
              ? `Searching ${project} ACCESS data across ESGF`
              : `Searching ${project} data across ESGF`
        }}
      </p>
      <p
        v-if="!nciOnly"
        class="mt-3 rounded-lg border border-blue-200 bg-white p-3 text-sm text-gray-700 dark:border-blue-800 dark:bg-gray-800 dark:text-gray-300"
      >
        ESGF searches the international data federation. Files not already held at NCI need to be downloaded before use.
        Working on Gadi?
        <button
          type="button"
          class="font-semibold text-blue-700 underline dark:text-blue-300"
          @click="setLocation(true)"
        >
          Search on NCI
        </button>
        first to use local files and avoid duplicate downloads.
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
    <p class="mb-3 text-sm text-gray-600 dark:text-gray-300">
      Filter choices update to match your other selections. You can select multiple values within each field.
    </p>
    <div
      v-if="dependent.loading.value || dependent.error.value"
      class="mb-3 text-sm text-gray-600 dark:text-gray-300"
      :role="dependent.error.value ? 'alert' : 'status'"
    >
      <template v-if="dependent.loading.value">Updating related filter choices…</template>
      <template v-else>
        Related filter choices could not be updated. {{ dependent.error.value }}
        <button type="button" class="ml-2 text-blue-700 underline dark:text-blue-300" @click="dependent.retry()">
          Retry related filter choices
        </button>
      </template>
    </div>
    <FilterSelectors
      :key="project"
      v-model="currentFilters"
      compact
      :filter-options="filterOptions"
      :dynamic-filter-options="dynamicFilterOptions"
      hide-unavailable-options
      :options-pending="optionsLoading || !!optionsError || dependent.loading.value || !!dependent.error.value"
      :default-visible-columns="defaultColumns"
      analytics-context="datastore"
      @clear="currentFilters = {}"
    />

    <div
      v-if="accessOnly && !optionsLoading && !optionsError && !effectiveFilters"
      role="status"
      class="rounded-xl bg-white p-5 dark:bg-gray-800"
    >
      <p>
        No ACCESS models match the selected filters in {{ nciOnly ? 'the NCI catalogue' : 'ESGF' }}. Remove the model
        filter or untick Only ACCESS data.
      </p>
      <p v-if="nciOnly" class="mt-2">
        Can't find it on NCI?
        <button
          type="button"
          class="font-semibold text-blue-700 underline dark:text-blue-300"
          @click="setLocation(false)"
        >
          Try searching ESGF
        </button>
      </p>
    </div>
    <template v-else-if="effectiveFilters && (!accessOnly || (!optionsLoading && !optionsError))">
      <div class="mb-3 flex justify-end">
        <button
          type="button"
          class="rounded-lg border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-100"
          @click="showAccessCode"
        >
          Access code for this search <i class="pi pi-arrow-down ml-1" aria-hidden="true"></i>
        </button>
      </div>
      <section
        v-if="nciOnly"
        aria-label="NCI results"
        class="rounded-xl border border-sky-200 border-t-4 border-t-sky-600 bg-sky-50/50 p-4 dark:border-sky-800 dark:bg-sky-950/20"
      >
        <h2 class="text-lg font-bold text-sky-950 dark:text-sky-100">
          <i class="pi pi-database mr-2" aria-hidden="true"></i>NCI · Datasets on Gadi
        </h2>
        <p class="mb-4 mt-1 text-sm text-sky-800 dark:text-sky-200">
          Browse matching datasets on Gadi. Select View files to inspect all matching time chunks and copy their paths.
        </p>
        <CmipNciResults
          :project="project"
          :filters="effectiveFilters"
          :access-only="accessOnly"
          @search-esgf="setLocation(false)"
        />
      </section>
      <CmipEsgfSearch v-else standalone :model-value="true" :project="project" :filters="effectiveFilters" />
      <div
        ref="accessCodePanel"
        tabindex="-1"
        class="mt-6 scroll-mt-6 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      >
        <CmipAccessCode :project="project" :filters="effectiveFilters" :nci-only="nciOnly" :access-only="accessOnly" />
      </div>
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
import { useCmipDependentOptions } from '../composables/useCmipDependentOptions';
import { buildFilterQuery, parseFiltersFromQuery } from '../composables/useFilterUrlSync';
import { getDefaultVisibleFilterColumns } from '../services/datastoreFilterDefaults';
import { accessFilters, fetchCmipNciOptions } from '../services/cmipSearch';
import type { FilterMap, FilterOptions } from '../types/datastore';
import type { CmipProject } from '../services/cmipEsmvalcoreCode';

const route = useRoute();
const router = useRouter();
const accessCodePanel = ref<HTMLElement>();
function showAccessCode() {
  accessCodePanel.value?.focus({ preventScroll: true });
  accessCodePanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const eras = ['CMIP6', 'CMIP7'] as const;
const project = computed<CmipProject>(() => (route.query.project === 'CMIP6' ? 'CMIP6' : 'CMIP7'));
function setProject(value: CmipProject) {
  if (value === project.value) return;
  // Facet names and model IDs differ between versions. Keep scopes, reset selections.
  const query = Object.fromEntries(Object.entries(route.query).filter(([key]) => !key.endsWith('_filter')));
  router.replace({ query: { ...query, project: value } });
}
const nciOnly = computed(() => route.query.nci !== 'false');
const accessOnly = computed(() => route.query.access === 'true');
const locations = [
  { nci: true, label: 'Search on NCI', description: 'Files already on Gadi, ready to use locally' },
  { nci: false, label: 'Search ESGF', description: 'International datasets, including data not held at NCI' },
] as const;
function setLocation(nci: boolean) {
  router.replace({ query: { ...route.query, nci: String(nci) } });
}
function setAccessOnly(enabled: boolean) {
  router.replace({ query: { ...route.query, access: enabled ? 'true' : undefined } });
}
const currentFilters = computed<FilterMap>({
  get: () => parseFiltersFromQuery(route.query),
  set: (filters) => {
    const scopeQuery = Object.fromEntries(Object.entries(route.query).filter(([key]) => !key.endsWith('_filter')));
    router.replace({ query: { ...scopeQuery, ...buildFilterQuery(filters) } });
  },
});
const esgf = useEsgfFilterOptions(computed(() => (nciOnly.value ? null : project.value)));
const nciOptions = ref<Record<string, FilterOptions>>({});
const nciOptionsKey = computed(() => `${project.value}:${accessOnly.value}`);
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
  const key = nciOptionsKey.value;
  if (!nciOnly.value || nciOptions.value[key]) return;
  nciLoading.value = true;
  try {
    const options = await (accessOnly.value
      ? fetchCmipNciOptions(requestProject, request.signal, undefined, true)
      : fetchCmipNciOptions(requestProject, request.signal));
    if (!request.signal.aborted) nciOptions.value[key] = options;
  } catch (cause) {
    if (!request.signal.aborted)
      nciError.value = cause instanceof Error ? cause.message : 'NCI filter options are unavailable.';
  } finally {
    if (!request.signal.aborted) nciLoading.value = false;
  }
}
watch([nciOnly, project, accessOnly], loadNciOptions, { immediate: true });
onBeforeUnmount(() => nciController?.abort());
const optionsLoading = computed(() => (nciOnly.value ? nciLoading.value : esgf.loading.value));
const optionsError = computed(() => (nciOnly.value ? nciError.value : esgf.error.value));
const options = computed(() => (nciOnly.value ? (nciOptions.value[nciOptionsKey.value] ?? {}) : esgf.options.value));
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
const dependent = useCmipDependentOptions(
  computed(() =>
    optionsLoading.value || optionsError.value || !Object.keys(options.value).length
      ? null
      : {
          project: project.value,
          nci: nciOnly.value,
          filters: currentFilters.value,
          accessOnly: accessOnly.value,
          baseOptions: options.value,
        },
  ),
);
const dynamicFilterOptions = computed(() =>
  Object.fromEntries(Object.keys(filterOptions.value).map((field) => [field, dependent.options.value[field] ?? []])),
);
</script>
