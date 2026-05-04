import { watch } from 'vue';
import type { Ref } from 'vue';
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import type { FilterMap } from '../types/datastore';

export function parseFiltersFromQuery(query: RouteLocationNormalizedLoaded['query']): FilterMap {
  const filters: FilterMap = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.endsWith('_filter') && typeof value === 'string') {
      const column = key.replace('_filter', '');
      filters[column] = value.split(',').filter((v) => v.trim());
    }
  }
  return filters;
}

export function buildFilterQuery(filters: FilterMap): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [column, values] of Object.entries(filters)) {
    if (values && values.length > 0) {
      query[`${column}_filter`] = values.join(',');
    }
  }
  return query;
}

export function useFilterUrlSync(
  route: RouteLocationNormalizedLoaded,
  router: Router,
  currentFilters: Ref<FilterMap>,
  fallbackRouteName = 'DatastoreDetail',
) {
  const initializeFiltersFromUrl = () => {
    currentFilters.value = parseFiltersFromQuery(route.query);
  };

  const updateUrlWithFilters = () => {
    const query = buildFilterQuery(currentFilters.value);
    router.replace({ name: route.name || fallbackRouteName, params: route.params, query });
  };

  const stopFilterWatcher = watch(currentFilters, updateUrlWithFilters, { deep: true });

  return {
    initializeFiltersFromUrl,
    updateUrlWithFilters,
    stopFilterWatcher,
  };
}
