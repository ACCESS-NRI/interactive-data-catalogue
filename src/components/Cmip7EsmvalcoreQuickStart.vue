<template>
  <details class="mb-6 rounded-lg border border-teal-200 bg-teal-50/70 dark:border-teal-800 dark:bg-teal-950/30">
    <summary class="cursor-pointer px-4 py-3 font-semibold text-teal-900 dark:text-teal-100">
      <i class="pi pi-code mr-2" aria-hidden="true"></i>
      Alternative quick start: ESMValCore
    </summary>
    <div class="px-4 pb-4">
      <p class="mb-2 text-sm text-gray-700 dark:text-gray-300">
        Search locally configured CMIP7 data on Gadi by facets, then load a match as an Iris cube. Selected CMIP7
        filters below are included in the code. ESMValCore searches your configured local sources, which may include
        both CMIP7 collections.
      </p>
      <p v-if="unmappedFilters.length" class="mb-2 text-sm text-amber-800 dark:text-amber-200">
        These catalogue filters are not included as ESMValCore facets: {{ unmappedFilters.join(', ') }}.
      </p>
      <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">
        ESMValCore needs a
        <a
          href="https://docs.esmvaltool.org/projects/ESMValCore/en/latest/api/esmvalcore.io.local.html"
          target="_blank"
          rel="noopener noreferrer"
          class="underline hover:text-teal-700 dark:hover:text-teal-200"
          >CMIP7 local data source</a
        >
        in its configuration. See the
        <a
          href="https://docs.esmvaltool.org/projects/ESMValCore/en/latest/reference/facets.html#cmip7"
          target="_blank"
          rel="noopener noreferrer"
          class="underline hover:text-teal-700 dark:hover:text-teal-200"
          >CMIP7 facet mapping</a
        >.
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
import 'highlight.js/lib/common';
import type { FilterMap } from '../types/datastore';
import { buildCmip7EsmvalcoreCode, getUnmappedCmip7Filters } from '../services/cmip7EsmvalcoreCode';

const props = defineProps<{ currentFilters: FilterMap }>();
const code = computed(() => buildCmip7EsmvalcoreCode(props.currentFilters));
const unmappedFilters = computed(() => getUnmappedCmip7Filters(props.currentFilters));
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
