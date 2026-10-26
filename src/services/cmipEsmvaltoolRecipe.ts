import type { FilterMap } from '../types/datastore';
import type { CmipProject } from './cmipEsmvalcoreCode';

export interface CmipEsmvaltoolRecipe {
  yaml: string;
  missingSelections: string[];
  ignoredFilters: string[];
}

const DATASET_FIELDS = [
  ['exp', 'experiment_id'],
  ['ensemble', 'variant_label', 'member_id'],
  ['grid', 'grid_label'],
  ['institute', 'institution_id'],
  ['activity', 'activity_id'],
  ['frequency', 'frequency'],
  ['region', 'region'],
] as const;

const valuesFor = (filters: FilterMap, column: string): string[] => filters[column]?.filter(Boolean) ?? [];
const yamlString = (value: string): string => JSON.stringify(value);
const yamlValue = (values: string[]): string => JSON.stringify(values.length === 1 ? values[0] : values);

/** Build a preprocess-only ESMValTool recipe starter from the selected catalogue filters. */
export function buildCmipEsmvaltoolRecipe(filters: FilterMap, project: CmipProject): CmipEsmvaltoolRecipe {
  const missingSelections: string[] = [];
  const supportedColumns = new Set([
    'source_id',
    'experiment_id',
    project === 'CMIP7' ? 'variant_label' : 'member_id',
    'grid_label',
    'institution_id',
    'activity_id',
    'frequency',
    'realm',
    'variable_id',
    ...(project === 'CMIP7' ? ['region', 'branded_variable'] : ['table_id']),
  ]);
  const ignoredFilters = Object.entries(filters)
    .filter(([column, values]) => values?.length && !supportedColumns.has(column))
    .map(([column]) => column);
  const sourceIds = valuesFor(filters, 'source_id');
  const datasetLines = (sourceIds.length ? sourceIds : ['*']).flatMap((sourceId) => {
    const lines = [`  - project: ${yamlString(project)}`, `    dataset: ${yamlString(sourceId)}`];
    for (const [facet, ...columns] of DATASET_FIELDS) {
      if (project === 'CMIP6' && facet === 'region') continue;
      const values = valuesFor(filters, project === 'CMIP7' ? columns[0] : (columns[1] ?? columns[0]));
      if (values.length) lines.push(`    ${facet}: ${yamlValue(values)}`);
    }
    if (project === 'CMIP6') {
      const realms = valuesFor(filters, 'realm');
      if (realms.length) lines.push(`    realm: ${yamlValue(realms)}`);
    }
    return lines;
  });

  const mipValues = valuesFor(filters, project === 'CMIP7' ? 'realm' : 'table_id');
  if (mipValues.length !== 1) missingSelections.push(project === 'CMIP7' ? 'one Realm' : 'one Table Id');
  const mip =
    mipValues.length === 1 ? mipValues[0]! : 'REPLACE_WITH_ONE_' + (project === 'CMIP7' ? 'REALM' : 'TABLE_ID');

  const variables = valuesFor(filters, 'variable_id');
  const brandedVariables = project === 'CMIP7' ? valuesFor(filters, 'branded_variable') : [];
  const brandedByVariable = new Map<string, { key: string; suffix: string }[]>();
  for (const branded of brandedVariables) {
    const separator = branded.indexOf('_');
    if (separator <= 0 || separator === branded.length - 1) continue;
    const variable = branded.slice(0, separator);
    const entries = brandedByVariable.get(variable) ?? [];
    entries.push({ key: branded, suffix: branded.slice(separator + 1) });
    brandedByVariable.set(variable, entries);
  }

  const selectedVariables = variables.length ? variables : [...brandedByVariable.keys()];
  if (!selectedVariables.length) missingSelections.push('Variable Id');
  const variableLines: string[] = [];
  for (const variable of selectedVariables.length ? selectedVariables : ['REPLACE_WITH_VARIABLE_ID']) {
    const brandedEntries = brandedByVariable.get(variable) ?? [{ key: variable, suffix: '' }];
    for (const { key, suffix } of brandedEntries) {
      variableLines.push(`      ${yamlString(key)}:`);
      variableLines.push(`        short_name: ${yamlString(variable)}`);
      variableLines.push(`        mip: ${yamlString(mip)}`);
      if (project === 'CMIP7') {
        if (!suffix && !missingSelections.includes('Branded Variable')) missingSelections.push('Branded Variable');
        variableLines.push(`        branding_suffix: ${yamlString(suffix || 'REPLACE_WITH_BRANDING_SUFFIX')}`);
      }
    }
  }

  const sourceComment = sourceIds.length ? '' : '# No Source Id selected: dataset "*" searches all available models.\n';
  const mipComment =
    project === 'CMIP7'
      ? '# For CMIP7, mip is the selected Realm; branding_suffix comes from Branded Variable.\n'
      : '# For CMIP6, mip is the selected Table Id.\n';
  const yaml = `# Save as recipe_catalogue.yml.
# Run: esmvaltool run --remove_preproc_dir=False recipe_catalogue.yml
# This starter preprocesses data only; add a diagnostic script for analysis.
# Review combinations when more than one value is selected in a filter.
${mipComment}${sourceComment}datasets:
${datasetLines.join('\n')}

diagnostics:
  catalogue_selection:
    description: Preprocess CMIP data selected in the ACCESS catalogue.
    variables:
${variableLines.join('\n')}
    scripts: null`;

  return { yaml, missingSelections, ignoredFilters };
}
