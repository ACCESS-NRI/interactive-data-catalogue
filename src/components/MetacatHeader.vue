<template>
  <div class="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
    <!-- Left side - Title and description -->
    <div class="flex-1">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">ACCESS-NRI Interactive Intake Catalog</h1>
      <div class="flex items-center gap-5">
        <p class="text-gray-600 dark:text-gray-300">Explore the ACCESS-NRI Intake Catalog</p>
        <div v-if="commitSha && commitSha !== 'unknown'" class="inline-flex">
          <a
            :href="commitUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 px-2.5 py-1 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-md transition-colors text-xs font-mono border border-green-300 dark:border-green-700"
            @mouseenter="showCommitPopover"
            @mouseleave="scheduleHidePopover"
          >
            <i class="pi pi-github text-sm text-green-700 dark:text-green-400"></i>
            <span class="text-green-700 dark:text-green-300">{{ shortCommitSha }}</span>
          </a>
          <Popover ref="commitPopover" @mouseenter="cancelHidePopover" @mouseleave="hideCommitPopover">
            <div class="p-3 max-w-md">
              <div class="text-sm text-gray-900 dark:text-gray-100 mb-2"><strong>Commit:</strong> {{ commitSha }}</div>
              <div v-if="buildTime" class="text-xs text-gray-600 dark:text-gray-400 mb-3">
                <strong>Built:</strong> {{ new Date(buildTime).toLocaleString() }}
              </div>
              <Button label="Copy SHA" icon="pi pi-copy" size="small" @click="copyCommitSha" class="w-full" />
            </div>
          </Popover>
        </div>
      </div>
    </div>

    <!-- Vertical divider (hidden on mobile) -->
    <div class="hidden lg:block w-px h-16 bg-gray-300 dark:bg-gray-600 mx-6"></div>

    <!-- Right side - Documentation links -->
    <div class="flex-shrink-0">
      <div class="text-sm text-gray-500 dark:text-gray-400 mb-2 lg:text-right">Documentation</div>
      <div class="flex flex-col space-y-2">
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
import { ref } from 'vue';
import Button from 'primevue/button';
import Popover from 'primevue/popover';

// Deployment information injected at build time
declare const __GIT_COMMIT_SHA__: string;
declare const __BUILD_TIME__: string;

const commitSha = typeof __GIT_COMMIT_SHA__ !== 'undefined' ? __GIT_COMMIT_SHA__ : null;
const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;
const shortCommitSha = commitSha ? commitSha.substring(0, 7) : '';
const commitUrl = commitSha ? `https://github.com/charles-turner-1/catalog-viewer-spa/commit/${commitSha}` : '';

// Popover management for commit SHA
const commitPopover = ref();
let hideTimeout: number | null = null;

const showCommitPopover = (event: Event) => {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  commitPopover.value?.show(event);
};

const scheduleHidePopover = () => {
  hideTimeout = window.setTimeout(() => {
    commitPopover.value?.hide();
  }, 300);
};

const cancelHidePopover = () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
};

const hideCommitPopover = () => {
  scheduleHidePopover();
};

const copyCommitSha = async () => {
  if (!commitSha) return;

  try {
    await navigator.clipboard.writeText(commitSha);
    commitPopover.value?.hide();
  } catch (err) {
    console.error('Failed to copy commit SHA:', err);
  }
};
</script>
