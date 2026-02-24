<template>
  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
      <h6 class="text-lg font-semibold text-blue-800 dark:text-blue-200 flex items-center">
        <i class="pi pi-code mr-2"></i>
        Quick Start
      </h6>

      <!-- Toggle Switch -->
      <div class="flex items-center space-x-3">
        <span class="text-sm text-blue-700 dark:text-blue-300">ESM Datastore</span>
        <ToggleSwitch v-model="isXArrayMode" :on-label="'xarray'" :off-label="'ESM'" class="w-24" size="small" />
        <span class="text-sm text-blue-700 dark:text-blue-300">xarray Dataset</span>
      </div>
    </div>

    <p class="text-blue-700 dark:text-blue-300 mb-3">
      To access this data{{ hasActiveFilters ? ' with current filters' : '' }}:
    </p>

    <RequiredProjectsWarning :projects="requiredProjects" />

    <MultipleCellMethodsWarning :visible="shouldShowCellMethodsWarning" />

    <div class="rounded overflow-hidden">
      <highlightjs language="python" :code="quickStartCode" class="text-sm" />
    </div>

    <div class="mt-3 relative flex flex-col sm:flex-row gap-2 justify-center sm:justify-start">
      <Toast position="top-right" />
      <Button
        label="Copy Code"
        icon="pi pi-share"
        @click="copyCodeToClipboard"
        outlined
        size="small"
        class="text-blue-600 border-blue-600 hover:bg-blue-50 mr-3"
      />

      <Button
        label="Copy Link to Search"
        icon="pi pi-share"
        @click="copySearchLink"
        outlined
        size="small"
        class="text-blue-600 border-blue-600 hover:bg-blue-50 mr-3"
      />

      <Button
        label="Copy Code and Open ARE Session"
        icon="pi pi-share"
        @click="copyCodeAndOpenARESession"
        outlined
        size="small"
        class="text-blue-600 border-blue-600 hover:bg-blue-50"
      />
      <!-- PrimeVue toast will show copy confirmations -->
    </div>

    <LongUrlConfirmDialog
      :visible="showLongUrlDialog"
      :url="pendingLongUrl"
      :url-length="pendingUrlLength"
      @update:visible="showLongUrlDialog = $event"
      @confirm="confirmCopyLongUrl"
      @cancel="cancelCopyLongUrl"
    />
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import Toast from 'primevue/toast';
import RequiredProjectsWarning from '../RequiredProjectsWarning.vue';
import MultipleCellMethodsWarning from '../MultipleCellMethodsWarning.vue';
import LongUrlConfirmDialog from '../LongUrlConfirmDialog.vue';
import { useQuickStartCode } from '../../composables/useQuickStartCode';
import 'highlight.js/lib/common';

/**
 * Component props for LazyQuickStartCode.
 */
interface Props {
  /** The name of the intake datastore to target. */
  datastoreName: string;
  /** Object mapping column names to an array of selected filter values. */
  currentFilters: Record<string, string[]>;
  /** Dynamic filter options per column (filtered based on other active filters). */
  dynamicFilterOptions: Record<string, string[]>;
  /** Number of unique datasets currently matched (computed externally). */
  numDatasets: number;
}

const props = defineProps<Props>();

const {
  isXArrayMode,
  showLongUrlDialog,
  pendingLongUrl,
  pendingUrlLength,
  confirmCopyLongUrl,
  cancelCopyLongUrl,
  hasActiveFilters,
  requiredProjects,
  shouldShowCellMethodsWarning,
  quickStartCode,
  copyCodeToClipboard,
  copySearchLink,
  copyCodeAndOpenARESession,
} = useQuickStartCode(
  toRef(props, 'datastoreName'),
  toRef(props, 'currentFilters'),
  toRef(props, 'dynamicFilterOptions'),
  toRef(props, 'numDatasets'),
);
</script>

<style scoped>
/* Code formatting */
pre code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.4;
}

/* Copy confirmations are handled by PrimeVue Toast (see template/script) */
</style>
