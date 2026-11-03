<template>
  <button
    ref="helpButton"
    type="button"
    :aria-label="`Help with ${fieldLabel} search`"
    aria-haspopup="dialog"
    :aria-controls="popoverId"
    :aria-expanded="isOpen"
    title="How to search variable names"
    class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full p-0 text-blue-600 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-blue-300 dark:hover:bg-gray-600"
    @click="helpPopover?.toggle($event)"
  >
    <i class="pi pi-question-circle text-sm" aria-hidden="true"></i>
  </button>
  <Popover
    :id="popoverId"
    ref="helpPopover"
    :aria-labelledby="`${popoverId}-title`"
    class="max-sm:!fixed max-sm:!left-4 max-sm:!right-4 max-sm:!top-4 max-sm:max-h-[calc(100dvh-2rem)] max-sm:overflow-y-auto max-sm:before:hidden max-sm:after:hidden"
    @show="isOpen = true"
    @hide="isOpen = false"
  >
    <div class="w-80 max-w-[calc(100vw-4rem)] text-sm text-gray-700 max-sm:w-full max-sm:max-w-none dark:text-gray-200">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 :id="`${popoverId}-title`" class="font-semibold text-gray-900 dark:text-white">Finding variable names</h3>
        <button
          type="button"
          aria-label="Close variable search help"
          autofocus
          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full p-0 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-gray-700"
          @click="closeHelp"
        >
          <i class="pi pi-times text-xs" aria-hidden="true"></i>
        </button>
      </div>
      <p>
        Search by all or part of a variable name, then select a value from the list. This field searches names, not
        descriptions: searching for “temperature” will not find <code>tas</code>.
      </p>
      <p class="mt-3">
        For example, in CMIP data, <code>tas</code> means near-surface air temperature and <code>tos</code> means sea
        surface temperature. Names can differ between datasets.
      </p>
      <p v-if="branded" class="mt-3">
        CMIP7 branded variables add sampling details to the short name, for example
        <code class="break-all">tas_tavg-h2m-hxy-u</code>. Start by searching for <code>tas</code>.
      </p>
      <p class="mt-3">Look up a description in these references, then use its variable name here:</p>
      <ul class="mt-2 space-y-2">
        <li>
          <a
            href="https://clipc-services.ceda.ac.uk/dreq/mipVars.html"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-600 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >CMIP6 variable names and descriptions<span class="sr-only"> (opens in a new tab)</span></a
          >
        </li>
        <li>
          <a
            href="https://cmip-data-request.github.io/cmip7-dreq-webview/latest/physical_parameters.html"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-600 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >CMIP7 variable names and descriptions<span class="sr-only"> (opens in a new tab)</span></a
          >
        </li>
        <li v-if="branded">
          <a
            href="https://wcrp-cmip.github.io/cmip7-guidance/docs/CMIP7/Branded_Variables/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-600 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
            >CMIP7 branded variable guide<span class="sr-only"> (opens in a new tab)</span></a
          >
        </li>
      </ul>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue';
import Popover from 'primevue/popover';

defineProps<{ fieldLabel: string; branded?: boolean }>();

const popoverId = useId();
const isOpen = ref(false);
const helpPopover = ref<InstanceType<typeof Popover> | null>(null);
const helpButton = ref<HTMLButtonElement | null>(null);

const closeHelp = () => {
  helpPopover.value?.hide();
  helpButton.value?.focus();
};
</script>
