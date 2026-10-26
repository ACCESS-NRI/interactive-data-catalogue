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
      <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          :label="copied ? 'Copied' : 'Copy ESMValCore code'"
          icon="pi pi-copy"
          outlined
          size="small"
          @click="copyCode"
        />
        <Button
          :label="linkCopied ? 'Link copied' : 'Copy Link to Search'"
          icon="pi pi-share"
          outlined
          size="small"
          @click="copySearchLink"
        />
        <Button
          label="Copy Code and Open ARE Session"
          icon="pi pi-external-link"
          outlined
          size="small"
          @click="copyCodeAndOpenARESession"
        />
        <span v-if="copyError" role="status" class="text-sm text-red-700 dark:text-red-300">{{ copyError }}</span>
      </div>
      <LongUrlConfirmDialog
        :visible="showLongUrlDialog"
        :url="pendingLongUrl"
        :url-length="pendingLongUrl.length"
        @update:visible="showLongUrlDialog = $event"
        @confirm="confirmCopyLongUrl"
        @cancel="cancelCopyLongUrl"
      />

      <details class="mt-4 rounded border border-teal-200 bg-white/60 dark:border-teal-800 dark:bg-teal-950/20">
        <summary class="cursor-pointer px-3 py-2 font-medium text-teal-900 dark:text-teal-100">
          ESMValTool recipe (.yml)
        </summary>
        <div class="px-3 pb-3">
          <p class="mb-2 text-sm text-teal-900 dark:text-teal-100">
            Save this recipe as a .yml file and run it with ESMValTool on Gadi. It keeps the preprocessed data; add a
            diagnostic script for analysis.
          </p>
          <p v-if="recipe.missingSelections.length" class="mb-2 text-sm text-amber-800 dark:text-amber-200">
            Before running, select {{ recipe.missingSelections.join(', ') }} in the catalogue or replace the marked
            values in the recipe.
          </p>
          <p v-if="recipe.ignoredFilters.length" class="mb-2 text-sm text-amber-800 dark:text-amber-200">
            These selected catalogue filters are not included in the recipe: {{ recipe.ignoredFilters.join(', ') }}.
          </p>
          <div class="overflow-x-auto rounded">
            <highlightjs language="yaml" :code="recipe.yaml" class="text-sm" />
          </div>
          <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              :label="recipeCopied ? 'Recipe copied' : 'Copy recipe (.yml)'"
              icon="pi pi-copy"
              outlined
              size="small"
              @click="copyRecipe"
            />
            <Button
              label="Copy recipe and open ARE session"
              icon="pi pi-external-link"
              outlined
              size="small"
              @click="copyRecipeAndOpenARESession"
            />
            <span v-if="recipeCopyError" role="status" class="text-sm text-red-700 dark:text-red-300">
              Could not copy recipe. Please select it manually.
            </span>
          </div>
        </div>
      </details>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import LongUrlConfirmDialog from './LongUrlConfirmDialog.vue';
import RequiredProjectsWarning from './RequiredProjectsWarning.vue';
import 'highlight.js/lib/common';
import type { FilterMap } from '../types/datastore';
import { buildCmipEsmvalcoreCode, getUnmappedCmipFilters, type CmipProject } from '../services/cmipEsmvalcoreCode';
import { buildCmipEsmvaltoolRecipe } from '../services/cmipEsmvaltoolRecipe';

const props = defineProps<{
  currentFilters: FilterMap;
  project: CmipProject;
  datastoreName: string;
  requiredProjects: string[];
}>();
const code = computed(() => buildCmipEsmvalcoreCode(props.currentFilters, props.project));
const recipe = computed(() => buildCmipEsmvaltoolRecipe(props.currentFilters, props.project));
const unmappedFilters = computed(() => getUnmappedCmipFilters(props.currentFilters, props.project));
const router = useRouter();
const copied = ref(false);
const linkCopied = ref(false);
const copyError = ref('');
const showLongUrlDialog = ref(false);
const pendingLongUrl = ref('');
const recipeCopied = ref(false);
const recipeCopyError = ref(false);

watch(code, () => {
  copied.value = false;
  linkCopied.value = false;
  copyError.value = '';
});

watch(recipe, () => {
  recipeCopied.value = false;
  recipeCopyError.value = false;
});

const copyCode = async (): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(code.value);
    copied.value = true;
    copyError.value = '';
    return true;
  } catch {
    copied.value = false;
    copyError.value = 'Could not copy code. Please select it manually.';
    return false;
  }
};

const copyLink = async (url: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(url);
    linkCopied.value = true;
    copyError.value = '';
    showLongUrlDialog.value = false;
    pendingLongUrl.value = '';
  } catch {
    linkCopied.value = false;
    copyError.value = 'Could not copy the search link. Please try again.';
  }
};

const copySearchLink = async (): Promise<void> => {
  const query: Record<string, string> = {};
  for (const [column, values] of Object.entries(props.currentFilters)) {
    if (values?.length) query[`${column}_filter`] = values.join(',');
  }

  const route = router.resolve({ name: 'DatastoreDetail', params: { name: props.datastoreName }, query });
  const url = new URL(route.href, window.location.href).toString();
  if (url.length > 2083) {
    pendingLongUrl.value = url;
    showLongUrlDialog.value = true;
    return;
  }
  await copyLink(url);
};

const confirmCopyLongUrl = async (url: string): Promise<void> => {
  await copyLink(url);
};

const cancelCopyLongUrl = (): void => {
  showLongUrlDialog.value = false;
  pendingLongUrl.value = '';
};

const copyCodeAndOpenARESession = async (): Promise<void> => {
  if (await copyCode()) window.open('https://are.nci.org.au/pun/sys/dashboard', '_blank');
};

const copyRecipe = async (): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(recipe.value.yaml);
    recipeCopied.value = true;
    recipeCopyError.value = false;
    return true;
  } catch {
    recipeCopied.value = false;
    recipeCopyError.value = true;
    return false;
  }
};

const copyRecipeAndOpenARESession = async (): Promise<void> => {
  if (await copyRecipe()) window.open('https://are.nci.org.au/pun/sys/dashboard', '_blank');
};
</script>
