<template>
  <div v-if="links" class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs">
    <a
      :href="links.thredds"
      target="_blank"
      rel="noopener noreferrer"
      :title="kind === 'file' ? 'Open this file on NCI THREDDS' : 'Browse this directory on NCI THREDDS'"
      class="text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
      >THREDDS <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a
    >
    <a
      v-if="links.globus"
      :href="links.globus"
      target="_blank"
      rel="noopener noreferrer"
      title="Open the folder in Globus; sign-in may be required"
      class="text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
      >Globus folder <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a
    >
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { nciFileAccess, type NciPathKind } from '../services/nciFileAccess';

const props = defineProps<{ path: string; kind: NciPathKind }>();
const links = computed(() => nciFileAccess(props.path, props.kind));
</script>
