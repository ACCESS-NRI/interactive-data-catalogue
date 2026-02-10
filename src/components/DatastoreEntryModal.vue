<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="fixed inset-0 bg-black bg-opacity-50" @click="close"></div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl mx-4 p-4 z-10">
      <div class="flex justify-between items-start">
        <h6 class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">{{ title }}</h6>
        <button @click="close" class="text-gray-600 dark:text-gray-300 hover:text-gray-900">✕</button>
      </div>

      <div class="mt-3">
        <div class="mb-3">
          <InputText
            v-model="query"
            placeholder="Filter..."
            class="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 text-sm"
          />
        </div>

        <div
          class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700 max-h-64 overflow-y-auto"
        >
          <div v-if="filteredItems.length">
            <div class="flex flex-wrap gap-2">
              <span v-for="(item, i) in filteredItems" :key="i" :class="chipClassComputed" :title="formatItem(item)">
                {{ formatShort(item) }}
              </span>
            </div>
          </div>
          <div v-else class="text-sm text-gray-500">No results</div>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <Button label="Close" icon="pi pi-times" @click="close" class="bg-gray-500 hover:bg-gray-600 text-white" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';

const props = defineProps<{ modelValue: boolean; title?: string; items?: any }>();
const emit = defineEmits(['update:modelValue']);

//  When we close the modal, we also want to clear the search query to reset the
//  state for next time it's opened
const close = () => {
  query.value = '';
  emit('update:modelValue', false);
};

const formatItem = (item: any) => {
  if (item === null || item === undefined) return '-';
  if (typeof item === 'string') return item;
  try {
    return JSON.stringify(item, null, 2);
  } catch {
    return String(item);
  }
};

// Search/filter state
const query = ref('');

const itemsArray = computed(() => (Array.isArray(props.items) ? props.items : props.items ? [props.items] : []));

const filteredItems = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return itemsArray.value;
  return itemsArray.value.filter((it: any) => formatItem(it).toLowerCase().includes(q));
});

// Chip styling similar to TagList.vue
const defaultChip =
  'px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded text-sm font-medium';

const chipClassComputed = defaultChip;

const formatShort = (item: any) => {
  const full = formatItem(item);
  if (full.length <= 40) return full;
  return full.substring(0, 37) + '...';
};
</script>

<style scoped></style>
