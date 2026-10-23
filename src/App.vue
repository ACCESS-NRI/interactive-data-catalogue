<script setup lang="ts">
import { isNavigating } from './router';
import { isDarkMode, toggleTheme } from './composables/useTheme';
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Navigation Loading Overlay -->
    <Transition name="fade">
      <div
        v-if="isNavigating"
        class="fixed inset-0 bg-gray-900/50 dark:bg-gray-950/70 z-50 flex items-center justify-center backdrop-blur-sm"
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl flex items-center gap-4">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span class="text-lg text-gray-800 dark:text-gray-200 font-medium">Loading...</span>
        </div>
      </div>
    </Transition>
    <RouterView />
    <button
      type="button"
      class="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-lg transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
      :aria-label="isDarkMode ? 'Switch to day mode' : 'Switch to night mode'"
      :title="isDarkMode ? 'Switch to day mode' : 'Switch to night mode'"
      @click="toggleTheme"
    >
      <i :class="isDarkMode ? 'pi pi-sun' : 'pi pi-moon'" aria-hidden="true"></i>
      {{ isDarkMode ? 'Day mode' : 'Night mode' }}
    </button>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
