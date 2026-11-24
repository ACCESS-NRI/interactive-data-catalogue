<template>
  <a
    :href="`https://cmip7.access-hive.org.au/${links[topic].path}`"
    target="_blank"
    rel="noopener noreferrer"
    class="text-blue-700 underline hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300 dark:hover:text-blue-200"
  >
    {{ links[topic].label }}<span aria-hidden="true"> ↗</span><span class="sr-only"> (opens in a new tab)</span>
  </a>
</template>

<script setup lang="ts">
const links = {
  overview: { path: '', label: 'CMIP7 Data in Australia guide' },
  setup: { path: 'get-set-up-nci/', label: 'Get set up for CMIP7 on NCI' },
  intake: {
    path: 'work-with-cmip7-data/analyse-evaluate/#work-in-a-jupyter-notebook-with-xarray',
    label: 'Work with CMIP7 data using Xarray',
  },
  core: {
    path: 'work-with-cmip7-data/analyse-evaluate/#esmvalcore-in-a-notebook',
    label: 'Work with CMIP7 data using ESMValCore',
  },
  tool: {
    path: 'work-with-cmip7-data/analyse-evaluate/#esmvaltool-recipes',
    label: 'Work with CMIP7 data using ESMValTool',
  },
  paths: {
    path: 'work-with-cmip7-data/analyse-evaluate/#use-any-other-tool-with-file-paths',
    label: 'Use CMIP7 file paths with other tools',
  },
  availability: { path: 'find-cmip7-data/data-available/', label: 'What CMIP7 data is available?' },
  citation: { path: 'work-with-cmip7-data/citing-and-errata/', label: 'CMIP7 citation and errata guidance' },
} as const;

defineProps<{ topic: keyof typeof links }>();
</script>
