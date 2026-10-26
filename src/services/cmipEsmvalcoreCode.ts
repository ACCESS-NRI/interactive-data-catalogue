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
  ['branding_suffix', 'branded_variable'],
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

/** Split CMIP7 Branded Variable values into their short names and branding suffixes. */
const getBrandedVariableFacets = (filters: FilterMap): { shortNames: string[]; suffixes: string[] } | null => {
  const brandedVariables = filters.branded_variable?.filter(Boolean) ?? [];
  const variableIds = filters.variable_id?.filter(Boolean) ?? [];
  const shortNames: string[] = [];
  const suffixes: string[] = [];

  for (const branded of brandedVariables) {
    const variableId = variableIds.length
      ? variableIds.filter((variable) => branded.startsWith(`${variable}_`)).sort((a, b) => b.length - a.length)[0]
      : branded.slice(0, branded.indexOf('_'));
    if (!variableId) return null;
    const suffix = branded.slice(variableId.length + 1);
    if (!suffix) return null;
    if (!shortNames.includes(variableId)) shortNames.push(variableId);
    if (!suffixes.includes(suffix)) suffixes.push(suffix);
  }

  return { shortNames, suffixes };
};

export const getCmipProject = (name: string): CmipProject | null => CMIP_DATASTORES.get(name) ?? null;

export const getUnmappedCmipFilters = (filters: FilterMap, project: CmipProject): string[] => {
  const mappedColumns = new Set<string>(facetsFor(project).flatMap(([, column]) => (column ? [column] : [])));
  if (project === 'CMIP7' && getBrandedVariableFacets(filters) === null) mappedColumns.delete('branded_variable');
  return Object.entries(filters)
    .filter(([column, values]) => values.length > 0 && !mappedColumns.has(column))
    .map(([column]) => column);
};

const pythonValue = (values: string[]): string =>
  values.length === 1 ? JSON.stringify(values[0]) : JSON.stringify(values);

/** Create a local CMIP facet search using the filters selected in the catalogue. */
export function buildCmipEsmvalcoreCode(filters: FilterMap, project: CmipProject): string {
  const brandedFacets = project === 'CMIP7' ? getBrandedVariableFacets(filters) : null;
  const facetLines = facetsFor(project).map(([facet, column]) => {
    let selected = column ? filters[column] : undefined;
    let comment = column ? `  # ${column}` : '';
    if (project === 'CMIP7' && facet === 'branding_suffix') selected = brandedFacets?.suffixes;
    if (project === 'CMIP7' && facet === 'short_name' && !selected?.length && brandedFacets?.shortNames.length) {
      selected = brandedFacets.shortNames;
      comment = '  # branded_variable';
    }
    return `    ${facet}=${selected?.length ? pythonValue(selected) : '"*"'},${comment}`;
  });

  return `"""
You will need to run this in an ARE session on Gadi: https://are.nci.org.au/pun/sys/dashboard

ESMValCore calls its search fields "facets". Comments beside some fields show
the matching catalogue filter (for example, short_name maps to variable_id).

A search may find many datasets. Add more catalogue filters, or replace '*'
values below, until only the dataset you want matches.
"""

from itertools import islice
from esmvalcore.dataset import Dataset

query = Dataset(
    project="${project}",
${facetLines.join('\n')}
)

# Show up to five matches to see whether the search needs narrowing.
matches = list(islice(query.from_files(), 5))
print(f"Showing {len(matches)} matching datasets (up to 5)")
for match in matches:
    print(match.facets)

if not matches:
    raise FileNotFoundError("No local ${project} data matched this search")
if len(matches) > 1:
    raise ValueError("Multiple local ${project} datasets matched; make the search above more specific")
cube = matches[0].load()
cube`;
}
