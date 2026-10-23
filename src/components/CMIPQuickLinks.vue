<template>
  <section
    aria-labelledby="cmip-heading"
    class="mb-6 rounded-xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-800 dark:bg-blue-950/30"
  >
    <div class="mb-4">
      <h2 id="cmip-heading" class="text-xl font-semibold text-gray-900 dark:text-white">Explore CMIP data on Gadi</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">Jump straight to a CMIP6 or CMIP7 datastore.</p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <RouterLink
        v-for="datastore in datastores"
        :key="datastore.name"
        :to="{ name: 'DatastoreDetail', params: { name: datastore.name } }"
        class="group flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-gray-700"
      >
        <span class="min-w-0">
          <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{
            datastore.project
          }}</span>
          <span class="block font-semibold text-blue-700 group-hover:underline dark:text-blue-300">{{
            datastore.label
          }}</span>
          <span class="mt-1 block text-sm text-gray-600 dark:text-gray-300">{{ datastore.description }}</span>
          <span class="mt-2 block break-all font-mono text-xs text-gray-500 dark:text-gray-400">{{
            datastore.name
          }}</span>
        </span>
        <i class="pi pi-arrow-right mt-1 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true"></i>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';

const datastores = [
  {
    name: 'cmip7_australian',
    project: 'CMIP7',
    label: 'ACCESS submissions',
    description: 'CMIP7 data submitted by ACCESS.',
  },
  {
    name: 'cmip7_replicated',
    project: 'CMIP7',
    label: 'ESGF replicas',
    description: 'CMIP7 data replicated from ESGF.',
  },
  {
    name: 'cmip6_fs38',
    project: 'CMIP6',
    label: 'ACCESS submissions',
    description: 'CMIP6 data submitted by ACCESS.',
  },
  {
    name: 'cmip6_oi10',
    project: 'CMIP6',
    label: 'Replicas',
    description: 'Replicated CMIP6 data.',
  },
] as const;
</script>
