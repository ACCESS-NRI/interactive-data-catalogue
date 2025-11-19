<template>
  <Dialog
    :visible="visible"
    :header="rowData?.name || 'Catalog Entry Details'"
    :modal="true"
    :style="{ width: '90vw', maxWidth: '1200px' }"
    :closable="true"
    @update:visible="$emit('hide')"
  >
    <div v-if="rowData" class="catalog-detail-content">
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <!-- Left Column - Basic Info & Arrays -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Basic Information -->
          <div>
            <h6 class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Basic Information</h6>
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div class="space-y-2">
                <div class="grid grid-cols-4 gap-2">
                  <span class="font-medium text-gray-700 dark:text-gray-300">Name:</span>
                  <span class="col-span-3 text-gray-900 dark:text-gray-100 font-mono text-sm">{{ rowData.name }}</span>
                </div>
                <div class="grid grid-cols-4 gap-2">
                  <span class="font-medium text-gray-700 dark:text-gray-300">Description:</span>
                  <span class="col-span-3 text-gray-900 dark:text-gray-100">{{ rowData.description }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Access Information -->
          <div>
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h6 class="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200">Open Catalog</h6>
              <pre class="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto mb-3"><code>import intake
intake.cat.access_nri["{{ rowData.name }}"]</code></pre>
              <RouterLink
                :to="{
                  name: 'DatastoreDetail',
                  params: { name: rowData.name },
                }"
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 w-fit"
              >
                <i class="pi pi-table"></i>
                View Datastore Online
              </RouterLink>
            </div>
          </div>

          <TagList
            title="Models"
            :items="rowData.model"
            chipClass="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium"
          />

          <TagList
            title="Realms"
            :items="rowData.realm"
            chipClass="px-3 py-1 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-full text-sm font-medium"
          />

          <TagList
            title="Frequencies"
            :items="rowData.frequency"
            chipClass="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium"
          />
        </div>

        <!-- Right Column - Variables -->
        <div class="lg:col-span-3">
          <!-- Variables -->
          <div class="mb-6">
            <h6 class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Variables ({{ rowData.variable.length }} total)
            </h6>
            <div
              class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700 max-h-64 overflow-y-auto"
            >
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="variable in rowData.variable"
                  :key="variable"
                  class="px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded text-sm font-medium"
                >
                  {{ variable }}
                </span>
              </div>
            </div>
          </div>

          <!-- Configuration YAML -->
          <div v-if="rowData.yaml">
            <h6 class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Configuration (YAML)</h6>
            <div class="border border-gray-200 dark:border-gray-600 rounded-lg">
              <div class="bg-gray-50 dark:bg-gray-700 p-4">
                <pre
                  class="text-sm max-h-80 overflow-y-auto text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
                ><code>{{ rowData.yaml || 'No YAML configuration available' }}</code></pre>
              </div>
            </div>
          </div>

          <!-- Placeholder for when no YAML -->
          <div
            v-else
            class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
          >
            <div class="flex items-center">
              <i class="pi pi-info-circle text-yellow-600 mr-2"></i>
              <span class="text-yellow-700 dark:text-yellow-300">YAML configuration not available for this entry.</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          label="Close"
          icon="pi pi-times"
          @click="$emit('hide')"
          class="bg-gray-500 hover:bg-gray-600 text-white"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import TagList from './TagList.vue';
import type { CatalogRow } from '../stores/catalogStore';
import { useCatalogStore } from '../stores/catalogStore';

// Props
const props = defineProps<{
  visible: boolean;
  rowData: CatalogRow | null;
}>();

// Emits
defineEmits<{
  hide: [];
}>();

// Get catalog store for prefetching
const catalogStore = useCatalogStore();

// Watch for modal visibility and rowData to prefetch datastore
watch(
  () => [props.visible, props.rowData?.name],
  ([visible, datastoreName]) => {
    if (visible && datastoreName) {
      console.log(`🔄 Prefetching datastore for modal: ${datastoreName}`);
      // Use loadDatastore which handles caching automatically
      catalogStore.loadDatastore(datastoreName as string).catch((err) => {
        console.warn('Failed to prefetch datastore:', err);
      });
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.catalog-detail-content {
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

/* Custom scrollbar for variable list */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background-color: #f3f4f6;
  border-radius: 4px;
}

.dark .overflow-y-auto::-webkit-scrollbar-track {
  background-color: #4b5563;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 4px;
}

.dark .overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: #6b7280;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: #9ca3af;
}

/* Code formatting */
pre code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.4;
}
</style>
