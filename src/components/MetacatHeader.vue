<template>
  <div class="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
    <!-- Left side - Title and actions -->
    <div class="min-w-0 flex-1">
      <div
        class="mb-2 flex items-center pl-[104px] max-[374px]:pr-4 min-[375px]:pl-[136px] md:pl-[164px] lg:pl-[206px]"
      >
        <h1
          class="text-[26px] font-bold text-gray-900 dark:text-white max-[374px]:text-2xl md:whitespace-nowrap md:text-[28px] lg:text-3xl"
        >
          ACCESS-NRI Interactive Data Catalogue
        </h1>
      </div>
      <div class="grid grid-cols-2 items-center gap-2 md:flex md:flex-wrap md:pl-[164px] lg:pl-[206px]">
        <RouterLink
          :to="{ name: 'PersonalDatastore' }"
          class="inline-flex h-[60px] w-full md:w-[122px] md:flex-none xl:w-[160px]"
        >
          <Button
            icon="pi pi-upload"
            label="Explore personal datastore"
            aria-label="Explore my personal datastore"
            class="catalogue-header-button p-button-sm h-full w-full flex-col rounded-md text-center font-medium text-white transition-colors"
          />
        </RouterLink>
        <div class="contents md:flex md:items-center md:gap-2">
          <Button
            icon="pi pi-info-circle"
            label="About & Privacy"
            aria-label="Reopen welcome guide"
            title="Reopen welcome guide"
            class="catalogue-header-button p-button-sm h-[60px] w-full flex-col rounded-md text-center font-medium text-white transition-colors md:w-[104px] xl:w-[136px]"
            @click="welcomeModalRef?.open()"
          />
          <!-- Clean tagged release: link to GitHub Releases -->
          <a
            v-if="isCleanRelease"
            :href="releaseUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex h-[60px] w-full flex-col items-center justify-center gap-1 rounded-md border border-green-300 bg-green-50 px-2 py-1 text-center text-xs leading-tight transition-colors hover:bg-green-100 dark:border-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30 md:w-[124px] xl:w-[150px]"
            @mouseenter="showCommitPopover"
            @mouseleave="scheduleHidePopover"
          >
            <i class="pi pi-github text-sm text-green-700 dark:text-green-400"></i>
            <span class="break-all text-green-700 dark:text-green-300">{{ appVersion }}</span>
          </a>
          <!-- Dirty or dev build: non-linked badge -->
          <span
            v-else
            :class="[
              'flex h-[60px] w-full flex-col items-center justify-center gap-1 rounded-md border px-2 py-1 text-center text-xs leading-tight md:w-[124px] xl:w-[150px]',
              appVersion.endsWith('.dirty')
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600',
            ]"
            @mouseenter="showCommitPopover"
            @mouseleave="scheduleHidePopover"
          >
            <i
              class="pi pi-github text-sm"
              :class="
                appVersion.endsWith('.dirty')
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-gray-500 dark:text-gray-400'
              "
            ></i>
            <span
              class="break-all"
              :class="
                appVersion.endsWith('.dirty')
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-gray-500 dark:text-gray-400'
              "
              >{{ appVersion }}</span
            >
          </span>
          <Popover ref="commitPopover" @mouseenter="cancelHidePopover" @mouseleave="scheduleHidePopover">
            <div class="p-3 max-w-md">
              <div class="text-sm text-gray-900 dark:text-gray-100 mb-2">
                <strong>Version:</strong> {{ appVersion }}
              </div>
              <div v-if="commitSha && commitSha !== 'unknown'" class="text-sm text-gray-900 dark:text-gray-100 mb-2">
                <strong>Commit:</strong> {{ commitSha }}
              </div>
              <div v-if="buildTime" class="text-xs text-gray-600 dark:text-gray-400 mb-3">
                <strong>Built:</strong> {{ new Date(buildTime).toLocaleString() }}
              </div>
              <Button label="Copy SHA" icon="pi pi-copy" size="small" @click="copyCommitSha" class="w-full" />
            </div>
          </Popover>
          <GithubFeedbackButton
            class="catalogue-header-button h-[60px] w-full flex-col text-center md:w-[112px] xl:w-[144px]"
          />
        </div>
      </div>
    </div>

    <!-- Vertical divider (hidden on mobile) -->
    <div class="hidden lg:block w-px h-16 bg-gray-300 dark:bg-gray-600 mx-3"></div>

    <!-- Right side - Documentation links -->
    <div class="flex-shrink-0">
      <div class="text-sm text-gray-500 dark:text-gray-400 mb-2 text-right">Documentation</div>
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

  <!-- Welcome modal (teleports to body) -->
  <WelcomeModal ref="welcomeModalRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import Button from 'primevue/button';
import Popover from 'primevue/popover';
import GithubFeedbackButton from './GithubFeedbackButton.vue';
import WelcomeModal from './WelcomeModal.vue';
import { usePostHog } from '../composables/usePosthog';
import { useBuildInfo } from '../composables/useBuildInfo';

const { commitSha, buildTime, appVersion, releaseUrl, isCleanRelease } = useBuildInfo();

// Popover management for commit SHA
const commitPopover = ref();
const welcomeModalRef = ref<InstanceType<typeof WelcomeModal> | null>(null);
const { capture } = usePostHog();
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

const copyCommitSha = async () => {
  if (!commitSha) return;

  try {
    await navigator.clipboard.writeText(commitSha);
    capture('commit_sha_copied');
    commitPopover.value?.hide();
  } catch (err) {
    console.error('Failed to copy commit SHA:', err);
  }
};
</script>

<style scoped>
.catalogue-header-button {
  gap: 0.25rem !important;
  padding: 0 0.5rem !important;
  font-size: 0.75rem !important;
  line-height: 1.1 !important;
}
</style>
