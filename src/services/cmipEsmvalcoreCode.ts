import type { FilterMap } from '../types/datastore';

export type CmipProject = 'CMIP6' | 'CMIP7';

const CMIP_DATASTORES = new Map<string, CmipProject>([
  ['cmip6_fs38', 'CMIP6'],
  ['cmip6_oi10', 'CMIP6'],
  ['cmip7_australian', 'CMIP7'],
  ['cmip7_replicated', 'CMIP7'],
]);

/** ESMValCore CMIP7 facets and the corresponding catalogue columns, in code display order. */
const CMIP7_FACETS = [
  ['drs_specs', null],
  ['short_name', 'variable_id'],
  ['branding_suffix', null],
  ['dataset', 'source_id'],
  ['exp', 'experiment_id'],
  ['ensemble', 'variant_label'],
  ['institute', 'institution_id'],
  ['activity', 'activity_id'],
  ['grid', 'grid_label'],
  ['frequency', 'frequency'],
  ['realm', 'realm'],
  ['region', 'region'],
] as const;

/** ESMValCore CMIP6 facets and the corresponding catalogue columns. */
const CMIP6_FACETS = [
  ['activity', null],
  ['short_name', 'variable_id'],
  ['dataset', 'source_id'],
  ['exp', 'experiment_id'],
  ['ensemble', 'member_id'],
  ['institute', 'institution_id'],
  ['mip', 'table_id'],
  ['grid', 'grid_label'],
  ['frequency', 'frequency'],
  ['realm', 'realm'],
] as const;

const facetsFor = (project: CmipProject) => (project === 'CMIP6' ? CMIP6_FACETS : CMIP7_FACETS);

export const getCmipProject = (name: string): CmipProject | null => CMIP_DATASTORES.get(name) ?? null;

export const getUnmappedCmipFilters = (filters: FilterMap, project: CmipProject): string[] => {
  const mappedColumns = new Set<string>(facetsFor(project).flatMap(([, column]) => (column ? [column] : [])));
  return Object.entries(filters)
    .filter(([column, values]) => values.length > 0 && !mappedColumns.has(column))
    .map(([column]) => column);
};

const pythonValue = (values: string[]): string =>
  values.length === 1 ? JSON.stringify(values[0]) : JSON.stringify(values);

/** Create a local CMIP facet search using the filters selected in the catalogue. */
export function buildCmipEsmvalcoreCode(filters: FilterMap, project: CmipProject): string {
  const facetLines = facetsFor(project).map(([facet, column]) => {
    const selected = column ? filters[column] : undefined;
    const comment = column ? `  # ${column}` : '';
    return `    ${facet}=${selected?.length ? pythonValue(selected) : '"*"'},${comment}`;
  });

  return `"""
You will need to run this in an ARE session on Gadi: https://are.nci.org.au/pun/sys/dashboard

A facet search may match many datasets. Select more filters in the catalogue,
or replace the '*' wildcards below, to narrow it down to one dataset to load.
"""

from itertools import islice
from esmvalcore.dataset import Dataset

query = Dataset(
    project="${project}",
${facetLines.join('\n')}
)

# Preview up to five matches to see which facets need narrowing.
matches = list(islice(query.from_files(), 5))
print(f"Showing {len(matches)} matching datasets (up to 5)")
for match in matches:
    print(match.facets)

if not matches:
    raise FileNotFoundError("No local ${project} data matched these facets")
if len(matches) > 1:
    raise ValueError("Multiple local ${project} datasets matched; narrow the facets above")
cube = matches[0].load()
cube`;
}
