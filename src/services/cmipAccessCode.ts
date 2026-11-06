import { dump, load } from 'js-yaml';
import type { FilterMap } from '../types/datastore';
import { CMIP_COLLECTIONS } from './cmipSearch';
import { cmipFacetChoices, getUnmappedCmipFilters, type CmipProject } from './cmipEsmvalcoreCode';
import { buildCmipEsmvaltoolRecipe } from './cmipEsmvaltoolRecipe';

// NCI publication and replica roots. Directory templates follow ESMValCore's
// data-hpc-nci.yml (CMIP6) and data-local.yml (CMIP7).
const ROOTS: Record<CmipProject, string[]> = {
  CMIP6: ['/g/data/fs38/publications', '/g/data/oi10/replicas'],
  CMIP7: ['/g/data/im55/publications', '/g/data/ib12/replicas'],
};

export const cmipStorageProjects = (project: CmipProject) => [
  'xp65',
  ...ROOTS[project].map((root) => root.split('/')[3]!),
];

export function cmipDataSources(project: CmipProject) {
  const dirname =
    project === 'CMIP6'
      ? '{project}/{activity}/{institute}/{dataset}/{exp}/{ensemble}/{mip}/{short_name}/{grid}/{version}'
      : '{drs_specs}/{project}/{activity}/{institute}/{dataset}/{exp}/{ensemble}/{region}/{frequency}/{short_name}/{branding_suffix}/{grid}/{version}';
  const filename =
    project === 'CMIP6'
      ? '{short_name}_{mip}_{dataset}_{exp}_{ensemble}_{grid}*.nc'
      : '{short_name}_{branding_suffix}_{frequency}_{region}_{grid}_{dataset}_{exp}_{ensemble}*.nc';
  return Object.fromEntries(
    CMIP_COLLECTIONS[project].map(({ name }, index) => [
      name,
      {
        type: 'esmvalcore.io.local.LocalDataSource',
        rootpath: ROOTS[project][index]!,
        dirname_template: dirname,
        filename_template: filename,
        priority: index,
      },
    ]),
  );
}

export function buildCmipIntakeCode(filters: FilterMap, project: CmipProject): string {
  const selected = Object.fromEntries(Object.entries(filters).filter(([, values]) => values.length));
  return `# Run on Gadi in an environment with intake and access-nri-intake-catalog.
# Narrow the catalogue filters before opening a large selection.
import re
import intake
from dask.distributed import Client

client = Client(threads_per_worker=1)
collections = ${JSON.stringify(CMIP_COLLECTIONS[project].map(({ name }) => name))}
selected = ${JSON.stringify(selected, null, 4)}
# Match selected values exactly, including characters with regex meanings.
filters = {key: [f"^{re.escape(value)}$" for value in values]
           for key, values in selected.items()}

catalogues = {}
for name in collections:
    catalogue = intake.cat.access_nri[name]
    missing = set(filters) - set(catalogue.df.columns)
    if missing:
        raise ValueError(f"{name} cannot apply these filters: {sorted(missing)}")
    match = catalogue.search(**filters) if filters else catalogue
    if len(match.df):
        catalogues[name] = match
    print(f"{name}: {len(match.df)} matching files")

if not catalogues:
    raise FileNotFoundError("No ${project} files at NCI match these filters")

# Each collection keeps its own aggregation rules. Prefix keys so that
# a dataset from one collection cannot overwrite one from the other.
dataset_dict = {}
for name, catalogue in catalogues.items():
    for key, dataset in catalogue.to_dataset_dict().items():
        dataset_dict[f"{name}:{key}"] = dataset
dataset_dict`;
}

export function buildCmipCollectionCoreCode(filters: FilterMap, project: CmipProject): string {
  const unsupported = getUnmappedCmipFilters(filters, project);
  const { facets, variables } = cmipFacetChoices(filters, project);
  return `# Run on Gadi with a current ESMValCore environment supporting ${project}.
from itertools import product
from esmvalcore.config import CFG
from esmvalcore.dataset import Dataset

# Search both NCI collections, including when the first has matches.
CFG["projects"]["${project}"]["data"] = ${JSON.stringify(cmipDataSources(project), null, 4)}
CFG["search_data"] = "complete"
${unsupported.length ? `\nraise ValueError(${JSON.stringify(`Remove filters not supported by ESMValCore before running: ${unsupported.join(', ')}`)})\n` : ''}
# Expand selected values into scalar queries, keeping branded variables paired.
facet_options = ${JSON.stringify(facets, null, 4)}
variable_options = ${JSON.stringify(variables, null, 4)}
datasets = []
for values in product(*facet_options.values()):
    facets = dict(zip(facet_options, values))
    for variable in variable_options:
        query = Dataset(project="${project}", **facets, **variable)
        datasets.extend(query.from_files())
if not datasets:
    raise FileNotFoundError("No ${project} data at NCI match these facets")
for index, dataset in enumerate(datasets):
    print(index, dataset.facets)

# After narrowing the search, load all matching datasets as separate Iris cubes.
cubes = [dataset.load() for dataset in datasets]
cubes`;
}

export function buildCmipCollectionRecipe(filters: FilterMap, project: CmipProject) {
  const { variables } = cmipFacetChoices(filters, project);
  const pairedNames = variables.flatMap((variable) => (variable.short_name ? [variable.short_name] : []));
  const base = buildCmipEsmvaltoolRecipe(
    pairedNames.length ? { ...filters, variable_id: [...new Set(pairedNames)] } : filters,
    project,
  );
  const recipe = load(base.yaml) as { datasets: Record<string, unknown>[] };
  // Expand lists into separate datasets: not every facet accepts list values.
  recipe.datasets = recipe.datasets.flatMap((dataset) => {
    let entries: Record<string, unknown>[] = [{}];
    for (const [key, value] of Object.entries(dataset)) {
      entries = entries.flatMap((entry) =>
        (Array.isArray(value) ? value : [value]).map((item) => ({ ...entry, [key]: item })),
      );
    }
    return entries.map((entry) => ({
      exp: '*',
      ensemble: '*',
      institute: '*',
      grid: '*',
      timerange: '*',
      ...entry,
    }));
  });
  return {
    ...base,
    ignoredFilters: [...new Set([...base.ignoredFilters, ...getUnmappedCmipFilters(filters, project)])],
    yaml:
      '# Save as recipe_cmip.yml. Preprocesses all matching datasets across both NCI collections.\n' +
      dump(recipe, { lineWidth: 110, noRefs: true, quotingType: '"', forceQuotes: true }),
    config:
      '# Save as cmip-config/data.yml (create the cmip-config directory first).\n' +
      dump(
        { search_data: 'complete', projects: { [project]: { data: cmipDataSources(project) } } },
        { lineWidth: 160, noRefs: true },
      ),
    command: 'esmvaltool run --config_dir ./cmip-config --remove_preproc_dir=False recipe_cmip.yml',
  };
}
