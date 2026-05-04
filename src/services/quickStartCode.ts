import type { DatastoreCache, FilterMap, FilterOptions } from '../types/datastore';

const XP65_PROJECT = 'xp65';

/**
 * Inputs needed to build the pure quick-start Python snippet.
 */
export interface QuickStartCodeOptions {
  datastoreName: string;
  currentFilters: FilterMap;
  numDatasets: number;
  isXArrayMode: boolean;
}

/**
 * Inputs needed to decide whether the multiple-cell-methods warning appears.
 */
export interface CellMethodsWarningOptions {
  currentFilters: FilterMap;
  dynamicFilterOptions: FilterOptions;
  numDatasets: number;
  isXArrayMode: boolean;
}

/**
 * Returns whether any quick-start filters currently contain selected values.
 */
export function hasActiveQuickStartFilters(currentFilters: FilterMap): boolean {
  return Object.values(currentFilters).some((value) => value && value.length > 0);
}

/**
 * Builds the list of required NCI projects from typed datastore cache metadata.
 *
 * Always includes the shared `xp65` project and adds the datastore-specific
 * project when it is present in cache metadata.
 */
export function getRequiredProjects(cacheEntry: DatastoreCache | null): string[] {
  const projects = new Set<string>([XP65_PROJECT]);

  if (cacheEntry?.project) {
    projects.add(cacheEntry.project);
  }

  return Array.from(projects).sort();
}

/**
 * Returns whether the multiple-cell-methods warning should be displayed.
 */
export function shouldShowQuickStartCellMethodsWarning({
  currentFilters,
  dynamicFilterOptions,
  numDatasets,
  isXArrayMode,
}: CellMethodsWarningOptions): boolean {
  if (!isXArrayMode) return false;
  if (numDatasets !== 1) return false;
  if ((currentFilters.temporal_label?.length ?? 0) > 0) return false;

  const temporalLabelOptions = dynamicFilterOptions.temporal_label;
  return !!(temporalLabelOptions && temporalLabelOptions.length > 1);
}

/**
 * Generates the pure quick-start Python code snippet for a datastore search.
 *
 * The snippet includes the datastore open call, any active search filters,
 * and optional xarray conversion steps when xarray mode is enabled.
 */
export function buildQuickStartCode({
  datastoreName,
  currentFilters,
  numDatasets,
  isXArrayMode,
}: QuickStartCodeOptions): string {
  let code = `"""
You will need to run this in an ARE session on Gadi: https://are.nci.org.au/pun/sys/dashboard

First we import intake and connect to a Dask cluster - we can then access the datastore.
"""

import intake
from dask.distributed import Client

client = Client(threads_per_worker=1)

datastore = intake.cat.access_nri["${datastoreName}"]`;

  if (hasActiveQuickStartFilters(currentFilters)) {
    const entries = Object.entries(currentFilters);
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

  if (isXArrayMode) {
    if (numDatasets > 1) {
      code += `\n\n# Search contains ${numDatasets} datasets. This will generate a dataset dictionary: see https://intake-esm.readthedocs.io/en/stable/`;
      code += `\n# To get to a single dataset, you will need to filter down to a single File ID.`;
      code += `\ndataset_dict = datastore.to_dataset_dict()\ndataset_dict`;
    } else {
      code += `\ndataset = datastore.to_dask()\ndataset`;
    }
  }

  return code;
}
