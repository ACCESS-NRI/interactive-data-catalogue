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
        <ToggleSwitch v-model="isXArrayMode" onLabel="xarray" offLabel="ESM" class="w-24" size="small" />
        <span class="text-sm text-blue-700 dark:text-blue-300">xarray Dataset</span>
      </div>
    </div>

    <p class="text-blue-700 dark:text-blue-300 mb-3">
      To access this data{{ hasActiveFilters ? ' with current filters' : '' }}:
    </p>

    <!-- Required Projects Section -->
    <div
      v-if="requiredProjects.length > 0"
      class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded"
    >
      <div class="flex items-center mb-2">
        <i class="pi pi-info-circle text-yellow-600 mr-2"></i>
        <strong class="text-yellow-800 dark:text-yellow-200 text-sm">Required Project Access:</strong>
      </div>
      <p class="text-yellow-700 dark:text-yellow-300 text-sm mb-2">
        You will need to be a member of the following project{{ requiredProjects.length > 1 ? 's' : '' }}:
      </p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="project in requiredProjects"
          :key="project"
          class="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-sm font-mono font-medium"
        >
          {{ project }}
        </span>
      </div>
    </div>

    <pre class="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto"><code>{{ quickStartCode }}</code></pre>

    <div class="mt-3 relative inline-block">
      <Button
        label="Copy Query Link"
        icon="pi pi-share"
        @click="copyQueryLink"
        outlined
        size="small"
        class="text-blue-600 border-blue-600 hover:bg-blue-50"
      />

      <!-- Small ephemeral copied badge -->
      <transition name="copied">
        <span v-if="showCopied" role="status" aria-live="polite" class="copied-badge"> Copied! </span>
      </transition>
    </div>
    <!-- Long URL confirmation dialog -->
    <Dialog v-model:visible="showLongUrlDialog" header="Long link warning" modal>
      <p class="text-sm text-gray-700 dark:text-gray-200">
        The generated link is <strong>{{ pendingUrlLength }}</strong> characters long and may not work in some browsers,
        servers, or when pasted into email clients.
      </p>
      <p class="text-sm text-gray-600 dark:text-gray-300 mt-2">Do you want to copy it to the clipboard anyway?</p>
      <div class="mt-4 flex justify-end space-x-2">
        <Button label="Cancel" class="p-button-text" @click="cancelCopyLongUrl" />
        <Button label="Copy anyway" icon="pi pi-copy" @click="confirmCopyLongUrl" />
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import ToggleSwitch from 'primevue/toggleswitch';
import Dialog from 'primevue/dialog';

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

const confirmCopyLongUrl = async () => {
  try {
    await navigator.clipboard.writeText(pendingLongUrl.value);
    showLongUrlDialog.value = false;
    console.log('Query link copied to clipboard (long):', pendingLongUrl.value);
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
  const projects = new Set<string>();

  // We always require 'xp65'
  const XP65 = 'xp65';
  projects.add(XP65);

  // Look for path fields in the data
  props.rawData.forEach((row) => {
    // Check various possible path field names
    const field = 'path';

    if (row[field]) {
      const pathValue = row[field];
      // Match pattern /g/data/{PROJECT}/...
      const match = pathValue.match(/\/g\/data\/([^\/]+)\//);
      if (match) {
        projects.add(match[1]);
      }
    }
  });

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
 * Copy a link to the current page including active filters to the clipboard.
 *
 * The URL query parameters will use the convention `<column>_filter` with
 * comma-separated values. The function attempts to write to the
 * clipboard and logs success or failure. A UI toast can be added where
 * the TODO comment is placed.
 *
 * @returns Promise<void> that resolves when the clipboard write completes.
 */
const copyQueryLink = async (): Promise<void> => {
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
  const fullUrl = new URL(route.href, window.location.origin).toString();

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
const showCopied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

function triggerCopiedBadge(timeout = 1400) {
  if (copiedTimer) {
    clearTimeout(copiedTimer);
    copiedTimer = null;
  }
  showCopied.value = true;
  copiedTimer = setTimeout(() => {
    showCopied.value = false;
    copiedTimer = null;
  }, timeout);
}
</script>

<style scoped>
/* Code formatting */
pre code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.4;
}

/* Copied badge styles */
.copied-badge {
  display: inline-block;
  background: rgba(16, 185, 129, 0.12); /* green-500 at 12% */
  color: #065f46; /* green-800 */
  border: 1px solid rgba(16, 185, 129, 0.2);
  padding: 0.25rem 0.6rem;
  border-radius: 9999px; /* pill */
  font-weight: 600;
  font-size: 0.85rem;
  box-shadow: 0 6px 18px rgba(2, 6, 23, 0.08);
  margin-left: 0.5rem;
  transform-origin: center right;
}

/* small fade + pop animation */
.copied-enter-from,
.copied-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}
.copied-enter-active,
.copied-leave-active {
  transition: all 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.copied-enter-to,
.copied-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
