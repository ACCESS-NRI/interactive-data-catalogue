import type { FilterMap } from '../types/datastore';

const CMIP7_DATASTORES = new Set(['cmip7_australian', 'cmip7_replicated']);

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

const mappedColumns = new Set<string>(CMIP7_FACETS.flatMap(([, column]) => (column ? [column] : [])));

export const isCmip7Datastore = (name: string): boolean => CMIP7_DATASTORES.has(name);

export const getUnmappedCmip7Filters = (filters: FilterMap): string[] =>
  Object.entries(filters)
    .filter(([column, values]) => values.length > 0 && !mappedColumns.has(column))
    .map(([column]) => column);

const pythonValue = (values: string[]): string =>
  values.length === 1 ? JSON.stringify(values[0]) : JSON.stringify(values);

/** Create a local CMIP7 facet search using the filters selected in the catalogue. */
export function buildCmip7EsmvalcoreCode(filters: FilterMap): string {
  const facetLines = CMIP7_FACETS.map(([facet, column]) => {
    const selected = column ? filters[column] : undefined;
    const comment = column ? `  # ${column}` : '';
    return `    ${facet}=${selected?.length ? pythonValue(selected) : '"*"'},${comment}`;
  });

  return `# Run in a Gadi environment with ESMValCore and a local CMIP7 data source configured.
# Select more filters in the catalogue, or replace the '*' wildcards below.
from itertools import islice
from esmvalcore.dataset import Dataset

query = Dataset(
    project="CMIP7",
${facetLines.join('\n')}
)

# Inspect a few matches before choosing one to load.
matches = list(islice(query.from_files(), 5))
print(f"Found {len(matches)} matching datasets (showing at most 5)")
for match in matches:
    print(match.facets)

# Narrow the facets above if there are many matches, then load one as an Iris cube.
if not matches:
    raise FileNotFoundError("No local CMIP7 data matched these facets")
cube = matches[0].load()
cube`;
}
