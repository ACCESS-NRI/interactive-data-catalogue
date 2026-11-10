import { buildEsmDatastoreTableUrl } from '../config/catalogEndpoints';
import type { FilterMap, FilterOptions, PagedDatastoreResponse } from '../types/datastore';
import type { CmipProject } from './cmipEsmvalcoreCode';

// Public, CORS-enabled services used by Metagrid. Kept configurable for deployments
// that prefer a same-origin proxy or a different federation index.
const solrEndpoint = import.meta.env.VITE_ESGF_CMIP6_SEARCH_URL || 'https://esgf.ceda.ac.uk/esg-search/search';
const stacEndpoint = import.meta.env.VITE_ESGF_CMIP7_SEARCH_URL || 'https://search.east.esgf.io/search';
export const ESGF_PAGE_SIZE = 10;

const sharedFacets = [
  'institution_id',
  'source_id',
  'experiment_id',
  'variable_id',
  'grid_label',
  'frequency',
  'realm',
];
const facetMaps: Record<CmipProject, Record<string, string>> = {
  CMIP6: {
    ...Object.fromEntries(sharedFacets.map((key) => [key, key])),
    project_id: 'activity_id',
    member_id: 'member_id',
    table_id: 'table_id',
    version: 'version',
  },
  CMIP7: {
    ...Object.fromEntries(
      [
        ...sharedFacets,
        'activity_id',
        'area_label',
        'region',
        'horizontal_label',
        'license_id',
        'nominal_resolution',
        'product',
        'temporal_label',
        'variant_label',
        'vertical_label',
        'parent_experiment_id',
      ].map((key) => [key, key]),
    ),
    branded_variable: 'variable_branded_name',
    long_name: 'variable_long_name',
    standard_name: 'variable_cf_standard_name',
    units: 'variable_units',
  },
};

export function getReplicaProject(name: string): CmipProject | null {
  return name === 'cmip6_oi10' ? 'CMIP6' : name === 'cmip7_replicated' ? 'CMIP7' : null;
}

export function unsupportedEsgfFilters(project: CmipProject, filters: FilterMap): string[] {
  return Object.keys(filters).filter((key) => filters[key]?.length && !facetMaps[project][key]);
}

export interface EsgfDataset {
  id: string;
  project: CmipProject;
  version: string;
  facets: FilterMap;
  nodes: string[];
  fileCount: number | null;
  size: number | null;
  portalUrl: string;
}

export interface EsgfPage {
  datasets: EsgfDataset[];
  total: number | null;
  next: string | null;
}

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
const strings = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value])
    .filter((item): item is string | number => typeof item === 'string' || typeof item === 'number')
    .map(String);
const first = (value: unknown) => strings(value)[0] || '';
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null);

export async function fetchEsgfJson(url: string, signal: AbortSignal, timeoutMs = 20_000): Promise<unknown> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, timeout.signal]),
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Search service returned HTTP ${response.status}.`);
    return await response.json();
  } catch (cause) {
    if (timeout.signal.aborted && !signal.aborted)
      throw new Error('Search timed out. Try again or narrow your filters.');
    throw cause;
  } finally {
    clearTimeout(timer);
  }
}

export function buildEsgfSearchUrl(project: CmipProject, filters: FilterMap, cursor?: string): string {
  const unsupported = unsupportedEsgfFilters(project, filters);
  if (unsupported.length)
    throw new Error(`ESGF cannot apply these filters: ${unsupported.join(', ')}. Remove them to search ESGF.`);
  const url = new URL(project === 'CMIP6' ? solrEndpoint : stacEndpoint, window.location.origin);
  const mapped = Object.entries(filters)
    .filter(([, values]) => values?.length)
    .map(([key, values]) => [facetMaps[project][key]!, values] as const);
  url.searchParams.set('limit', String(ESGF_PAGE_SIZE));
  if (project === 'CMIP6') {
    for (const [key, value] of Object.entries({
      project,
      type: 'Dataset',
      format: 'application/solr+json',
      distrib: 'true',
      retracted: 'false',
      offset: cursor || '0',
    })) {
      url.searchParams.set(key, value);
    }
    if (!filters.version?.length) url.searchParams.set('latest', 'true');
    // Include replicas: some datasets are only indexed at replica nodes.
    for (const [key, values] of mapped)
      for (const value of values) {
        url.searchParams.append(key, key === 'version' ? value.replace(/^v/, '') : value);
      }
  } else {
    const equals = (property: string, value: unknown) => ({ op: '=', args: [{ property }, value] });
    const args = [
      equals('properties.latest', true),
      equals('properties.retracted', false),
      ...mapped.map(([key, values]) => {
        const choices = values.map((value) => {
          // The catalogue joins multi-realm arrays with spaces; STAC retains arrays.
          const terms = key === 'realm' ? value.trim().split(/\s+/) : [value];
          const matches = terms.map((term) => equals(`properties.cmip7:${key}`, term));
          return matches.length === 1 ? matches[0]! : { op: 'and', args: matches };
        });
        return choices.length === 1 ? choices[0]! : { op: 'or', args: choices };
      }),
    ];
    url.searchParams.set('collections', project);
    url.searchParams.set('filter-lang', 'cql2-json');
    url.searchParams.set('filter', JSON.stringify({ op: 'and', args }));
    if (cursor) url.searchParams.set('token', cursor);
  }
  return url.toString();
}

/** Discover choices across the full matching search, independently of result pages. */
export async function fetchEsgfFilterOptions(
  project: CmipProject,
  signal: AbortSignal,
  filters: FilterMap = {},
): Promise<FilterOptions> {
  const fields = Object.entries(facetMaps[project]);
  const url = new URL(buildEsgfSearchUrl(project, filters));
  if (project === 'CMIP6') {
    url.searchParams.set('limit', '0');
    url.searchParams.set('facets', fields.map(([, remote]) => remote).join(','));
  } else {
    url.pathname = url.pathname.replace(/\/search\/?$/, '/aggregate');
    url.searchParams.set('limit', '10000');
    url.searchParams.set('aggregations', fields.map(([, remote]) => `cmip7_${remote}_frequency`).join(','));
  }
  const data = object(await fetchEsgfJson(url.toString(), signal));
  if (object(data.responseHeader).partialResults) throw new Error('ESGF returned an incomplete list of filter values.');
  const options: FilterOptions = {};
  for (const [local, remote] of fields) {
    let values: string[];
    if (project === 'CMIP6') {
      const counts = object(object(data.facet_counts).facet_fields)[remote];
      if (!Array.isArray(counts) || counts.length % 2) throw new Error('Invalid ESGF filter options response.');
      values = [];
      for (let i = 0; i < counts.length; i += 2) {
        if (typeof counts[i] !== 'string' || count(counts[i + 1]) === null)
          throw new Error('Invalid ESGF filter options response.');
        if (counts[i + 1] > 0) values.push(counts[i]);
      }
      if (local === 'version') values = values.map((value) => `v${value.replace(/^v/, '')}`);
    } else {
      const aggregation = object(
        Array.isArray(data.aggregations)
          ? data.aggregations.find((entry) => object(entry).name === `cmip7_${remote}_frequency`)
          : undefined,
      );
      if (!Array.isArray(aggregation.buckets)) throw new Error('Invalid ESGF filter options response.');
      if (typeof aggregation.overflow === 'number' && aggregation.overflow > 0)
        throw new Error('ESGF returned an incomplete list of filter values.');
      values = aggregation.buckets.flatMap((entry) => {
        const bucket = object(entry);
        if (typeof bucket.key !== 'string' || count(bucket.frequency) === null)
          throw new Error('Invalid ESGF filter options response.');
        return Number(bucket.frequency) > 0 ? [bucket.key] : [];
      });
    }
    options[local] = [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }
  return options;
}

function portalUrl(project: CmipProject, facets: FilterMap, version: string, id: string): string {
  const url = new URL(project === 'CMIP6' ? 'https://esgf-ui.ceda.ac.uk/search' : 'https://esgf.nci.org.au/search');
  url.searchParams.set('project', project);
  // Metagrid's CMIP7 facet picker does not yet accept variable_branded_name.
  // Use the short variable and its four branding labels for the same identity.
  const portalFields =
    project === 'CMIP7'
      ? [
          ...identityFields[project].filter((key) => key !== 'branded_variable'),
          'variable_id',
          'temporal_label',
          'vertical_label',
          'horizontal_label',
          'area_label',
        ]
      : identityFields[project];
  const activeFacets = Object.fromEntries(
    portalFields.filter((key) => facets[key]?.length).map((key) => [facetMaps[project][key], facets[key]]),
  );
  // Metagrid supports version bounds for both search backends.
  url.searchParams.set('activeFacets', JSON.stringify(activeFacets));
  if (project === 'CMIP6') {
    url.searchParams.set('textInputs', JSON.stringify([`instance_id:"${id.replace(/[\\"]/g, '\\$&')}"`]));
  }
  if (version) {
    url.searchParams.set('versionType', 'all');
    url.searchParams.set('minVersionDate', version.replace(/^v/, ''));
    url.searchParams.set('maxVersionDate', version.replace(/^v/, ''));
  }
  return url.toString();
}

export function mergeEsgfDatasets(datasets: EsgfDataset[]): EsgfDataset[] {
  const merged = new Map<string, EsgfDataset>();
  for (const dataset of datasets) {
    const previous = merged.get(dataset.id);
    merged.set(dataset.id, { ...dataset, nodes: [...new Set([...(previous?.nodes || []), ...dataset.nodes])] });
  }
  return [...merged.values()];
}

export async function searchEsgf(
  project: CmipProject,
  filters: FilterMap,
  signal: AbortSignal,
  cursor?: string,
): Promise<EsgfPage> {
  const url = buildEsgfSearchUrl(project, filters, cursor);
  const body = object(await fetchEsgfJson(url, signal));
  const response = object(body.response);
  if (object(body.responseHeader).partialResults === true) {
    throw new Error('ESGF returned an incomplete search. Please retry.');
  }
  const docs = project === 'CMIP6' ? response.docs : body.features;
  const total = count(project === 'CMIP6' ? response.numFound : body.numberMatched);
  if (!Array.isArray(docs) || (project === 'CMIP6' && total === null))
    throw new Error('The ESGF service returned an unexpected response.');
  const datasets = docs.map((raw): EsgfDataset => {
    const doc = object(raw);
    const metadata = project === 'CMIP6' ? doc : object(doc.properties);
    const id = first(project === 'CMIP6' ? metadata.instance_id : doc.id);
    if (!id) throw new Error('An ESGF dataset is missing its versioned identifier.');
    const facets: FilterMap = {};
    for (const [local, remote] of Object.entries(facetMaps[project])) {
      const values = strings(metadata[project === 'CMIP6' ? remote : `cmip7:${remote}`]);
      if (values.length && local !== 'version') facets[local] = values;
    }
    const assets = Object.values(object(doc.assets)).map(object);
    const nodes =
      project === 'CMIP6'
        ? strings(metadata.data_node)
        : assets.flatMap((asset) => {
            const alternates = Object.values(object(asset.alternate)).map(object);
            return [asset, ...alternates].flatMap((item) => {
              const name = first(item['alternate:name']);
              if (name) return [name];
              try {
                return [new URL(first(item.href)).hostname];
              } catch {
                return [];
              }
            });
          });
    const version = first(metadata.version);
    return {
      id,
      project,
      version,
      facets,
      nodes: [...new Set(nodes)],
      fileCount:
        project === 'CMIP6'
          ? count(metadata.number_of_files)
          : assets.filter((asset) => count(asset['file:size']) !== null).length,
      size: count(metadata.size),
      portalUrl: portalUrl(project, facets, version, id),
    };
  });
  let next: string | null = null;
  if (project === 'CMIP6') {
    const offset = Number(cursor || 0) + docs.length;
    if (docs.length && offset < total!) next = String(offset);
  } else if (Array.isArray(body.links)) {
    const link = body.links.map(object).find((link) => link.rel === 'next');
    // Only reuse the cursor, never fetch an arbitrary URL supplied by the index.
    if (link && typeof link.href === 'string') next = new URL(link.href, url).searchParams.get('token');
  }
  return { datasets: mergeEsgfDatasets(datasets), total, next };
}

export type NciStatus = 'checking' | 'listed' | 'different-version' | 'version-unverified' | 'missing' | 'unknown';
export interface NciAvailability {
  status: NciStatus;
  collections: string[];
}

const identityFields: Record<CmipProject, string[]> = {
  CMIP6: [
    'project_id',
    'institution_id',
    'source_id',
    'experiment_id',
    'member_id',
    'table_id',
    'variable_id',
    'grid_label',
  ],
  CMIP7: [
    'activity_id',
    'institution_id',
    'source_id',
    'experiment_id',
    'variant_label',
    'region',
    'frequency',
    'branded_variable',
    'grid_label',
  ],
};

export async function checkNciAvailability(dataset: EsgfDataset, signal: AbortSignal): Promise<NciAvailability> {
  const fields = identityFields[dataset.project];
  // Partial metadata cannot establish absence. Do not widen the query silently.
  if (fields.some((key) => dataset.facets[key]?.length !== 1)) return { status: 'unknown', collections: [] };
  const filters = Object.fromEntries(fields.map((key) => [key, dataset.facets[key]!])) as FilterMap;
  const collections =
    dataset.project === 'CMIP6' ? ['cmip6_oi10', 'cmip6_fs38'] : ['cmip7_replicated', 'cmip7_australian'];
  const results = await Promise.allSettled(
    collections.map(async (name) => {
      const params = new URLSearchParams({ limit: '1', offset: '0', filters: JSON.stringify(filters) });
      const data = object(await fetchEsgfJson(buildEsmDatastoreTableUrl(name, params.toString()), signal));
      if (count(data.total) === null || !Array.isArray(data.records)) throw new Error('Invalid NCI catalogue response');
      return { name, data: data as unknown as PagedDatastoreResponse };
    }),
  );
  signal.throwIfAborted();
  const found = results.flatMap((result) =>
    result.status === 'fulfilled' && result.value.data.total > 0 ? [result.value] : [],
  );
  const names = found.map(({ name }) => name);
  if (found.length) {
    if (!dataset.version) return { status: 'version-unverified', collections: names };
    if (dataset.project === 'CMIP7') {
      // The table API omits CMIP7 versions and paths. Compare the actual paths
      // in each matching catalogue, not just the first displayed file.
      const { fetchCmipNciVersions } = await import('./cmipNciVersions');
      const versions = await Promise.allSettled(
        found.map(async ({ name }) => ({
          name,
          values: await fetchCmipNciVersions(dataset.project, name, filters, signal),
        })),
      );
      signal.throwIfAborted();
      const checked = versions.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      const matching = checked.filter(({ values }) => values.includes(`v${dataset.version.replace(/^v/, '')}`));
      if (matching.length) return { status: 'listed', collections: matching.map(({ name }) => name) };
      if (
        checked.length !== found.length ||
        checked.some(({ values }) => !values.length) ||
        results.some((result) => result.status === 'rejected')
      ) {
        return { status: 'unknown', collections: names };
      }
      return {
        status: checked.every(({ values }) => values.every((value) => value !== null && /^v[0-9]{8}$/.test(value)))
          ? 'different-version'
          : 'version-unverified',
        collections: names,
      };
    }
    const version = dataset.version.replace(/^v/, '');
    if (found.some(({ data }) => data.dynamic_filter_options?.version?.some((v) => v.replace(/^v/, '') === version))) {
      return { status: 'listed', collections: names };
    }
    const versionsComplete = found.every(({ data }) => (data.dynamic_filter_options?.version?.length || 0) > 0);
    return {
      status: versionsComplete && results.every((r) => r.status === 'fulfilled') ? 'different-version' : 'unknown',
      collections: names,
    };
  }
  return { status: results.every((result) => result.status === 'fulfilled') ? 'missing' : 'unknown', collections: [] };
}
