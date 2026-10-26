<template>
  <details class="mb-6 rounded-lg border border-teal-200 bg-teal-50/70 dark:border-teal-800 dark:bg-teal-950/30">
    <summary class="cursor-pointer px-4 py-3 font-semibold text-teal-900 dark:text-teal-100">
      <i class="pi pi-code mr-2" aria-hidden="true"></i>
      Alternative quick start: ESMValCore
    </summary>
    <div class="px-4 pb-4">
      <RequiredProjectsWarning :projects="requiredProjects" :datastore-name="datastoreName" />
      <p v-if="unmappedFilters.length" class="mb-2 text-sm text-amber-800 dark:text-amber-200">
        These selected catalogue filters are not included in the ESMValCore search: {{ unmappedFilters.join(', ') }}.
      </p>
      <div class="overflow-x-auto rounded">
        <highlightjs language="python" :code="code" class="text-sm" />
      </div>
      <div class="mt-3 flex items-center gap-3">
        <Button
          :label="copied ? 'Copied' : 'Copy ESMValCore code'"
          icon="pi pi-copy"
          outlined
          size="small"
          @click="copyCode"
        />
        <span v-if="copyError" role="status" class="text-sm text-red-700 dark:text-red-300">
          Could not copy code. Please select it manually.
        </span>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Button from 'primevue/button';
import RequiredProjectsWarning from './RequiredProjectsWarning.vue';
import 'highlight.js/lib/common';
import type { FilterMap } from '../types/datastore';
import { buildCmipEsmvalcoreCode, getUnmappedCmipFilters, type CmipProject } from '../services/cmipEsmvalcoreCode';

const props = defineProps<{
  currentFilters: FilterMap;
  project: CmipProject;
  datastoreName: string;
  requiredProjects: string[];
}>();
const code = computed(() => buildCmipEsmvalcoreCode(props.currentFilters, props.project));
const unmappedFilters = computed(() => getUnmappedCmipFilters(props.currentFilters, props.project));
const copied = ref(false);
const copyError = ref(false);

watch(code, () => {
  copied.value = false;
  copyError.value = false;
});

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(code.value);
    copied.value = true;
    copyError.value = false;
  } catch {
    copied.value = false;
    copyError.value = true;
  }
};
</script>
