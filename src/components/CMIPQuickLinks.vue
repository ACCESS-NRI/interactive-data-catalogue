<template>
  <section
    aria-labelledby="cmip-heading"
    class="mb-6 rounded-xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-800 dark:bg-blue-950/30"
  >
    <div class="mb-4">
      <h2 id="cmip-heading" class="text-xl font-semibold text-gray-900 dark:text-white">
        Explore CMIP data and observations
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
        Jump straight to CMIP6, CMIP7, or curated observations for CMIP evaluation.
      </p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <RouterLink
        v-for="datastore in datastores"
        :key="datastore.name"
        :to="
          datastore.name === 'cmip'
            ? { name: 'CmipSearch' }
            : { name: 'DatastoreDetail', params: { name: datastore.name } }
        "
        class="group flex items-start justify-between gap-4 rounded-lg border p-4 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
        :class="
          datastore.kind === 'observation'
            ? 'border-violet-300 bg-violet-50 hover:border-violet-500 hover:bg-violet-100 focus-visible:ring-violet-600 dark:border-violet-700 dark:bg-violet-950/30 dark:hover:border-violet-400 dark:hover:bg-violet-950/50'
            : 'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 focus-visible:ring-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500 dark:hover:bg-gray-700'
        "
      >
        <span class="min-w-0">
          <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{
            datastore.project
          }}</span>
          <span
            class="block font-semibold group-hover:underline"
            :class="
              datastore.kind === 'observation'
                ? 'text-violet-800 dark:text-violet-200'
                : 'text-blue-700 dark:text-blue-300'
            "
            >{{ datastore.label }}</span
          >
          <span class="mt-1 block text-sm text-gray-600 dark:text-gray-300">{{ datastore.description }}</span>
          <span
            v-if="datastore.name !== 'cmip'"
            class="mt-2 block break-all font-mono text-xs text-gray-500 dark:text-gray-400"
            >{{ datastore.name }}</span
          >
        </span>
        <i
          class="pi pi-arrow-right mt-1 shrink-0"
          :class="
            datastore.kind === 'observation'
              ? 'text-violet-700 dark:text-violet-300'
              : 'text-blue-600 dark:text-blue-400'
          "
          aria-hidden="true"
        ></i>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';

const datastores = [
  {
    name: 'cmip',
    project: 'CMIP',
    label: 'Explore CMIP6 and CMIP7',
    description: 'Search data held at NCI or international data on ESGF, with shared access code for NCI collections.',
    kind: 'cmip',
  },
  {
    name: 'esmvaltool-obs-ct11',
    project: 'Observations',
    label: 'CMIP curated observation product',
    description: 'ESMValTool curated observations for evaluating CMIP model output.',
    kind: 'observation',
  },
] as const;
</script>
