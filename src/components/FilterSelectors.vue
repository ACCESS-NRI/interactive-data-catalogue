<template>
  <section class="bg-white rounded-lg shadow p-6 mb-6">
    <h6 class="font-semibold mb-4">Filters</h6>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="(options, column) in filterOptions" :key="column">
        <label class="block text-sm font-medium mb-1">{{ formatColumnName(column) }}</label>
        <MultiSelect
          :model-value="modelValue[column]"
          @update:model-value="updateFilter(column, $event)"
          :options="props.dynamicFilterOptions[column] || options"
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
import Button from 'primevue/button';
import MultiSelect from 'primevue/multiselect';

interface Props {
  filterOptions: Record<string, string[]>;
  modelValue: Record<string, string[]>;
  dynamicFilterOptions: Record<string, string[]>;
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

const updateFilter = (column: string, value: string[]) => {
  const updatedFilters = { ...props.modelValue, [column]: value };
  emit('update:modelValue', updatedFilters);
};

const handleClear = () => {
  emit('clear');
};
</script>
