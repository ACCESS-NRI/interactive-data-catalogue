import { buildEsmDatastoreTableUrl } from '../config/catalogEndpoints';
import { fetchEsgfJson } from './esgfSearch';
import type { FilterMap, FilterOptions, PagedDatastoreResponse } from '../types/datastore';
import type { CmipProject } from './cmipEsmvalcoreCode';

export const CMIP_COLLECTIONS = {
  CMIP6: [
    { name: 'cmip6_fs38', label: 'Australian submissions' },
    { name: 'cmip6_oi10', label: 'ESGF replicas' },
  ],
  CMIP7: [
    { name: 'cmip7_australian', label: 'Australian submissions' },
    { name: 'cmip7_replicated', label: 'ESGF replicas' },
  ],
} as const;

export async function fetchCmipNciPage(
  name: string,
  filters: FilterMap,
  signal: AbortSignal,
  offset = 0,
  limit = 10,
): Promise<PagedDatastoreResponse> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
    filters: JSON.stringify(filters),
  });
  const data = (await fetchEsgfJson(
    buildEsmDatastoreTableUrl(name, params.toString()),
    signal,
    60_000, // Large CMIP6 catalogues can take longer to return collection-wide facets.
  )) as PagedDatastoreResponse | null;
  if (!data || !Array.isArray(data.records) || !Number.isFinite(data.total) || data.total < 0)
    throw new Error('The NCI catalogue returned an unexpected response.');
  return data;
}

export function mergeFilterOptions(options: FilterOptions[]): FilterOptions {
  const merged: FilterOptions = {};
  for (const fields of options) {
    for (const [field, values] of Object.entries(fields)) {
      merged[field] = [...new Set([...(merged[field] ?? []), ...values])].sort((a, b) => a.localeCompare(b));
    }
  }
  return merged;
}

/** Resolve ACCESS models from collection-wide facets, never from a paginated result. */
export function accessFilters(filters: FilterMap, options: FilterOptions): FilterMap | null {
  const models = (filters.source_id?.length ? filters.source_id : (options.source_id ?? [])).filter((model) =>
    /^ACCESS(?:-|$)/i.test(model),
  );
  // An empty source_id array means "all models" to both APIs. Do not send it.
  return models.length ? { ...filters, source_id: models } : null;
}

export async function fetchCmipNciOptions(project: CmipProject, signal: AbortSignal): Promise<FilterOptions> {
  const pages = await Promise.all(
    CMIP_COLLECTIONS[project].map(({ name }) => fetchCmipNciPage(name, {}, signal, 0, 1)),
  );
  const options = pages.map((page) => {
    const fields = page.dynamic_filter_options;
    if (
      !fields ||
      typeof fields !== 'object' ||
      Array.isArray(fields) ||
      Object.values(fields).some(
        (values) => !Array.isArray(values) || values.some((value) => value !== null && typeof value !== 'string'),
      ) ||
      (page.total > 0 && !fields.source_id?.length)
    ) {
      throw new Error('NCI filter options could not be loaded.');
    }
    // Optional metadata (such as parent_experiment_id) includes null for missing values.
    return Object.fromEntries(
      Object.entries(fields).map(([field, values]) => [field, values.filter((value) => value !== null)]),
    );
  });
  return mergeFilterOptions(options);
}
