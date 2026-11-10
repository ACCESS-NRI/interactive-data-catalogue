<template>
  <Toast position="top-right" />
  <section class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
    <div class="flex flex-wrap items-center gap-3" :class="compact ? 'mb-4' : ''">
      <h6 class="font-semibold" :class="compact ? '' : 'mb-4'">Filters</h6>
      <Button
        v-if="compact && displayedColumns.length > 0"
        label="Clear all"
        icon="pi pi-times"
        size="small"
        text
        @click="handleClear"
      />
      <div v-if="$slots.actions" class="ml-auto"><slot name="actions" /></div>
    </div>

    <p v-if="esgfProject" role="status" class="mb-4 text-xs text-gray-600 dark:text-gray-300">
      <template v-if="esgfOptionsLoading">Loading ESGF filter options…</template>
      <template v-else-if="esgfOptionsError">
        ESGF filter options could not be loaded. NCI options remain available.
        <button type="button" class="ml-1 text-blue-700 underline dark:text-blue-300" @click="retryEsgfOptions">
          Retry ESGF filter options
        </button>
      </template>
      <template v-else>
        Dropdowns include ESGF values across {{ esgfProject }}. Values absent from this NCI collection are labelled
        ESGF.
      </template>
    </p>

    <Popover
      v-if="compact"
      :id="addFilterPopoverId"
      ref="addFilterPopover"
      aria-label="Add a filter"
      @show="addFilterPickerOpen = true"
      @hide="addFilterPickerOpen = false"
    >
      <div class="w-64 max-w-[calc(100vw-4rem)]">
        <label for="filter-column-search" class="mb-2 block text-sm font-medium">Find a filter</label>
        <InputText
          id="filter-column-search"
          v-model="columnSearch"
          placeholder="Search fields..."
          class="mb-2 w-full"
          autofocus
        />
        <div class="max-h-64 overflow-y-auto" aria-label="Available filters">
          <button
            v-for="column in matchingColumns"
            :key="column"
            type="button"
            class="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-800 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-gray-100 dark:hover:bg-gray-700"
            @click="addFilter(column)"
          >
            {{ formatColumnName(column) }}
          </button>
          <p v-if="matchingColumns.length === 0" class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
            No matching filters
          </p>
        </div>
      </div>
    </Popover>

    <div
      v-if="!compact || displayedColumns.length > 0 || availableColumns.length > 0"
      :class="compact ? 'flex flex-wrap gap-3' : 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'"
    >
      <div
        v-for="column in displayedColumns"
        :key="column"
        :class="
          compact
            ? 'w-full rounded-xl border border-gray-200 bg-gray-50 p-3 sm:w-64 dark:border-gray-600 dark:bg-gray-700'
            : ''
        "
      >
        <div class="mb-1 flex items-center justify-between gap-2">
          <div class="flex items-center gap-1">
            <label :for="`filter-${column}`" class="block text-sm font-medium">{{ formatColumnName(column) }}</label>
            <VariableFilterHelp
              v-if="['variable', 'variable_id', 'variable_name', 'branded_variable'].includes(column)"
              :field-label="formatColumnName(column)"
              :branded="column === 'branded_variable'"
            />
          </div>
          <button
            v-if="compact"
            type="button"
            :aria-label="`Remove ${formatColumnName(column)} filter`"
            class="rounded-full p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white"
            @click="removeFilter(column)"
          >
            <i class="pi pi-times text-xs" aria-hidden="true"></i>
          </button>
        </div>
        <MultiSelect
          :input-id="`filter-${column}`"
          :model-value="modelValue[column]"
          @update:model-value="updateFilter(column, $event)"
          :options="getSortedOptions(displayOptions(column), filterValues[column], availableOptions(column))"
          :optionDisabled="(option) => isOptionDisabled(column, option)"
          filterMatchMode="passthrough"
          @filter="(event) => handleFilterChange(column, event.value)"
          @show="handleDropdownShow(column)"
          @hide="emit('dropdown-closed', column)"
          :display="compact ? 'comma' : 'chip'"
          :maxSelectedLabels="compact ? 1 : undefined"
          :selectedItemsLabel="compact ? '{0} selected' : undefined"
          class="w-full"
          filter
          showClear
          :loading="optionsPending"
          autoFilterFocus
          appendTo="self"
          :placeholder="compact ? 'Choose values' : 'No filters applied'"
          :virtualScrollerOptions="(combinedOptions[column]?.length ?? 0) > 100 ? { itemSize: 50 } : undefined"
        >
          <template #option="{ option }">
            <span>{{ option }}</span>
            <span
              v-if="hideUnavailableOptions && !optionsPending && !dynamicFilterOptions[column]?.includes(option)"
              class="ml-2 text-xs text-amber-700 dark:text-amber-300"
              >No match with other filters</span
            >
            <span
              v-if="esgfOptionSets[column]?.has(option) && !filterOptions[column]?.includes(option)"
              class="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900 dark:text-violet-200"
              >ESGF</span
            >
          </template>
        </MultiSelect>
      </div>
      <button
        v-if="compact && availableColumns.length > 0"
        type="button"
        aria-haspopup="dialog"
        :aria-controls="addFilterPopoverId"
        :aria-expanded="addFilterPickerOpen"
        class="flex min-h-24 w-full flex-col items-start justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-3 text-left text-blue-700 transition-colors hover:border-blue-500 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:w-64 dark:border-blue-500 dark:bg-blue-950/20 dark:text-blue-200 dark:hover:border-blue-300 dark:hover:bg-blue-950/40"
        @click="addFilterPopover?.toggle($event)"
      >
        <span class="flex items-center gap-2 text-sm font-medium">
          <i class="pi pi-plus" aria-hidden="true"></i>
          Add another filter here
        </span>
        <span class="text-xs text-gray-600 dark:text-gray-300">Choose a field to narrow the results</span>
      </button>
    </div>
    <p v-if="compact && displayedColumns.length === 0" class="mt-3 text-sm text-gray-500 dark:text-gray-400">
      {{ availableColumns.length > 0 ? 'Add a filter to narrow this datastore.' : 'No filters available.' }}
    </p>
    <div v-if="!compact" class="mt-4">
      <Button label="Clear Filters" icon="pi pi-times" @click="handleClear" size="small" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, toRef, useId, watch } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';
import Popover from 'primevue/popover';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import VariableFilterHelp from './VariableFilterHelp.vue';
import { useFuzzyFilter } from '../composables/useFuzzyFilter';
import { useEsgfFilterOptions } from '../composables/useEsgfFilterOptions';
import type { CmipProject } from '../services/cmipEsmvalcoreCode';
import { usePostHog } from '../composables/usePosthog';
import type { FilterMap, FilterOptions } from '../types/datastore';

interface Props {
  filterOptions: FilterOptions;
  modelValue: FilterMap;
  dynamicFilterOptions: FilterOptions;
  toast?: boolean;
  analyticsContext?: 'catalogue' | 'datastore';
  compact?: boolean;
  defaultVisibleColumns?: string[];
  esgfProject?: CmipProject | null;
  hideUnavailableOptions?: boolean;
  optionsPending?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: FilterMap): void;
  (e: 'update:model-value', value: FilterMap): void;
  (e: 'clear'): void;
  (e: 'dropdown-opened', column: string): void;
  (e: 'dropdown-closed', column: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  toast: false,
  compact: false,
  defaultVisibleColumns: () => [],
  esgfProject: null,
  hideUnavailableOptions: false,
  optionsPending: false,
});
const emit = defineEmits<Emits>();

const { getSortedOptions } = useFuzzyFilter();
const toast = useToast();
const { capture } = usePostHog();
const filterValues = ref<Record<string, string>>({});
const {
  options: esgfOptions,
  loading: esgfOptionsLoading,
  error: esgfOptionsError,
  retry: retryEsgfOptions,
} = useEsgfFilterOptions(toRef(props, 'esgfProject'));
// Some facets (for example CMIP6 members) have thousands of values.
const esgfOptionSets = computed(() =>
  Object.fromEntries(Object.entries(esgfOptions.value).map(([column, values]) => [column, new Set(values)])),
);
const combinedOptions = computed(() =>
  Object.fromEntries(
    Object.entries(props.filterOptions).map(([column, values]) => [
      column,
      [...new Set([...values, ...(esgfOptions.value[column] ?? []), ...(props.modelValue[column] ?? [])])],
    ]),
  ),
);
const availableOptions = (column: string) => {
  const local = props.dynamicFilterOptions[column];
  return local ? [...new Set([...local, ...(esgfOptions.value[column] ?? [])])] : undefined;
};
// Dependent CMIP facets show compatible choices plus selected values, which
// must remain visible and removable even after a scope change or an empty search.
const displayOptions = (column: string) => {
  const all = combinedOptions.value[column] ?? [];
  if (!props.hideUnavailableOptions) return all;
  const allowed = new Set(availableOptions(column) ?? []);
  return all.filter((value) => allowed.has(value) || props.modelValue[column]?.includes(value));
};
const visibleColumns = ref<string[]>([]);
const columnSearch = ref('');
const addFilterPopover = ref();
const addFilterPopoverId = useId();
const addFilterPickerOpen = ref(false);

const formatColumnName = (c: string) =>
  c
    .split('_')
    .map((w) => {
      const s = w || '';
      return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    })
    .join(' ');

const allColumns = computed(() =>
  Object.keys(props.filterOptions).sort((a, b) => formatColumnName(a).localeCompare(formatColumnName(b))),
);
const availableColumns = computed(() => allColumns.value.filter((column) => !visibleColumns.value.includes(column)));
const matchingColumns = computed(() =>
  availableColumns.value.filter((column) =>
    formatColumnName(column).toLowerCase().includes(columnSearch.value.toLowerCase()),
  ),
);
const displayedColumns = computed(() =>
  props.compact
    ? visibleColumns.value.filter((column) => column in props.filterOptions)
    : Object.keys(props.filterOptions),
);

// Presets choose which controls are shown, without selecting any values.
watch(
  () => props.defaultVisibleColumns,
  (columns) => {
    const activeColumns = Object.keys(props.modelValue).filter(
      (column) => props.modelValue[column]?.length && column in props.filterOptions,
    );
    visibleColumns.value = [...new Set([...columns, ...activeColumns])];
  },
  { immediate: true },
);

// Restore active filters when opening a bookmarked or shared datastore URL.
watch(
  [() => props.modelValue, () => props.filterOptions],
  ([filters, options]) => {
    const activeColumns = Object.keys(filters).filter((column) => filters[column]?.length && column in options);
    visibleColumns.value = [
      ...new Set([
        ...visibleColumns.value.filter((column) => column in options || props.defaultVisibleColumns.includes(column)),
        ...activeColumns,
      ]),
    ];
  },
  { immediate: true, deep: true },
);

const addFilter = (column: string) => {
  if (!(column in props.filterOptions) || visibleColumns.value.includes(column)) return;
  visibleColumns.value = [...visibleColumns.value, column];
  columnSearch.value = '';
  addFilterPopover.value?.hide();
};

const removeFilter = (column: string) => {
  visibleColumns.value = visibleColumns.value.filter((visibleColumn) => visibleColumn !== column);
  const updatedFilters = { ...props.modelValue };
  delete updatedFilters[column];
  emit('update:modelValue', updatedFilters);
  emit('update:model-value', updatedFilters);
};

/**
 * Handles filter input changes in the MultiSelect dropdown search box.
 * Tracks the current search term for each column so we can dynamically sort
 * the dropdown options to show the most relevant matches first.
 *
 * @param column - The column name being filtered
 * @param value - The search term entered by the user
 */
const handleFilterChange = (column: string, value: string) => {
  filterValues.value[column] = value;
};

const handleDropdownShow = (column: string) => {
  emit('dropdown-opened', column);
  if (props.analyticsContext) {
    capture('filter_dropdown_opened', { context: props.analyticsContext, column });
  }
};

/**
 * Checks if a filter option should be disabled based on current filter selections.
 * An option is disabled if it doesn't appear in the dynamicFilterOptions for that column,
 * meaning no data matches that value given the current filter state.
 *
 * @param column - The column name being checked
 * @param option - The specific option value to check
 * @returns true if the option should be disabled, false otherwise
 */
const isOptionDisabled = (column: string, option: string): boolean => {
  if (esgfOptionSets.value[column]?.has(option) || props.modelValue[column]?.includes(option)) return false;
  const availableOptions = props.dynamicFilterOptions[column];
  // If no dynamic options exist yet, don't disable anything
  if (!availableOptions) return false;
  // Disable if the option is not in the available list
  return !availableOptions.includes(option);
};

const updateFilter = (column: string, value: string[]) => {
  const updatedFilters = { ...props.modelValue, [column]: value };
  emit('update:modelValue', updatedFilters);
  emit('update:model-value', updatedFilters);
  if (props.analyticsContext) {
    capture('filter_applied', { context: props.analyticsContext, column, values: value });
  }
  if (props.toast) {
    toast.add({
      severity: 'info',
      summary: 'Filters Updated',
      detail: 'Quickstart Code updated with current filters',
      life: 2500,
    });
  }
};

const handleClear = () => {
  visibleColumns.value = [];
  emit('clear');
};
</script>

<style>
.p-multiselect-overlay {
  top: 100% !important;
  left: 0 !important;
  transform: none !important;
}
</style>
