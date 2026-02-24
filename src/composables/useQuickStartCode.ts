import { computed, ref, type Ref } from 'vue';
import { useCatalogStore } from '../stores/catalogStore';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

/**
 * Shared composable for the QuickStartCode components (Eager and Lazy).
 *
 * Accepts reactive refs for all inputs so that both the Eager variant
 * (which computes `numDatasets` internally from `rawData`) and the Lazy
 * variant (which receives `numDatasets` as a prop) can share identical logic.
 *
 * Must be called during a component's `setup` context so that
 * `useRouter()`, `useCatalogStore()`, and `useToast()` are resolved
 * against the correct app instance.
 *
 * @param datastoreName  - Ref to the name of the intake datastore.
 * @param currentFilters - Ref to the per-column active filter map.
 * @param dynamicFilterOptions - Ref to the per-column available options map.
 * @param numDatasets    - Ref to the number of unique datasets currently matched.
 */
export function useQuickStartCode(
  datastoreName: Ref<string>,
  currentFilters: Ref<Record<string, string[]>>,
  dynamicFilterOptions: Ref<Record<string, string[]>>,
  numDatasets: Ref<number>,
) {
  const router = useRouter();
  const toast = useToast();

  /**
   * When true, generate xarray/dask conversion calls in the quick-start code.
   * Default: true (xarray mode on).
   */
  const isXArrayMode = ref(true);

  /** Conservative legacy-safe URL length limit (IE). */
  const MAX_URL_LENGTH = 2083;

  const showLongUrlDialog = ref(false);
  const pendingLongUrl = ref('');
  const pendingUrlLength = ref(0);

  const confirmCopyLongUrl = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      showLongUrlDialog.value = false;
      console.log('Query link copied to clipboard (long):', url);
      triggerCopiedBadge();
    } catch (err) {
      console.error('Failed to copy long link:', err);
    }
  };

  const cancelCopyLongUrl = (): void => {
    showLongUrlDialog.value = false;
    pendingLongUrl.value = '';
    pendingUrlLength.value = 0;
    console.log('User cancelled copying long URL');
  };

  /**
   * Whether any column filters are currently active.
   *
   * Returns true if at least one entry in `currentFilters` contains a
   * non-empty array.
   */
  const hasActiveFilters = computed(() => {
    return Object.values(currentFilters.value).some((value) => value && value.length > 0);
  });

  /**
   * Compute the set of NCI projects the generated quick-start code needs
   * access to.
   *
   * Always includes 'xp65'. Also includes any project stored alongside the
   * datastore entry in the catalog cache.
   */
  const requiredProjects = computed(() => {
    const XP65 = 'xp65';
    const projects = new Set<string>();
    projects.add(XP65);

    const cachedProject = useCatalogStore().getDatastoreFromCache(datastoreName.value)?.project ?? null;
    if (cachedProject) {
      projects.add(cachedProject);
    }

    return Array.from(projects).sort();
  });

  /**
   * Determine whether to show the MultipleCellMethodsWarning.
   *
   * Displayed when:
   * 1. xarray mode is enabled.
   * 2. Exactly one dataset is currently matched.
   * 3. Multiple `temporal_label` options are available (and the user has
   *    not already filtered by `temporal_label`).
   */
  const shouldShowCellMethodsWarning = computed((): boolean => {
    if (!isXArrayMode.value) return false;
    if (numDatasets.value !== 1) return false;

    const hasFilteredTemporalLabels = (currentFilters.value['temporal_label']?.length ?? 0) > 0;
    if (hasFilteredTemporalLabels) return false;

    const temporalLabelOptions = dynamicFilterOptions.value['temporal_label'];
    return !!(temporalLabelOptions && temporalLabelOptions.length > 1);
  });

  /**
   * Generates the quick-start Python code snippet shown to users.
   *
   * Imports `intake`, opens the datastore, appends search filters, and
   * optionally appends xarray/dask conversion calls.
   */
  const quickStartCode = computed(() => {
    let code = `"""
You will need to run this in an ARE session on Gadi: https://are.nci.org.au/pun/sys/dashboard

First we import intake and connect to a Dask cluster - we can then access the datastore.
"""

import intake
from dask.distributed import Client

client = Client(threads_per_worker=1)

datastore = intake.cat.access_nri["${datastoreName.value}"]`;

    if (hasActiveFilters.value) {
      // intake-esm requires the `variable` filter to be applied last for correct
      // variable filtering — sort all other columns first, then `variable`.
      const entries = Object.entries(currentFilters.value);
      const sortedEntries = [
        ...entries.filter(([col]) => col !== 'variable'),
        ...entries.filter(([col]) => col === 'variable'),
      ];
      for (const [column, values] of sortedEntries) {
        if (values && values.length > 0) {
          if (values.length === 1) {
            code += `\ndatastore = datastore.search(${column}='${values[0]}')`;
          } else {
            code += `\ndatastore = datastore.search(${column}=${JSON.stringify(values)})`;
          }
        }
      }
    }

    if (isXArrayMode.value) {
      if (numDatasets.value > 1) {
        code += `\n\n# Search contains ${numDatasets.value} datasets. This will generate a dataset dictionary: see https://intake-esm.readthedocs.io/en/stable/`;
        code += `\n# To get to a single dataset, you will need to filter down to a single File ID.`;
        code += `\ndataset_dict = datastore.to_dataset_dict()\ndataset_dict`;
      } else {
        code += `\ndataset = datastore.to_dask()\ndataset`;
      }
    }

    return code;
  });

  /** Copy the current quick-start code to the clipboard. */
  const copyCodeToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(quickStartCode.value);
      console.log('Quick-start code copied to clipboard');
      triggerCopiedBadge();
    } catch (err) {
      console.error('Failed to copy quick-start code:');
      console.error(err);
    }
  };

  /**
   * Build a URL encoding current filters and copy it to the clipboard.
   *
   * If the resulting URL exceeds `MAX_URL_LENGTH` the long-URL confirmation
   * dialog is shown instead of copying immediately.
   */
  const copySearchLink = async (): Promise<void> => {
    const query: Record<string, string> = {};

    for (const [column, values] of Object.entries(currentFilters.value)) {
      if (values && values.length > 0) {
        query[`${column}_filter`] = values.join(',');
      }
    }

    const route = router.resolve({
      name: 'DatastoreDetail',
      params: { name: datastoreName.value },
      query,
    });

    const fullUrl = new URL(route.href, window.location.href).toString();

    if (fullUrl.length > MAX_URL_LENGTH) {
      pendingLongUrl.value = fullUrl;
      pendingUrlLength.value = fullUrl.length;
      showLongUrlDialog.value = true;
      return;
    }

    try {
      await navigator.clipboard.writeText(fullUrl);
      console.log('Query link copied to clipboard:', fullUrl);
      triggerCopiedBadge();
    } catch (err) {
      console.error('Failed to copy link:');
      console.error(err);
    }
  };

  /** Copy the quick-start code to clipboard then open the ARE dashboard. */
  const copyCodeAndOpenARESession = async (): Promise<void> => {
    const url = 'https://are.nci.org.au/pun/sys/dashboard';
    try {
      await navigator.clipboard.writeText(quickStartCode.value);
      console.log('Quick-start code copied to clipboard');
      triggerCopiedBadge();
      await new Promise((resolve) => setTimeout(resolve, 700));
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to copy quick-start code:');
      console.error(err);
    }
  };

  /**
   * Show a brief "Copied!" success toast.
   * @param timeout - Duration in milliseconds before the toast dismisses.
   */
  function triggerCopiedBadge(timeout = 1400): void {
    toast.add({ severity: 'success', summary: 'Copied', detail: 'Copied to clipboard', life: timeout });
  }

  return {
    // Toggle
    isXArrayMode,
    // Long-URL dialog
    showLongUrlDialog,
    pendingLongUrl,
    pendingUrlLength,
    confirmCopyLongUrl,
    cancelCopyLongUrl,
    // Computed
    hasActiveFilters,
    requiredProjects,
    shouldShowCellMethodsWarning,
    quickStartCode,
    // Actions
    copyCodeToClipboard,
    copySearchLink,
    copyCodeAndOpenARESession,
    triggerCopiedBadge,
  };
}
