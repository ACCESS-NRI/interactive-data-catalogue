<template>
  <div
    v-if="visible"
    class="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded"
  >
    <div class="flex items-center mb-2">
      <i class="pi pi-exclamation-triangle text-orange-600 mr-2"></i>
      <strong class="text-orange-800 dark:text-orange-200 text-sm">Multiple Cell Methods Detected:</strong>
    </div>
    <p class="text-orange-700 dark:text-orange-300 text-sm">
      This dataset contains multiple variable cell methods. You may need to filter by
      <code class="px-1 py-0.5 bg-orange-100 dark:bg-orange-900 rounded text-xs font-mono">variable_cell_methods</code>
      to select the specific temporal aggregation you need before calling
      <code class="px-1 py-0.5 bg-orange-100 dark:bg-orange-900 rounded text-xs font-mono">to_dask()</code>,
      unless the dataset contains files with moe than one variable cell method.
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Component props for MultipleCellMethodsWarning.
 *
 * Displays a warning message when a single dataset has multiple variable_cell_methods
 * options available, indicating the user should apply additional filtering before
 * converting to an xarray dataset.
 */
interface Props {
  /**
   * Whether to display the warning. Should be true when:
   * - The user has filtered down to a single dataset (to_dask mode)
   * - There are multiple options available for variable_cell_methods
   * - xarray mode is enabled
   */
  visible: boolean;
}

defineProps<Props>();
</script>
