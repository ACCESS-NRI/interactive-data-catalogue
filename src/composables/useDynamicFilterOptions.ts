import { computed } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import type { FilterMap, FilterOptions } from '../types/datastore';

function cellMatchesFilterValue(cellValue: unknown, filterValue: string): boolean {
  if (Array.isArray(cellValue)) {
    return cellValue.some((item) => String(item).toLowerCase().includes(filterValue.toLowerCase()));
  }

  return String(cellValue || '')
    .toLowerCase()
    .includes(filterValue.toLowerCase());
}

export function filterRowsBySelectedFilters<Row extends Record<string, unknown>>(
  rows: Row[],
  currentFilters: FilterMap,
): Row[] {
  let filteredRows = rows;

  for (const [column, filterValues] of Object.entries(currentFilters)) {
    if (filterValues && filterValues.length > 0) {
      filteredRows = filteredRows.filter((row) => {
        const cellValue = row[column];
        return filterValues.some((filterValue) => cellMatchesFilterValue(cellValue, filterValue));
      });
    }
  }

  return filteredRows;
}

export function buildDynamicFilterOptions<Row extends Record<string, unknown>>(
  rows: Row[],
  filterOptions: FilterOptions,
  currentFilters: FilterMap,
): FilterOptions {
  const result: FilterOptions = {};

  for (const [column, allOptions] of Object.entries(filterOptions)) {
    const filtersExcludingCurrentColumn = Object.fromEntries(
      Object.entries(currentFilters).filter(([filterColumn]) => filterColumn !== column),
    );
    const availableRows = filterRowsBySelectedFilters(rows, filtersExcludingCurrentColumn);
    const validOptions = new Set<string>();

    for (const row of availableRows) {
      const cellValue = row[column];
      if (Array.isArray(cellValue)) {
        cellValue.forEach((value) => validOptions.add(String(value)));
      } else if (cellValue !== null && cellValue !== undefined) {
        validOptions.add(String(cellValue));
      }
    }

    result[column] = allOptions.filter((option) => validOptions.has(option));
  }

  return result;
}

export function useDynamicFilterOptions<Row extends Record<string, unknown>>(
  rows: Ref<Row[]> | ComputedRef<Row[]>,
  filterOptions: Ref<FilterOptions> | ComputedRef<FilterOptions>,
  currentFilters: Ref<FilterMap>,
) {
  return computed(() => buildDynamicFilterOptions(rows.value, filterOptions.value, currentFilters.value));
}
