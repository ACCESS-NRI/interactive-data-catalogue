<template>
  <Toast position="top-right" />
  <section class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
    <h6 class="font-semibold mb-4">Filters</h6>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="(options, column) in filterOptions" :key="column">
        <label class="block text-sm font-medium mb-1">{{ formatColumnName(column) }}</label>
        <MultiSelect
          :model-value="modelValue[column]"
          @update:model-value="updateFilter(column, $event)"
          :options="getSortedOptions(options, filterValues[column])"
          :optionDisabled="(option) => isOptionDisabled(column, option)"
          @filter="(event) => handleFilterChange(column, event.value)"
          @show="emit('dropdown-opened', column)"
          @hide="emit('dropdown-closed', column)"
          display="chip"
          class="w-full"
          filter
          showClear
          autoFilterFocus
          appendTo="self"
          placeholder="No filters applied"
          :virtualScrollerOptions="options.length > 100 ? { itemSize: 50 } : undefined"
        />
      </div>
    </div>
    <div class="mt-4">
      <Button label="Clear Filters" icon="pi pi-times" @click="handleClear" size="small" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Button from 'primevue/button';
import MultiSelect from 'primevue/multiselect';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

interface Props {
  filterOptions: Record<string, string[]>;
  modelValue: Record<string, string[]>;
  dynamicFilterOptions: Record<string, string[]>;
  toast: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: Record<string, string[]>): void;
  (e: 'clear'): void;
  (e: 'dropdown-opened', column: string): void;
  (e: 'dropdown-closed', column: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const toast = useToast();
const filterValues = ref<Record<string, string>>({});

const formatColumnName = (c: string) =>
  c
    .split('_')
    .map((w) => {
      const s = w || '';
      return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    })
    .join(' ');

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
  const availableOptions = props.dynamicFilterOptions[column];
  // If no dynamic options exist yet, don't disable anything
  if (!availableOptions) return false;
  // Disable if the option is not in the available list
  return !availableOptions.includes(option);
};

/**
 * Sorts filter options to prioritize matches based on the user's search term.
 * This creates a better UX by showing exact matches first, followed by options that
 * start with the search term, and finally options that contain it anywhere.
 * Without a search term, returns options in their original order.
 * Always uses the full filterOptions list to ensure all options remain visible.
 *
 * @param fallbackOptions - Default options to use if no dynamic options are available
 * @param searchTerm - Optional search term entered by the user in the filter input
 * @returns Sorted array of all options with exact matches first, then starts-with, then contains
 */
const getSortedOptions = (fallbackOptions: string[], searchTerm?: string) => {
  // Always use the full list from filterOptions (fallback), not dynamicFilterOptions
  const options = fallbackOptions;

  if (!searchTerm) {
    return options;
  }

  const lowerSearch = searchTerm.toLowerCase();

  // Sort options: exact match first, then starts with, then contains
  return [...options].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    const aExact = aLower === lowerSearch;
    const bExact = bLower === lowerSearch;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aStarts = aLower.startsWith(lowerSearch);
    const bStarts = bLower.startsWith(lowerSearch);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    return 0;
  });
};

const updateFilter = (column: string, value: string[]) => {
  const updatedFilters = { ...props.modelValue, [column]: value };
  emit('update:modelValue', updatedFilters);
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
