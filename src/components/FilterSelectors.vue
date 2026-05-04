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
          filterMatchMode="passthrough"
          @filter="(event) => handleFilterChange(column, event.value)"
          @show="handleDropdownShow(column)"
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
import { useFuzzyFilter } from '../composables/useFuzzyFilter';
import { usePostHog } from '../composables/usePosthog';
import type { FilterMap, FilterOptions } from '../types/datastore';

interface Props {
  filterOptions: FilterOptions;
  modelValue: FilterMap;
  dynamicFilterOptions: FilterOptions;
  toast?: boolean;
  analyticsContext?: 'catalogue' | 'datastore';
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
});
const emit = defineEmits<Emits>();

const { getSortedOptions } = useFuzzyFilter();
const toast = useToast();
const { capture } = usePostHog();
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
