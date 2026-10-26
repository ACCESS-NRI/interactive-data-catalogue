const CMIP7_DEFAULT_FILTER_COLUMNS = ['frequency', 'variable_id', 'source_id', 'experiment_id', 'realm'];

export function getDefaultVisibleFilterColumns(datastoreName: string): string[] {
  return datastoreName === 'cmip7_australian' || datastoreName === 'cmip7_replicated'
    ? CMIP7_DEFAULT_FILTER_COLUMNS
    : [];
}
