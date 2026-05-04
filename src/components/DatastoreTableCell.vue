<template>
  <div class="max-w-sm overflow-x-scroll">
    <div v-if="field === 'variable' && Array.isArray(value)">
      <div class="flex flex-wrap gap-1">
        <span
          v-for="variable in value.slice(0, 3)"
          :key="String(variable)"
          class="px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded text-sm font-medium"
        >
          {{ variable }}
        </span>
        <span
          v-if="value.length > 3"
          @click.prevent.stop="openModal(header, value)"
          role="button"
          tabindex="0"
          class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs cursor-pointer hover:bg-gray-200"
        >
          +{{ value.length - 3 }} more
        </span>
      </div>
    </div>

    <div v-else-if="field === 'variable_units' && Array.isArray(value)">
      <div class="flex flex-wrap gap-1">
        <span
          v-for="unit in value.slice(0, 2)"
          :key="String(unit)"
          class="px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded text-xs"
        >
          {{ unit }}
        </span>
        <span
          v-if="value.length > 2"
          @click.prevent.stop="openModal(header, value)"
          role="button"
          tabindex="0"
          class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs cursor-pointer hover:bg-gray-200"
        >
          +{{ value.length - 2 }} more
        </span>
      </div>
    </div>

    <span
      v-else-if="field === 'frequency'"
      class="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs font-medium"
    >
      {{ displayValue }}
    </span>

    <span
      v-else-if="field === 'realm'"
      class="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-xs font-medium"
    >
      {{ displayValue }}
    </span>

    <div
      v-else-if="
        field.includes('variable_long_name') ||
        field.includes('variable_standard_name') ||
        field.includes('variable_cell_methods')
      "
    >
      <div v-if="Array.isArray(value)">
        <div v-for="(item, index) in value.slice(0, 2)" :key="index" class="mb-1 text-sm">
          <span
            v-if="typeof item === 'string' && item.length > 40"
            :title="item"
            class="text-gray-700 dark:text-gray-300"
          >
            {{ item.substring(0, 40) }}...
          </span>
          <span v-else class="text-gray-700 dark:text-gray-300">{{ item || '-' }}</span>
        </div>
        <span v-if="value.length > 2" class="text-xs text-gray-500">
          <span
            @click.prevent.stop="openModal(header, value)"
            role="button"
            tabindex="0"
            class="cursor-pointer text-xs text-gray-500 hover:text-gray-700"
          >
            +{{ value.length - 2 }} more
          </span>
        </span>
      </div>
      <span v-else class="text-gray-700 dark:text-gray-300">{{ displayValue }}</span>
    </div>

    <span v-else class="text-gray-900 dark:text-gray-100">
      {{ displayValue }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DatastoreCellValue } from '../types/datastore';

const props = defineProps<{
  field: string;
  header: string;
  value: DatastoreCellValue | DatastoreCellValue[] | null | undefined;
}>();

const emit = defineEmits<{
  (e: 'open-modal', title: string, items: DatastoreCellValue | DatastoreCellValue[]): void;
}>();

/**
 * Normalized fallback display value for simple scalar rendering branches.
 */
const displayValue = computed(() => props.value || '-');

/**
 * Emits a request to show the shared datastore-entry modal for the current cell value.
 *
 * @param title - Modal title to display.
 * @param items - One or more datastore cell values to show in the modal.
 */
const openModal = (title: string, items: DatastoreCellValue | DatastoreCellValue[]) => {
  emit('open-modal', title || 'Details', items);
};
</script>
