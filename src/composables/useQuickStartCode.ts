import { computed, ref, watch, type Ref } from 'vue';
import { useCatalogStore } from '../stores/catalogStore';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { capture } from './usePosthog';
import type { FilterMap, FilterOptions } from '../types/datastore';
import {
  buildQuickStartCode,
  getRequiredProjects,
  hasActiveQuickStartFilters,
  shouldShowQuickStartCellMethodsWarning,
} from '../services/quickStartCode';
import { PERSONAL_DATASTORE_ITERABLE_COLUMNS } from '../stores/catalogStore';

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
 * @param source         - Ref indicating whether this is a builtin or personal datastore.
 */
export function useQuickStartCode(
  datastoreName: Ref<string>,
  currentFilters: Ref<FilterMap>,
  dynamicFilterOptions: Ref<FilterOptions>,
  numDatasets: Ref<number>,
  source: Ref<'builtin' | 'personal'> = ref('builtin'),
) {
  const router = useRouter();
  const toast = useToast();

  /**
   * When true, generate xarray/dask conversion calls in the quick-start code.
   * Default: true (xarray mode on).
   */
  const isXArrayMode = ref(true);

  // Track mode toggles (initial value excluded — watch fires only on change)
  watch(isXArrayMode, (newVal) => {
    capture('quick_start_mode_toggled', {
      datastore_name: datastoreName.value,
      mode: newVal ? 'xarray' : 'esm',
    });
  });

  /** Conservative legacy-safe URL length limit (IE). */
  const MAX_URL_LENGTH = 2083;
  const catalogStore = useCatalogStore();

  const showLongUrlDialog = ref(false);
  const pendingLongUrl = ref('');
  const pendingUrlLength = ref(0);

  const confirmCopyLongUrl = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      showLongUrlDialog.value = false;
      console.log('Query link copied to clipboard (long):', url);
      capture('search_link_copied', {
        datastore_name: datastoreName.value,
        active_filters: currentFilters.value,
        url_length: url.length,
        url_exceeded_limit: true,
      });
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
    return hasActiveQuickStartFilters(currentFilters.value);
  });

  /**
   * Compute the set of NCI projects the generated quick-start code needs
   * access to.
   *
   * Always includes 'xp65'. Also includes any project stored alongside the
   * datastore entry in the catalog cache.
   */
  const requiredProjects = computed(() => {
    return getRequiredProjects(catalogStore.getDatastoreFromCache(datastoreName.value));
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
    return shouldShowQuickStartCellMethodsWarning({
      currentFilters: currentFilters.value,
      dynamicFilterOptions: dynamicFilterOptions.value,
      numDatasets: numDatasets.value,
      isXArrayMode: isXArrayMode.value,
    });
  });

  /**
   * Generates the quick-start Python code snippet shown to users.
   *
   * Imports `intake`, opens the datastore, appends search filters, and
   * optionally appends xarray/dask conversion calls.
   */
  const quickStartCode = computed(() => {
    return buildQuickStartCode({
      datastoreName: datastoreName.value,
      currentFilters: currentFilters.value,
      numDatasets: numDatasets.value,
      isXArrayMode: isXArrayMode.value,
      source: source.value,
      iterableColumns: source.value === 'personal' ? PERSONAL_DATASTORE_ITERABLE_COLUMNS : [],
    });
  });

  /** Copy the current quick-start code to the clipboard. */
  const copyCodeToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(quickStartCode.value);
      console.log('Quick-start code copied to clipboard');
      capture('quick_start_code_copied', {
        datastore_name: datastoreName.value,
        mode: isXArrayMode.value ? 'xarray' : 'esm',
        active_filters: currentFilters.value,
        num_datasets: numDatasets.value,
      });
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
   *
   * For personal datastores the link routes to the PersonalDatastore page.
   */
  const copySearchLink = async (): Promise<void> => {
    const query: Record<string, string> = {};

    for (const [column, values] of Object.entries(currentFilters.value)) {
      if (values && values.length > 0) {
        query[`${column}_filter`] = values.join(',');
      }
    }

    const routeTarget =
      source.value === 'personal'
        ? { name: 'PersonalDatastore', query }
        : { name: 'DatastoreDetail', params: { name: datastoreName.value }, query };

    const route = router.resolve(routeTarget);

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
      capture('search_link_copied', {
        datastore_name: datastoreName.value,
        active_filters: currentFilters.value,
        url_length: fullUrl.length,
        url_exceeded_limit: false,
      });
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
      capture('open_are_clicked', {
        datastore_name: datastoreName.value,
        mode: isXArrayMode.value ? 'xarray' : 'esm',
        active_filters: currentFilters.value,
      });
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
