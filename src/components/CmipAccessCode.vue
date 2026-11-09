<template>
  <section
    :aria-labelledby="`${id}-heading`"
    class="mb-6 rounded-xl border border-teal-200 bg-teal-50/70 p-5 dark:border-teal-800 dark:bg-teal-950/30"
  >
    <h2 :id="`${id}-heading`" class="mb-2 text-lg font-semibold text-teal-900 dark:text-teal-100">
      Access data on NCI
    </h2>
    <div>
      <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">
        <template v-if="nciOnly"
          >Use your current {{ project }} search filters to open matching files held on Gadi.</template
        >
        <template v-else
          >Your search is on ESGF. These examples apply the same {{ project }} filters to files held on Gadi; they do
          not open or download the ESGF result list.</template
        >
        The examples use the filters for your whole search, including the ACCESS-only choice, rather than just the
        results on this page or an expanded row.
      </p>
      <div
        role="tablist"
        aria-label="Access code format"
        class="mb-4 flex flex-wrap border-b border-teal-200 dark:border-teal-800"
      >
        <button
          v-for="(tab, index) in tabs"
          :key="tab.id"
          :id="`${id}-${tab.id}-tab`"
          :ref="
            (element) => {
              if (element) tabButtons[index] = element as HTMLButtonElement;
            }
          "
          type="button"
          role="tab"
          :aria-controls="`${id}-${tab.id}-panel`"
          :aria-selected="active === tab.id"
          :tabindex="active === tab.id ? 0 : -1"
          class="border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
          :class="
            active === tab.id
              ? 'border-teal-600 text-teal-900 dark:text-teal-100'
              : 'border-transparent text-gray-600 dark:text-gray-300'
          "
          @click="active = tab.id"
          @keydown="changeTab($event, index)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div
        v-for="tab in tabs"
        v-show="active === tab.id"
        :id="`${id}-${tab.id}-panel`"
        :key="tab.id"
        role="tabpanel"
        :aria-labelledby="`${id}-${tab.id}-tab`"
        tabindex="0"
      >
        <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">{{ tab.description }}</p>
        <details>
          <summary
            class="w-fit cursor-pointer rounded-lg border border-teal-300 bg-white px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 dark:border-teal-700 dark:bg-gray-800 dark:text-teal-100 dark:hover:bg-gray-700"
          >
            View {{ tab.label }} {{ tab.id === 'tool' ? 'recipe and configuration' : 'example' }}
          </summary>
          <div class="pt-4">
            <RequiredProjectsWarning
              :projects="cmipStorageProjects(project)"
              :show-conda-environment="active === 'intake'"
            />
            <p v-if="tab.id === 'intake'" class="mb-3 text-sm text-gray-700 dark:text-gray-300">
              Run this in an ARE JupyterLab notebook using the xp65 <code>conda/analysis3</code> environment. Follow the
              <a
                href="https://docs.access-hive.org.au/getting_started/environments/#use-the-environment-within-are"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-700 underline dark:text-blue-300"
                >ARE setup instructions</a
              >; the launch settings are also included in the code below. Python's built-in <code>re</code> module makes
              the filters match exact values; it needs no separate installation.
            </p>
            <p v-if="active !== 'intake'" class="mb-3 text-sm text-gray-600 dark:text-gray-300">
              Use a current ESMValCore / ESMValTool environment with {{ project }} support. The examples are configured
              for files on Gadi.
            </p>
            <template v-if="tab.id === 'tool'">
              <p
                v-if="recipe.missingSelections.length"
                role="status"
                class="mb-3 text-sm text-amber-900 dark:text-amber-200"
              >
                Before running, select {{ recipe.missingSelections.join(', ') }} or fill in the marked recipe values.
              </p>
              <p
                v-if="recipe.ignoredFilters.length"
                role="status"
                class="mb-3 text-sm text-amber-900 dark:text-amber-200"
              >
                Remove these filters to generate a matching recipe: {{ recipe.ignoredFilters.join(', ') }}.
              </p>
              <p class="mb-2 text-sm">Save the recipe as <code>recipe_cmip.yml</code>.</p>
              <div class="overflow-x-auto rounded"><highlightjs language="yaml" :code="recipe.yaml" /></div>
              <Button
                :label="copied === 'recipe' ? 'Recipe copied' : 'Copy recipe'"
                class="my-3"
                icon="pi pi-copy"
                outlined
                size="small"
                :disabled="recipe.ignoredFilters.length > 0"
                @click="copy(recipe.yaml, 'recipe')"
              />
              <p class="mb-2 text-sm">
                Create a <code>cmip-config</code> directory and save this as <code>cmip-config/data.yml</code>.
              </p>
              <div class="overflow-x-auto rounded"><highlightjs language="yaml" :code="recipe.config" /></div>
              <Button
                :label="copied === 'config' ? 'Configuration copied' : 'Copy configuration'"
                class="my-3"
                icon="pi pi-copy"
                outlined
                size="small"
                @click="copy(recipe.config, 'config')"
              />
              <p class="mb-2 text-sm">Run from the directory containing the recipe:</p>
              <pre
                class="overflow-x-auto rounded bg-gray-900 p-3 text-sm text-gray-100"
              ><code>{{ recipe.command }}</code></pre>
              <Button
                :label="copied === 'command' ? 'Command copied' : 'Copy run command'"
                class="mt-3"
                icon="pi pi-copy"
                outlined
                size="small"
                @click="copy(recipe.command, 'command')"
              />
            </template>
            <template v-else>
              <p
                v-if="tab.id === 'core' && unmapped.length"
                role="status"
                class="mb-3 text-sm text-amber-900 dark:text-amber-200"
              >
                Remove these filters to generate matching ESMValCore code: {{ unmapped.join(', ') }}.
              </p>
              <div class="overflow-x-auto rounded">
                <highlightjs language="python" :code="tab.id === 'intake' ? intakeCode : coreCode" />
              </div>
              <Button
                :label="copied === tab.id ? 'Code copied' : `Copy ${tab.label} code`"
                class="mt-3"
                icon="pi pi-copy"
                outlined
                size="small"
                :disabled="tab.id === 'core' && unmapped.length > 0"
                @click="copy(tab.id === 'intake' ? intakeCode : coreCode, tab.id)"
              />
            </template>
          </div>
        </details>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <Button
          :label="copied === 'link' ? 'Link copied' : 'Copy link to search'"
          icon="pi pi-link"
          outlined
          size="small"
          @click="copySearchLink"
        />
        <a
          href="https://are.nci.org.au/pun/sys/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-blue-700 underline dark:text-blue-300"
          >Open ARE ↗</a
        >
        <span v-if="copyError" role="alert" class="text-sm text-red-700 dark:text-red-300">{{ copyError }}</span>
      </div>
      <p class="mt-3 text-xs text-gray-600 dark:text-gray-300">
        <a
          href="https://intake-esm.readthedocs.io/en/stable/reference/api.html"
          target="_blank"
          rel="noopener noreferrer"
          class="underline"
          >Intake documentation ↗</a
        >
        ·
        <a
          href="https://docs.esmvaltool.org/projects/ESMValCore/en/latest/quickstart/configure.html"
          target="_blank"
          rel="noopener noreferrer"
          class="underline"
          >ESMValCore data-source configuration ↗</a
        >
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import Button from 'primevue/button';
import RequiredProjectsWarning from './RequiredProjectsWarning.vue';
import { getUnmappedCmipFilters, type CmipProject } from '../services/cmipEsmvalcoreCode';
import {
  buildCmipIntakeCode,
  buildCmipCollectionCoreCode,
  buildCmipCollectionRecipe,
  cmipStorageProjects,
} from '../services/cmipAccessCode';
import type { FilterMap } from '../types/datastore';

const props = defineProps<{ project: CmipProject; filters: FilterMap; nciOnly: boolean }>();
const tabs = [
  {
    id: 'intake',
    label: 'Intake + Xarray',
    description: 'Open matching NCI files as Xarray datasets in one Python dictionary, ready for analysis.',
  },
  {
    id: 'core',
    label: 'ESMValCore',
    description: 'Find matching data on NCI and load the datasets as separate Iris cubes.',
  },
  {
    id: 'tool',
    label: 'ESMValTool',
    description: 'Use one recipe to find and preprocess matching data on NCI.',
  },
] as const;
const active = ref<(typeof tabs)[number]['id']>('intake');
const id = useId();
const tabButtons = ref<HTMLButtonElement[]>([]);
const copied = ref('');
const copyError = ref('');
const intakeCode = computed(() => buildCmipIntakeCode(props.filters, props.project));
const coreCode = computed(() => buildCmipCollectionCoreCode(props.filters, props.project));
const recipe = computed(() => buildCmipCollectionRecipe(props.filters, props.project));
const unmapped = computed(() => getUnmappedCmipFilters(props.filters, props.project));
watch([intakeCode, () => props.nciOnly], () => {
  copied.value = '';
  copyError.value = '';
});
function changeTab(event: KeyboardEvent, index: number) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
  active.value = tabs[next]!.id;
  tabButtons.value[next]?.focus();
}
async function copy(text: string, format: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = format;
    copyError.value = '';
  } catch {
    copied.value = '';
    copyError.value = 'Could not copy. Select and copy the text directly.';
  }
}
const copySearchLink = () => copy(window.location.href, 'link');
</script>
