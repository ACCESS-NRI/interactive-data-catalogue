<template>
  <div>
    <div class="flex items-start gap-3">
      <code class="min-w-0 flex-1 whitespace-pre-wrap break-all text-sm text-gray-900 dark:text-gray-100">{{
        path
      }}</code>
      <button
        type="button"
        class="shrink-0 rounded-md border border-teal-300 bg-white px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-teal-700 dark:bg-gray-800 dark:text-teal-100"
        @click="copy"
      >
        <i class="pi mr-1" :class="copied ? 'pi-check' : 'pi-copy'" aria-hidden="true"></i
        >{{ copied ? 'Copied' : `Copy ${kind}` }}
      </button>
    </div>
    <span class="sr-only" role="status">{{
      copied ? `${kind === 'directory' ? 'Directory' : 'File path'} copied` : ''
    }}</span>
    <p v-if="error" role="alert" class="mt-2 text-sm text-red-700 dark:text-red-300">
      Could not copy. Select and copy the path directly.
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps<{ path: string; kind: 'file path' | 'directory' }>();
const copied = ref(false);
const error = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;
function reset() {
  attempt++;
  clearTimeout(timer);
  copied.value = false;
  error.value = false;
}
watch(() => props.path, reset);
onBeforeUnmount(reset);
async function copy() {
  reset();
  const current = attempt;
  try {
    await navigator.clipboard.writeText(props.path);
    if (current !== attempt) return;
    copied.value = true;
    timer = setTimeout(() => (copied.value = false), 2000);
  } catch {
    if (current === attempt) error.value = true;
  }
}
</script>
