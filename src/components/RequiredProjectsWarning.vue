<template>
  <div
    v-if="projects.length > 0"
    class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded"
  >
    <div class="flex items-center mb-2">
      <i class="pi pi-info-circle text-yellow-600 mr-2"></i>
      <strong class="text-yellow-800 dark:text-yellow-200 text-sm">Required Project Access:</strong>
    </div>
    <div>
      <p class="text-yellow-700 dark:text-yellow-300 text-sm mb-2">
        You will need to be a member of the following project{{ projects.length > 1 ? 's' : '' }}:
      </p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="project in projects"
          :key="project"
          v-tooltip.top="'Join group'"
          @click="openProjectJoinPage(project)"
          class="inline-flex items-center gap-1.5 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-blue-400 dark:text-yellow-200 rounded text-sm font-mono font-medium cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors underline decoration-dotted"
        >
          <i class="pi pi-external-link" style="font-size: 0.8rem"></i>
          {{ project }}
        </span>
      </div>
      <div class="mt-2">
        <div class="flex items-center mb-2">
          <i class="pi pi-info-circle text-yellow-600 mr-2"></i>
          <strong class="text-yellow-800 dark:text-yellow-200 text-sm">Required Conda Environment:</strong>
        </div>
        <p class="text-yellow-700 dark:text-yellow-300 text-sm mb-2">
          Please view ARE setup instructions if you are unfamiliar with conda/analysis3.
        </p>
        <span
          v-tooltip.top="'View Setup Instructions'"
          @click="openCondaAnalysis3Docs()"
          class="inline-flex items-center gap-1.5 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-blue-400 dark:text-yellow-200 rounded text-sm font-mono font-medium cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors underline decoration-dotted"
        >
          <i class="pi pi-external-link" style="font-size: 0.8rem"></i>
          conda/analysis3
        </span>
      </div>
    </div>
      <div class="mt-2">
      <div class="flex items-center mb-2">
        <i class="pi pi-info-circle text-yellow-600 mr-2"></i>
        <strong class="text-yellow-800 dark:text-yellow-200 text-sm">Required Conda Environment:</strong>
      </div>
      <p class="text-yellow-700 dark:text-yellow-300 text-sm mb-2">
        Please view ARE setup instructions if you are unfamiliar with conda/analysis3.
      </p>
        <span
          v-tooltip.top="'View Setup Instructions'"
          @click="openCondaAnalysis3Docs()"
          class="inline-flex items-center gap-1.5 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-blue-400 dark:text-yellow-200 rounded text-sm font-mono font-medium cursor-pointer hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors underline decoration-dotted"
        >
          <i class="pi pi-external-link" style="font-size: 0.8rem"></i>
          conda/analysis3
        </span>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Component props for RequiredProjectsWarning.
 *
 * Displays a warning message with clickable project badges when NCI project
 * membership is required to access the data.
 */
interface Props {
  /**
   * Array of NCI project codes that users need to be members of.
   * Example: ['xp65', 'dk92']
   */
  projects: string[];
}

defineProps<Props>();

/**
 * Opens the NCI project join page for the specified project.
 * @param project - The project code (e.g., 'xp65')
 */
const openProjectJoinPage = (project: string): void => {
  const url = `https://my.nci.org.au/mancini/project/${project}/join`;
  window.open(url, '_blank');
};

/**
 * Opens the NCI project join page for the specified project.
 * @param project - The project code (e.g., 'xp65')
 */
const openCondaAnalysis3Docs = (): void => {
  const url = 'https://docs.access-hive.org.au/getting_started/environments/#use-the-environment-within-are';
  window.open(url, '_blank');
};
</script>
