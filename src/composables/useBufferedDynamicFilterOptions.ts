import { ref } from 'vue';
import type { Ref } from 'vue';
import type { FilterOptions } from '../types/datastore';

/**
 * Buffers dynamic filter-option updates while dropdowns are open.
 *
 * This prevents options from disappearing mid-selection when the lazy datastore table emits a
 * newly narrowed option set after each incremental filter change.
 *
 * @param initialOptions - Initial filter options, usually the static options from datastore metadata.
 * @returns Reactive option state, dropdown tracking, buffered updates, and lifecycle helpers.
 */
export function useBufferedDynamicFilterOptions(initialOptions: FilterOptions = {}): {
  dynamicFilterOptions: Ref<FilterOptions>;
  openDropdowns: Ref<Set<string>>;
  pendingFilterUpdates: Ref<FilterOptions>;
  handleDynamicFilterOptionsUpdate: (options: FilterOptions) => void;
  handleDropdownOpened: (column: string) => void;
  handleDropdownClosed: (column: string) => void;
  resetBufferedDynamicFilterOptions: (options?: FilterOptions) => void;
} {
  const dynamicFilterOptions = ref<FilterOptions>(initialOptions);
  const openDropdowns = ref<Set<string>>(new Set());
  const pendingFilterUpdates = ref<FilterOptions>({});

  const handleDynamicFilterOptionsUpdate = (options: FilterOptions) => {
    const updates: FilterOptions = {};
    const buffered: FilterOptions = {};

    for (const [column, values] of Object.entries(options)) {
      if (openDropdowns.value.has(column)) {
        buffered[column] = values;
      } else {
        updates[column] = values;
      }
    }

    if (Object.keys(updates).length > 0) {
      dynamicFilterOptions.value = {
        ...dynamicFilterOptions.value,
        ...updates,
      };
    }

    pendingFilterUpdates.value = {
      ...pendingFilterUpdates.value,
      ...buffered,
    };
  };

  const handleDropdownOpened = (column: string) => {
    openDropdowns.value.add(column);
  };

  const handleDropdownClosed = (column: string) => {
    openDropdowns.value.delete(column);

    if (pendingFilterUpdates.value[column]) {
      dynamicFilterOptions.value = {
        ...dynamicFilterOptions.value,
        [column]: pendingFilterUpdates.value[column],
      };
      delete pendingFilterUpdates.value[column];
    }
  };

  const resetBufferedDynamicFilterOptions = (options: FilterOptions = {}) => {
    openDropdowns.value.clear();
    pendingFilterUpdates.value = {};
    dynamicFilterOptions.value = options;
  };

  return {
    dynamicFilterOptions,
    openDropdowns,
    pendingFilterUpdates,
    handleDynamicFilterOptionsUpdate,
    handleDropdownOpened,
    handleDropdownClosed,
    resetBufferedDynamicFilterOptions,
  };
}
