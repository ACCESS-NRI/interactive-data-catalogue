<template>
  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
    <div class="flex items-center justify-between mb-3">
      <h6 class="text-lg font-semibold text-blue-800 dark:text-blue-200 flex items-center">
        <i class="pi pi-code mr-2"></i>
        Quick Start
      </h6>

      <!-- Toggle Switch -->
      <div class="flex items-center space-x-3">
        <span class="text-sm text-blue-700 dark:text-blue-300">ESM Datastore</span>
        <ToggleSwitch v-model="isXArrayMode" :on-label="'xarray'" :off-label="'ESM'" class="w-24" size="small" />
        <span class="text-sm text-blue-700 dark:text-blue-300">xarray Dataset</span>
      </div>
    </div>

    <p class="text-blue-700 dark:text-blue-300 mb-3">
      To access this data{{ hasActiveFilters ? ' with current filters' : '' }}:
    </p>

    <RequiredProjectsWarning :projects="requiredProjects" />

    <pre class="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto"><code>{{ quickStartCode }}</code></pre>

    <div class="mt-3 relative inline-block">
      <Toast position="top-right" />
      <Button
        label="Copy Code"
        icon="pi pi-share"
        @click="copyCodeToClipboard"
        outlined
        size="small"
        class="text-blue-600 border-blue-600 hover:bg-blue-50 mr-3"
      />

      <Button
        label="Copy Link to Search"
        icon="pi pi-share"
        @click="copySearchLink"
        outlined
        size="small"
        class="text-blue-600 border-blue-600 hover:bg-blue-50"
      />

      <!-- PrimeVue toast will show copy confirmations -->
    </div>

    <LongUrlConfirmDialog
      :visible="showLongUrlDialog"
      :url="pendingLongUrl"
      :url-length="pendingUrlLength"
      @update:visible="showLongUrlDialog = $event"
      @confirm="confirmCopyLongUrl"
      @cancel="cancelCopyLongUrl"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCatalogStore } from '../stores/catalogStore';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import RequiredProjectsWarning from './RequiredProjectsWarning.vue';
import LongUrlConfirmDialog from './LongUrlConfirmDialog.vue';

// Props
/**
 * Component props for QuickStartCode.
 *
 * The component expects the datastore name, the current set of active
 * filters (per-column), and the raw results from the search/catalog query.
 */
interface Props {
  /**
   * The name of the intake datastore to target (used when generating
   * the quick-start Python snippet).
   */
  datastoreName: string;

  /**
   * Object mapping column names to an array of selected filter values.
   * Example: { project: ['xp65'], variable: ['tas'] }
   */
  currentFilters: Record<string, string[]>;

  /**
   * The raw data rows returned by the catalog/search. Each row is expected
   * to be an object and may contain fields such as `path` and `file_id`.
   */
  rawData: any[];
}

/** The typed props object (available in <script setup> via defineProps). */
const props = defineProps<Props>();

// Vue Router
const router = useRouter();

// Reactive state
/**
 * When true, generate xarray/dask conversion calls in the quick-start code.
 * Default: false (generate datastore access/search only).
 */
const isXArrayMode = ref(true);

// Dialog / long-URL state
const MAX_URL_LENGTH = 2083; // conservative legacy-safe limit (IE)
const showLongUrlDialog = ref(false);
const pendingLongUrl = ref('');
const pendingUrlLength = ref(0);

const confirmCopyLongUrl = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url);
    showLongUrlDialog.value = false;
    console.log('Query link copied to clipboard (long):', url);
    // show ephemeral confirmation
    triggerCopiedBadge();
  } catch (err) {
    console.error('Failed to copy long link:', err);
  }
};

const cancelCopyLongUrl = () => {
  showLongUrlDialog.value = false;
  pendingLongUrl.value = '';
  pendingUrlLength.value = 0;
  console.log('User cancelled copying long URL');
};

// Computed properties
/**
 * Whether any column filters are currently active.
 *
 * Returns true if at least one entry in `props.currentFilters` contains
 * a non-empty array.
 */
const hasActiveFilters = computed(() => {
  return Object.values(props.currentFilters).some((value) => value && value.length > 0);
});

/**
 * Compute the set of projects that the generated quick-start code will
 * require access to.
 *
 * Behavior:
 * - Always includes the 'xp65' project by default.
 * - Scans each row in `props.rawData` for a `path` field and attempts
 *   to extract a NCI project name using the pattern `/g/data/{PROJECT}/...`.
 * - Returns a sorted array of unique project names.
 */
const requiredProjects = computed(() => {
  const XP65 = 'xp65';
  const projects = new Set<string>();
  projects.add(XP65);

  // Read the cached project (populated when the datastore is loaded).

  const cachedProject = useCatalogStore().getDatastoreFromCache(props.datastoreName)?.project ?? null;

  if (cachedProject) {
    projects.add(cachedProject);
  }

  return Array.from(projects).sort();
});

/**
 * Number of unique datasets present in `props.rawData`.
 *
 * This counts unique `file_id` values using a Set. Useful for deciding
 * whether the generated xarray snippet should produce a dictionary of
 * datasets or a single dataset.
 */
const numDatasets = computed(() => {
  // Use a Set to count unique datasets - one fileId per dataset
  const fileIds = new Set<string>();

  props.rawData.forEach((row) => {
    if (row['file_id']) {
      fileIds.add(row['file_id']);
    }
  });

  return fileIds.size;
});

/**
 * Generates the quick-start Python code snippet shown to users.
 *
 * The generated snippet will:
 * - Import `intake` and open the configured datastore name.
 * - Append search filters derived from `props.currentFilters`.
 * - Optionally append xarray/dask conversion calls when `isXArrayMode` is
 *   enabled; it will choose between `to_dataset_dict()` and `to_dask()`
 *   depending on how many unique datasets are present.
 *
 * This is a computed string; update the UI automatically when inputs
 * change.
 */
const quickStartCode = computed(() => {
  let code = `# In an ARE session on Gadi: https://are.nci.org.au/pun/sys/dashboard
import intake
datastore = intake.cat.access_nri["${props.datastoreName}"]`;

  if (hasActiveFilters.value) {
    for (const [column, values] of Object.entries(props.currentFilters)) {
      if (values && values.length > 0) {
        // If multiple values, use an array filter, otherwise use single value
        if (values.length === 1) {
          code += `\ndatastore = datastore.search(${column}='${values[0]}')`;
        } else {
          code += `\ndatastore = datastore.search(${column}=${JSON.stringify(values)})`;
        }
      }
    }
  }

  // Add XArray conversion if in XArray mode
  if (isXArrayMode.value) {
    if (numDatasets.value > 1) {
      code += `\n# Search contains ${numDatasets.value} datasets. This will generate a dataset dictionary: see https://intake-esm.readthedocs.io/en/stable/`;
      code += `\n# To get to a single dataset, you will need to filter down to a single File ID.`;
      code += `\ndataset_dict = datastore.to_dataset_dict()`;
    } else {
      code += `\ndataset = datastore.to_dask()`;
    }
  }

  return code;
});

/**
 * Copy a the code currently in the quickStartCode to the clipboard.
 */
const copyCodeToClipboard = async (): Promise<void> => {
  try {
    await navigator.clipboard.writeText(quickStartCode.value);
    console.log('Quick-start code copied to clipboard');
    // show ephemeral confirmation
    triggerCopiedBadge();
  } catch (err) {
    console.error('Failed to copy quick-start code:');
    console.error(err);
  }
};

/**
 * Copy a link to the current page including active filters to the clipboard.
 *
 * The URL query parameters will use the convention `<column>_filter` with
 * comma-separated values. The function attempts to write to the
 * clipboard and logs success or failure. A UI toast can be added where
 * the TODO comment is placed.
 *
 * @returns Promise<void> that resolves when the clipboard write completes.
 */
const copySearchLink = async (): Promise<void> => {
  const query: Record<string, string> = {};

  // Add filter parameters to URL
  for (const [column, values] of Object.entries(props.currentFilters)) {
    if (values && values.length > 0) {
      query[`${column}_filter`] = values.join(',');
    }
  }

  // Use Vue Router's resolve to get the full URL
  const route = router.resolve({
    name: 'DatastoreDetail',
    params: { name: props.datastoreName },
    query,
  });

  // Get the full URL by combining the origin with the resolved route
  const fullUrl = new URL(route.href, window.location.href).toString();

  // If URL is long, show dialog to confirm before copying
  if (fullUrl.length > MAX_URL_LENGTH) {
    pendingLongUrl.value = fullUrl;
    pendingUrlLength.value = fullUrl.length;
    showLongUrlDialog.value = true;
    return;
  }

  try {
    await navigator.clipboard.writeText(fullUrl);
    // TODO: Show toast notification
    console.log('Query link copied to clipboard:', fullUrl);
    // show ephemeral confirmation
    triggerCopiedBadge();
  } catch (err) {
    console.error('Failed to copy link:');
    console.error(err);
  }
};

/**
 * Ephemeral "Copied!" badge state and helper.
 * Shows a small unobtrusive badge for a short time after a successful
 * clipboard write. Accessible via `aria-live` so screen readers are
 * informed of the change.
 */
const toast = useToast();

function triggerCopiedBadge(timeout = 1400) {
  toast.add({ severity: 'success', summary: 'Copied', detail: 'Copied to clipboard', life: timeout });
}
</script>

<style scoped>
/* Code formatting */
pre code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.4;
}

/* Copy confirmations are handled by PrimeVue Toast (see template/script) */
</style>
