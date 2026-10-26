const CMIP7_DEFAULT_FILTER_COLUMNS = [
  'frequency',
  'variable_id',
  'branded_variable',
  'source_id',
  'experiment_id',
  'realm',
];

export function getDefaultVisibleFilterColumns(datastoreName: string): string[] {
  if (datastoreName === 'esmvaltool-obs-ct11') return ['source_id', 'project_id', 'variable_id'];
  return datastoreName === 'cmip7_australian' || datastoreName === 'cmip7_replicated'
    ? CMIP7_DEFAULT_FILTER_COLUMNS
    : [];
}
