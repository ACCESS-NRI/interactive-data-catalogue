import type { FilterMap } from '../types/datastore';

export const ESMVAL_OBSERVATION_DATASTORE = 'esmvaltool-obs-ct11';

const OBSERVATION_PROJECTS = new Set(['OBS', 'OBS6', 'obs4MIPs']);

export interface ObservationExample {
  missingSelections: string[];
  ignoredFilters: string[];
}

export interface ObservationPythonExample extends ObservationExample {
  code: string;
}

export interface ObservationRecipeExample extends ObservationExample {
  yaml: string;
}

const valuesFor = (filters: FilterMap, column: string): string[] => filters[column]?.filter(Boolean) ?? [];
const tableIdsFor = (filters: FilterMap): string[] =>
  valuesFor(filters, 'table_id').filter((value) => value !== 'unknown');
const quoted = (value: string): string => JSON.stringify(value);
const valueOrList = (values: string[] | number[]): string => JSON.stringify(values.length === 1 ? values[0] : values);
const selectedProject = (filters: FilterMap): string | null => {
  const projects = valuesFor(filters, 'project_id');
  return projects.length === 1 && OBSERVATION_PROJECTS.has(projects[0]!) ? projects[0]! : null;
};
const selectedTier = (filters: FilterMap): number[] =>
  valuesFor(filters, 'tier')
    .map((tier) => (/^Tier[1-3]$/.test(tier) ? Number(tier.slice(4)) : NaN))
    .filter(Number.isFinite);

const ignoredFilters = (filters: FilterMap, project: string | null): string[] => {
  const supported = new Set([
    'project_id',
    'source_id',
    'variable_id',
    'table_id',
    'tier',
    ...(project === 'obs4MIPs' ? [] : ['experiment_id', 'version']),
  ]);
  return Object.entries(filters)
    .filter(
      ([column, values]) =>
        values?.length && (!supported.has(column) || (column === 'table_id' && !tableIdsFor(filters).length)),
    )
    .map(([column]) => column);
};

/** Build a local ESMValCore search using the observation collection's catalogue columns. */
export function buildObservationPythonExample(filters: FilterMap): ObservationPythonExample {
  const project = selectedProject(filters);
  const missingSelections = project ? [] : ['one Project Id'];
  const facets = [
    `    project=${quoted(project ?? 'REPLACE_WITH_ONE_PROJECT_ID')},  # project_id`,
    `    dataset=${valueOrList(valuesFor(filters, 'source_id').length ? valuesFor(filters, 'source_id') : ['*'])},  # source_id`,
    `    short_name=${valueOrList(valuesFor(filters, 'variable_id').length ? valuesFor(filters, 'variable_id') : ['*'])},  # variable_id`,
    `    mip=${valueOrList(tableIdsFor(filters).length ? tableIdsFor(filters) : ['*'])},  # table_id`,
  ];
  if (project === 'OBS' || project === 'OBS6') {
    facets.push(
      `    type=${valueOrList(valuesFor(filters, 'experiment_id').length ? valuesFor(filters, 'experiment_id') : ['*'])},  # experiment_id`,
    );
    facets.push(
      `    version=${valueOrList(valuesFor(filters, 'version').length ? valuesFor(filters, 'version') : ['*'])},  # version`,
    );
  }
  const tiers = selectedTier(filters);
  facets.push(`    tier=${tiers.length ? valueOrList(tiers) : '"*"'},  # tier (Tier3 in the catalogue becomes 3)`);

  const code = `"""
You will need to run this in an ARE session on Gadi: https://are.nci.org.au/pun/sys/dashboard

Select one Project Id: this collection contains OBS, OBS6, and obs4MIPs.
Source Id is the observation dataset. For OBS and OBS6, Experiment Id is
the observation type. A search may find many datasets; narrow the filters
or replace '*' values until only the data you want matches.
"""

from itertools import islice
from esmvalcore.dataset import Dataset

query = Dataset(
${facets.join('\n')}
)

# Show up to five matches before loading data.
matches = list(islice(query.from_files(), 5))
for match in matches:
    print(match.facets)

if not matches:
    raise FileNotFoundError("No local observation data matched this search")
if len(matches) > 1:
    raise ValueError("Multiple observation datasets matched; make the search more specific")
cube = matches[0].load()
cube`;

  return { code, missingSelections, ignoredFilters: ignoredFilters(filters, project) };
}

/** Build a preprocess-only ESMValTool recipe starter for OBS, OBS6, or obs4MIPs. */
export function buildObservationRecipeExample(filters: FilterMap): ObservationRecipeExample {
  const project = selectedProject(filters);
  const missingSelections: string[] = [];
  if (!project) missingSelections.push('one Project Id');

  const sourceIds = valuesFor(filters, 'source_id');
  const datasetLines = (sourceIds.length ? sourceIds : ['*']).flatMap((sourceId) => {
    const lines = [
      `  - project: ${quoted(project ?? 'REPLACE_WITH_ONE_PROJECT_ID')}`,
      `    dataset: ${quoted(sourceId)}`,
    ];
    if (project === 'OBS' || project === 'OBS6') {
      const types = valuesFor(filters, 'experiment_id');
      const versions = valuesFor(filters, 'version');
      if (types.length !== 1 && !missingSelections.includes('one Experiment Id (observation type)')) {
        missingSelections.push('one Experiment Id (observation type)');
      }
      if (versions.length !== 1 && !missingSelections.includes('one Version')) missingSelections.push('one Version');
      lines.push(`    type: ${quoted(types.length === 1 ? types[0]! : 'REPLACE_WITH_OBSERVATION_TYPE')}`);
      lines.push(`    version: ${quoted(versions.length === 1 ? versions[0]! : 'REPLACE_WITH_VERSION')}`);
    }
    const tiers = selectedTier(filters);
    const inferredTier = project === 'OBS' ? 2 : project === 'obs4MIPs' ? 1 : null;
    if (tiers.length !== 1 && inferredTier === null && !missingSelections.includes('one Tier')) {
      missingSelections.push('one Tier');
    }
    lines.push(`    tier: ${tiers.length === 1 ? tiers[0] : (inferredTier ?? quoted('REPLACE_WITH_TIER_NUMBER'))}`);
    return lines;
  });

  const tableIds = tableIdsFor(filters);
  if (tableIds.length !== 1) missingSelections.push('one Table Id (CMOR table)');
  const mip = tableIds.length === 1 ? tableIds[0]! : 'REPLACE_WITH_ONE_TABLE_ID';
  const variables = valuesFor(filters, 'variable_id');
  if (!variables.length) missingSelections.push('Variable Id');
  const variableLines = (variables.length ? variables : ['REPLACE_WITH_VARIABLE_ID']).flatMap((variable) => [
    `      ${quoted(variable)}:`,
    `        short_name: ${quoted(variable)}`,
    `        mip: ${quoted(mip)}`,
  ]);

  const sourceComment = sourceIds.length
    ? ''
    : '# No Source Id selected: dataset "*" searches all observation datasets.\n';
  const yaml = `# Save as recipe_observations.yml.
# Run from a Gadi shell or batch job: esmvaltool run --remove_preproc_dir=False recipe_observations.yml
# This starter preprocesses data only; add a diagnostic script for analysis.
# Project Id selects OBS, OBS6, or obs4MIPs; Source Id is the observation dataset.
# For OBS and OBS6, Experiment Id maps to type. Table Id maps to mip.
# If Table Id is unknown, choose the appropriate CMOR table in the recipe.
${sourceComment}datasets:
${datasetLines.join('\n')}

diagnostics:
  observation_selection:
    description: Preprocess curated observations selected in the ACCESS catalogue.
    variables:
${variableLines.join('\n')}
    scripts: null`;

  return { yaml, missingSelections, ignoredFilters: ignoredFilters(filters, project) };
}
