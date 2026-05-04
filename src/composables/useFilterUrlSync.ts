import { watch } from 'vue';
import type { Ref } from 'vue';
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import type { FilterMap } from '../types/datastore';

/**
 * Parses `*_filter` query parameters into the internal filter-map shape.
 *
 * @param query - The current route query object.
 * @returns A filter map keyed by column name.
 */
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

/**
 * Serializes the internal filter-map shape back into `*_filter` query parameters.
 *
 * @param filters - Active filter selections keyed by column name.
 * @returns A query object suitable for `router.replace()`.
 */
export function buildFilterQuery(filters: FilterMap): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [column, values] of Object.entries(filters)) {
    if (values && values.length > 0) {
      query[`${column}_filter`] = values.join(',');
    }
  }
  return query;
}

/**
 * Keeps reactive filter state synchronized with the current route query string.
 *
 * @param route - The active route.
 * @param router - Router instance used to replace the current query string.
 * @param currentFilters - Reactive filter state to hydrate and observe.
 * @param fallbackRouteName - Route name to use if the current route has no explicit name.
 * @returns Helpers for initial hydration, manual URL updates, and watcher cleanup.
 */
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
