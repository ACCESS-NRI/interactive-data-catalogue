<template>
  <div>
    <h6 class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">{{ title }}</h6>
    <div class="flex flex-wrap gap-2">
      <template v-if="items && items.length">
        <span
          v-for="item in items"
          :key="item"
          :class="[chipClassComputed, clickable && 'cursor-pointer hover:opacity-80 transition-opacity']"
          v-tooltip.top="clickable ? 'Filter and open' : undefined"
          @click="clickable && $emit('chip-click', item)"
        >
          {{ item }}
        </span>
      </template>
      <template v-else>
        <span class="text-sm text-gray-500 dark:text-gray-300">—</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  items?: string[] | null;
  chipClass?: string | null;
  clickable?: boolean;
}>();

defineEmits<{
  'chip-click': [item: string];
}>();

const defaultChip =
  'px-3 py-1 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-full text-sm font-medium';

const chipClassComputed = props.chipClass ?? defaultChip;
</script>

<style scoped>
/* no additional styles */
</style>
