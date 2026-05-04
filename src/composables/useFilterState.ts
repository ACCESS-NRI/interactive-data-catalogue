import { ref } from 'vue';
import type { Ref } from 'vue';
import type { FilterMap } from '../types/datastore';

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
