<template>
  <section class="bg-white rounded-lg shadow p-6 mb-6">
    <h6 class="font-semibold mb-4">Filters</h6>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="(options, column) in filterOptions" :key="column">
        <label class="block text-sm font-medium mb-1">{{ formatColumnName(column) }}</label>
        <MultiSelect
          :model-value="modelValue[column]"
          @update:model-value="updateFilter(column, $event)"
          :options="dynamicFilterOptions[column] || options"
          display="chip"
          class="w-full"
          filter
          showClear
          placeholder="No filters applied"
        />
      </div>
    </div>
    <div class="mt-4">
      <Button label="Clear Filters" icon="pi pi-times" @click="handleClear" size="small" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Button from 'primevue/button';
import MultiSelect from 'primevue/multiselect';

interface Props {
  filterOptions: Record<string, string[]>;
  modelValue: Record<string, string[]>;
  rawData: Array<Record<string, any>>;
}

interface Emits {
  (e: 'update:modelValue', value: Record<string, string[]>): void;
  (e: 'clear'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const formatColumnName = (c: string) =>
  c
    .split('_')
    .map((w) => {
      const s = w || '';
      return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    })
    .join(' ');

// Compute dynamic filter options based on current filter selections
// This ensures users can't select filter combinations that result in 0 rows
const dynamicFilterOptions = computed(() => {
  const result: Record<string, string[]> = {};

  // For each filter column, compute which options would yield results
  for (const [column, allOptions] of Object.entries(props.filterOptions)) {
    // Start with raw data
    let availableData = props.rawData;

    // Apply all OTHER active filters (not the current column)
    for (const [filterColumn, filterValues] of Object.entries(props.modelValue)) {
      if (filterColumn !== column && filterValues && filterValues.length > 0) {
        availableData = availableData.filter((row: Record<string, any>) => {
          const cellValue = row[filterColumn];
          return filterValues.some((fv) => {
            if (Array.isArray(cellValue))
              return cellValue.some((it: any) => String(it).toLowerCase().includes(fv.toLowerCase()));
            return String(cellValue || '')
              .toLowerCase()
              .includes(fv.toLowerCase());
          });
        });
      }
    }

    // Now find which options from this column exist in the filtered data
    const validOptions = new Set<string>();
    for (const row of availableData) {
      const cellValue = row[column];
      if (Array.isArray(cellValue)) {
        cellValue.forEach((val: any) => validOptions.add(String(val)));
      } else if (cellValue !== null && cellValue !== undefined) {
        validOptions.add(String(cellValue));
      }
    }

    // Filter the original options to only include valid ones
    result[column] = allOptions.filter((option) => validOptions.has(option));
  }

  return result;
});

const updateFilter = (column: string, value: string[]) => {
  const updatedFilters = { ...props.modelValue, [column]: value };
  emit('update:modelValue', updatedFilters);
};

const handleClear = () => {
  emit('clear');
};
</script>
