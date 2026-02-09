<template>
  <div class="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">ESM Datastore: {{ datastoreName }}</h1>
      <p class="text-gray-600 dark:text-gray-300">
        Detailed view of the {{ datastoreName }} ESM datastore containing {{ totalRecords?.toLocaleString() }} records.
      </p>
    </div>

    <!-- Vertical divider (hidden on mobile) -->
    <div class="hidden lg:block w-px h-16 bg-gray-300 dark:bg-gray-600 mx-6"></div>

    <!-- Right side - Documentation links -->
    <div class="flex-shrink-0">
      <div class="text-sm text-gray-500 dark:text-gray-400 mb-2 lg:text-right">Documentation</div>
      <div class="flex flex-col space-y-2 items-end">
        <a
          href="https://intake-esm.readthedocs.io/"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm font-medium"
        >
          <i class="pi pi-external-link text-xs"></i>
          intake-esm Documentation
        </a>
        <a
          href="https://access-nri-intake-catalog.readthedocs.io/"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm font-medium"
        >
          <i class="pi pi-external-link text-xs"></i>
          ACCESS-NRI Intake Documentation
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  datastoreName: string;
  totalRecords?: number;
}>();
</script>
