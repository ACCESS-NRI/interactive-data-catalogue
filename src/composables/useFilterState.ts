import { ref } from 'vue';
import type { Ref } from 'vue';
import type { FilterMap } from '../types/datastore';

/**
 * Creates the shared reactive filter state used by catalogue and datastore views.
 *
 * @param initialFilters - Optional starting filter selections, typically hydrated from the URL.
 * @returns The reactive filter map plus a helper for clearing all active filters.
 */
export function useFilterState(initialFilters: FilterMap = {}): {
  currentFilters: Ref<FilterMap>;
  clearFilters: () => void;
} {
  const currentFilters = ref<FilterMap>(initialFilters);

  const clearFilters = () => {
    currentFilters.value = {};
  };

  return {
    currentFilters,
    clearFilters,
  };
}
