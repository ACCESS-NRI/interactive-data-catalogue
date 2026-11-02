import { DuckDBDataProtocol } from '@duckdb/duckdb-wasm';
import { buildDatastoreDescriptorUrl, buildDatastoreObjectStoreUrl } from '../config/catalogEndpoints';
import type { DatastoreRow, FilterMap } from '../types/datastore';
import { initializeDuckDB } from './duckdbClient';

export interface DatasetPath {
  id: string;
  path: string;
  fileCount: number;
}

export interface DatastorePathPage {
  datasets: DatasetPath[];
  hasMore: boolean;
  groupedByDirectory?: boolean;
}

interface DatasetGrouping {
  columns: string[];
  pathColumn: string;
}

/** Use the same aggregation columns as Intake, rather than guessing from filenames. */
export async function fetchDatasetGrouping(datastoreName: string): Promise<DatasetGrouping> {
  const response = await fetch(buildDatastoreDescriptorUrl(datastoreName));
  if (!response.ok) throw new Error(`Unable to load dataset grouping: HTTP ${response.status}.`);
  const descriptor = await response.json();
  const columns = descriptor.aggregation_control?.groupby_attrs ?? [];
  const pathColumn = descriptor.assets?.column_name;
  if (
    !Array.isArray(columns) ||
    !columns.every((column) => typeof column === 'string') ||
    typeof pathColumn !== 'string'
  ) {
    throw new Error('This catalogue does not provide valid dataset grouping information.');
  }
  // With no aggregation columns, Intake treats each asset as a dataset.
  return { columns: columns.length ? columns : [pathColumn], pathColumn };
}

/** The first and last sorted paths determine the common directory of the entire group. */
export function commonDatasetDirectory(firstPath: string, lastPath: string): string {
  const parent = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);
  const first = parent(firstPath);
  const last = parent(lastPath);
  let length = 0;
  while (length < first.length && length < last.length && first[length] === last[length]) length++;
  const prefix = first.slice(0, length);
  return prefix.slice(0, prefix.lastIndexOf('/') + 1) || '.';
}

/** Aggregate all matching local rows before pagination, including files in different folders. */
export function groupLocalDatasetPaths(
  rows: DatastoreRow[],
  offset: number,
  limit: number,
  grouping?: DatasetGrouping,
): DatastorePathPage {
  const pathColumn = grouping?.pathColumn ?? 'path';
  if (rows.length && !rows.some((row) => pathColumn in row)) {
    throw new Error('This catalogue does not provide file paths.');
  }
  const hasFileIds = rows.length > 0 && rows.every((row) => row.file_id != null && row.file_id !== '');
  const columns = grouping?.columns ?? (hasFileIds ? ['file_id'] : []);
  const groups = new Map<string, { id: string; paths: Set<string> }>();
  for (const row of rows) {
    for (const column of columns) {
      if (!(column in row))
        throw new Error(`The source catalogue does not contain the dataset grouping field: ${column}.`);
    }
    const values = Array.isArray(row[pathColumn]) ? row[pathColumn] : [row[pathColumn]];
    for (const path of values) {
      if (typeof path !== 'string' || !path.trim()) continue;
      const facets = columns.length
        ? columns.map((column) => row[column] ?? null)
        : [commonDatasetDirectory(path, path)];
      const key = JSON.stringify(facets);
      let group = groups.get(key);
      if (!group) {
        group = { id: facets.map((facet) => String(facet ?? 'None')).join('.'), paths: new Set() };
        groups.set(key, group);
      }
      group.paths.add(path);
    }
  }
  const datasets = Array.from(groups.values())
    .map(({ id, paths }) => {
      const sorted = Array.from(paths).sort();
      return { id, path: commonDatasetDirectory(sorted[0]!, sorted[sorted.length - 1]!), fileCount: sorted.length };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    datasets: datasets.slice(offset, offset + limit),
    hasMore: datasets.length > offset + limit,
    groupedByDirectory: !columns.length,
  };
}

const quoteIdentifier = (column: string) => `"${column.replace(/"/g, '""')}"`;

/** Aggregate remote files into Intake datasets before selecting a page of directory paths. */
export async function fetchDatastorePaths(
  datastoreName: string,
  filters: FilterMap,
  offset: number,
  limit: number,
): Promise<DatastorePathPage> {
  const grouping = await fetchDatasetGrouping(datastoreName);
  const { db, conn } = await initializeDuckDB();
  try {
    // Read only the required parquet ranges, including for large CMIP collections.
    await db.registerFileURL(
      'paths.parquet',
      buildDatastoreObjectStoreUrl(datastoreName),
      DuckDBDataProtocol.HTTP,
      false,
    );
    const schema = (await conn.query("DESCRIBE SELECT * FROM read_parquet('paths.parquet')")).toArray() as Array<{
      column_name: string;
      column_type: string;
    }>;
    const columnTypes = new Map(schema.map((column) => [column.column_name, column.column_type]));
    if (!columnTypes.has(grouping.pathColumn)) throw new Error('This catalogue does not provide file paths.');
    for (const column of grouping.columns) {
      if (!columnTypes.has(column))
        throw new Error(`The source catalogue does not contain the dataset grouping field: ${column}.`);
    }

    const pathColumn = quoteIdentifier(grouping.pathColumn);
    const conditions = [`${pathColumn} IS NOT NULL`, `${pathColumn} <> ''`];
    const parameters: (string | number)[] = [];
    for (const [column, values] of Object.entries(filters)) {
      if (!values.length) continue;
      const type = columnTypes.get(column);
      if (!type) throw new Error(`The source catalogue does not contain the selected filter: ${column}.`);
      const identifier = quoteIdentifier(column);
      const placeholders = values.map(() => '?').join(', ');
      conditions.push(
        type.endsWith('[]')
          ? `list_has_any(list_transform(${identifier}, value -> CAST(value AS VARCHAR)), [${placeholders}])`
          : `CAST(${identifier} AS VARCHAR) IN (${placeholders})`,
      );
      parameters.push(...values);
    }

    const groupColumns = grouping.columns.map(quoteIdentifier);
    const groupAliases = groupColumns.map((_, index) => `group_${index}`);
    const statement = await conn.prepare(`
      SELECT ${groupColumns.map((column, index) => `CAST(${column} AS VARCHAR) AS ${groupAliases[index]}`).join(', ')},
        MIN(${pathColumn}) AS first_path, MAX(${pathColumn}) AS last_path, COUNT(DISTINCT ${pathColumn}) AS file_count
      FROM read_parquet('paths.parquet') WHERE ${conditions.join(' AND ')}
      GROUP BY ${groupColumns.join(', ')} ORDER BY ${groupAliases.join(', ')} LIMIT ? OFFSET ?
    `);
    try {
      const records = (await statement.query(...parameters, limit + 1, offset)).toArray();
      return {
        datasets: records.slice(0, limit).map((row) => ({
          id: groupAliases.map((alias) => String(row[alias] ?? 'None')).join('.'),
          path: commonDatasetDirectory(row.first_path, row.last_path),
          fileCount: Number(row.file_count),
        })),
        hasMore: records.length > limit,
      };
    } finally {
      await statement.close();
    }
  } finally {
    await conn.close();
    await db.terminate();
  }
}
