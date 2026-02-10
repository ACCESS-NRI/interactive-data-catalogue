<template>
  <Dialog
    :visible="visible"
    :header="rowData?.name || 'Catalogue Entry Details'"
    :modal="true"
    :dismissableMask="true"
    :style="{ width: '90vw', maxWidth: '1200px' }"
    :closable="true"
    @update:visible="
      (v) => {
        if (!v) $emit('hide');
      }
    "
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
              <h6 class="text-lg font-semibold mb-3 text-blue-800 dark:text-blue-200">Open Catalogue</h6>
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
            :clickable="true"
            @chip-click="(value) => handleFilterClick('model', value)"
          />

          <TagList
            title="Realms"
            :items="rowData.realm"
            chipClass="px-3 py-1 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-full text-sm font-medium"
            :clickable="true"
            @chip-click="(value) => handleFilterClick('realm', value)"
          />

          <TagList
            title="Frequencies"
            :items="rowData.frequency"
            chipClass="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium"
            :clickable="true"
            @chip-click="(value) => handleFilterClick('frequency', value)"
          />
        </div>

        <!-- Right Column - Variables -->
        <div class="lg:col-span-3">
          <!-- Variables -->
          <div class="mb-6">
            <div
              class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700 max-h-64 overflow-y-auto"
            >
              <TagList
                :title="variablesTitle"
                :items="sortedVariables"
                chipClass="px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded text-sm font-medium"
                :clickable="true"
                @chip-click="(value) => handleFilterClick('variable', value)"
              />
            </div>
          </div>

          <!-- Configuration YAML -->
          <div v-if="rowData.yaml">
            <h6 v-if="parseFailure" class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Datastore Configuration (YAML)
            </h6>
            <h6 v-else class="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
              Datastore Metadata (YAML)
            </h6>

            <div class="border border-gray-200 dark:border-gray-600 rounded-lg">
              <div class="bg-gray-50 dark:bg-gray-700 p-4">
                <div v-if="parsedYaml">
                  <YamlTree :data="parsedYaml" />
                </div>
                <div v-else-if="yamlParseError" class="text-sm text-red-600 dark:text-red-300">
                  <div class="font-medium mb-2">Error parsing YAML:</div>
                  <div class="whitespace-pre-wrap">{{ yamlParseError }}</div>
                  <div class="mt-3">
                    <pre
                      class="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto"
                    ><code>{{ rowData.yaml }}</code></pre>
                  </div>
                </div>
                <div
                  v-else
                  class="text-sm max-h-80 overflow-y-auto text-gray-800 dark:text-gray-200 whitespace-pre-wrap"
                >
                  <pre><code>{{ rowData.yaml || 'No YAML configuration available' }}</code></pre>
                </div>
              </div>
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
import { ref, watch, computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import TagList from './TagList.vue';
import YamlTree from './YamlTree.vue';
import { load as loadYaml } from 'js-yaml';
import type { CatalogRow } from '../stores/catalogStore';
import { useCatalogStore } from '../stores/catalogStore';
import { useRouter } from 'vue-router';

// Props
const props = defineProps<{
  visible: boolean;
  rowData: CatalogRow | null;
}>();

// Emits
const emit = defineEmits<{
  hide: [];
}>();

// Get catalog store for prefetching
const catalogStore = useCatalogStore();
const router = useRouter();

// Parsed YAML state
const parsedYaml = ref<any>(null);
const yamlParseError = ref<string | null>(null);

const parseFailure = ref(false);

// Sort variables for our chips
const sortedVariables = computed(() => {
  if (!props.rowData?.variable) return [];
  return [...props.rowData.variable].sort();
});

// Computed title for variables including count
const variablesTitle = computed(() => {
  const count = props.rowData?.variable?.length || 0;
  return `Variables (${count} total)`;
});

// Watch and parse YAML when rowData changes
watch(
  () => props.rowData?.yaml,
  (yaml) => {
    parsedYaml.value = null;
    yamlParseError.value = null;
    if (!yaml) return;
    try {
      const yamlData = loadYaml(yaml as string);
      parsedYaml.value = yamlData?.sources[props?.rowData?.name ?? '-999']?.metadata ?? yamlData;
    } catch (err: any) {
      parseFailure.value = true;
      yamlParseError.value = err?.message || String(err);
      console.warn('YAML parse error', err);
    }
  },
  { immediate: true },
);

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

// Handle chip clicks - navigate to datastore with filter
const handleFilterClick = (field: string, value: string) => {
  if (!props.rowData?.name) return;

  // Check if the field exists in the datastore columns
  const datastore = catalogStore.getDatastoreFromCache(props.rowData.name);
  const hasField = datastore?.columns?.includes(field);

  router.push({
    name: 'DatastoreDetail',
    params: { name: props.rowData.name },
    // Only add filter query if the field exists in the datastore
    query: hasField ? { [`${field}_filter`]: value } : {},
  });

  emit('hide');
};
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
