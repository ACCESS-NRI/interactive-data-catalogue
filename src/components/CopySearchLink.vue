<template>
  <div class="flex flex-wrap items-center gap-2 text-sm">
    <button
      type="button"
      class="rounded-lg border border-blue-300 bg-white px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300"
      @click="copy"
    >
      <i class="pi pi-link mr-2" aria-hidden="true"></i>{{ copied ? 'Link copied' : 'Copy link to search' }}
    </button>
    <span v-if="copied" role="status" class="sr-only">Search link copied</span>
    <span v-if="error" role="alert" class="text-red-700 dark:text-red-300"
      >Could not copy. Copy the URL from your address bar.</span
    >
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
const props = defineProps<{ href: string }>();
const copied = ref(false);
const error = ref(false);
watch(
  () => props.href,
  () => {
    copied.value = false;
    error.value = false;
  },
);
async function copy() {
  const href = props.href;
  try {
    await navigator.clipboard.writeText(href);
    if (href !== props.href) return;
    copied.value = true;
    error.value = false;
  } catch {
    if (href !== props.href) return;
    copied.value = false;
    error.value = true;
  }
}
</script>
