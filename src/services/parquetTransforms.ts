import type * as duckdb from '@duckdb/duckdb-wasm';
import type { CatalogRow } from '../types/catalog';
import type { DatastoreRow, FilterOptions } from '../types/datastore';

const isDuckDbVector = (value: unknown): value is { toArray: () => unknown[] } => {
  return !!value && typeof value === 'object' && 'toArray' in value && typeof value.toArray === 'function';
};

const processListField = (value: unknown): string[] => {
  if (value === null || value === undefined) return [];

  if (isDuckDbVector(value)) {
    return value
      .toArray()
      .filter((v) => v !== null && v !== undefined)
      .map(String);
  }

  if (Array.isArray(value)) {
    return value.filter((v) => v !== null && v !== undefined).map(String);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
    } catch {
      return [value];
    }
  }

  return [String(value)];
};

export function buildRawDataSample(rawData: Record<string, unknown>[]) {
  return rawData.slice(0, 3).map((row) => {
    const cleanRow: Record<string, unknown> = {};
    for (const key in row) {
      const value = row[key];
      cleanRow[key] = {
        value,
        type: typeof value,
        isArray: Array.isArray(value),
        constructor: (value as { constructor?: { name?: string } } | null | undefined)?.constructor?.name,
        asArray: isDuckDbVector(value) ? value.toArray() : value,
      };
    }
    return cleanRow;
  });
}

export function normalizeCatalogRows(rawData: Record<string, unknown>[]): CatalogRow[] {
  return rawData.map((row) => ({
    name: String(row.name || ''),
    model: processListField(row.model),
    description: String(row.description || ''),
    realm: processListField(row.realm),
    frequency: processListField(row.frequency),
    variable: processListField(row.variable),
    yaml: String(row.yaml || ''),
    searchableModel: processListField(row.model).join(', '),
    searchableRealm: processListField(row.realm).join(', '),
    searchableFrequency: processListField(row.frequency).join(', '),
    searchableVariable: processListField(row.variable).join(', '),
  }));
}

export async function queryMetaCatalogPq(
  db: duckdb.AsyncDuckDB,
  conn: duckdb.AsyncDuckDBConnection,
  uint8Array: Uint8Array,
): Promise<{ data: CatalogRow[]; rawDataSample: Record<string, unknown>[] }> {
  await db.registerFileBuffer('metacatalog.parquet', uint8Array);

  const queryResult = await conn.query("SELECT * FROM read_parquet('metacatalog.parquet')");
  const rawData = queryResult.toArray() as Record<string, unknown>[];

  return {
    data: normalizeCatalogRows(rawData),
    rawDataSample: buildRawDataSample(rawData),
  };
}

export async function loadEsmDatastore(conn: duckdb.AsyncDuckDBConnection, fileName: string): Promise<DatastoreRow[]> {
  const schemaResult = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${fileName}') LIMIT 1`);

  const schemaData = schemaResult.toArray() as Array<{ column_name: string }>;
  console.log('📊 ESM Datastore schema:', schemaData);
  const columns = schemaData.map((row) => row.column_name).filter((col) => col !== 'filename' && col !== 'path');
  console.log('📋 Available columns:', columns);

  const queryResult = await conn.query(`SELECT * FROM read_parquet('${fileName}')`);
  const rawData = queryResult.toArray() as Record<string, unknown>[];

  const transformedData = rawData.map((row) => {
    const transformedRow: DatastoreRow = {};
    columns.forEach((column) => {
      const arr = processListField(row[column]);
      transformedRow[column] = arr.length === 0 ? null : arr.length === 1 ? (arr[0] ?? null) : arr;
    });

    return transformedRow;
  });

  console.log('✅ ESM Datastore transformed data sample:', transformedData.slice(0, 2));
  console.log('📊 Total records:', transformedData.length);

  return transformedData;
}

export async function getEsmDatastoreSize(conn: duckdb.AsyncDuckDBConnection, sidecarFname: string): Promise<number> {
  try {
    const queryResult = await conn.query(` SELECT key, value FROM parquet_kv_metadata('${sidecarFname}') `);

    const decoder = new TextDecoder('utf-8');

    const metadata: Record<string, string> = Object.fromEntries(
      queryResult.toArray().map((r) => [decoder.decode(r.key), decoder.decode(r.value)]),
    );

    if (metadata.num_records) {
      return parseInt(metadata.num_records, 10);
    }

    throw new Error('num_records not found in parquet metadata');
  } catch (err) {
    console.error('Could not load esm-datastore size: setting over threshold to enable SSR', err);
    return 1000000;
  }
}

export async function getFilterOptions(
  conn: duckdb.AsyncDuckDBConnection,
  sidecarFname: string,
): Promise<FilterOptions> {
  try {
    const queryResult = await conn.query(` SELECT * FROM read_parquet('${sidecarFname}') `);
    const rows = queryResult.toArray();

    if (rows.length !== 1) {
      console.error('⚠️ Sidecar file does not contain exactly one row');
      return {};
    }

    const row = rows[0];
    const filterOptions: FilterOptions = {};
    for (const [column, value] of Object.entries(row)) {
      if (column === 'path' || column === 'filename') {
        continue;
      }
      if (value === null || value === undefined) {
        filterOptions[column] = [];
        continue;
      }

      if (isDuckDbVector(value)) {
        const arr = value
          .toArray()
          .filter((v) => v !== null && v !== undefined && String(v).trim())
          .map(String);
        filterOptions[column] = arr.sort();
      }
    }

    console.log('✅ Loaded filter options from sidecar file:', Object.keys(filterOptions).length, 'columns');
    return filterOptions;
  } catch (err) {
    console.error('❌ Error loading filter options from sidecar:', err);
    return {};
  }
}

export function setupColumns(dataColumns: string[]): string[] {
  return dataColumns.filter((col) => col !== '__index_level_0__');
}

/**
 * Parses a bracket-wrapped string list such as `"['a', 'b']"` or `'["a","b"]'`
 * into an array of strings. Returns null when the value is not a bracket-wrapped list.
 */
export function parseStringList(value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // Fall back to single/double quoted item matching
    const quotedMatches = Array.from(trimmed.matchAll(/'([^']*)'|"([^"]*)"/g)).map(
      (match) => match[1] ?? match[2],
    );
    if (quotedMatches.length > 0) return quotedMatches.filter((item): item is string => item !== undefined);

    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return null;
}

/**
 * Normalizes a single field value from a CSV/parquet row.
 *
 * - DuckDB Vector → array of strings
 * - JS array → array of strings
 * - bracket-wrapped string → parsed array
 * - scalar string → single string or null when empty
 *
 * When `forceList` is true the result is always an array.
 */
export function normalizeDatastoreField(value: unknown, forceList = false): string | string[] | null {
  if (value === null || value === undefined) return null;

  let values: unknown[];
  if (isDuckDbVector(value)) {
    values = value.toArray();
  } else if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    values = parseStringList(trimmed) ?? [value];
  } else {
    values = [value];
  }

  const normalized = values.filter((v) => v !== null && v !== undefined && String(v).trim()).map(String);
  if (normalized.length === 0) return null;
  if (forceList) return normalized;
  return normalized.length === 1 ? normalized[0]! : normalized;
}

/**
 * Normalizes an array of raw rows into typed DatastoreRow objects.
 *
 * Columns listed in `iterableColumns` are always returned as string arrays.
 * All other columns use scalar-or-array output depending on the data.
 */
export function normalizeDatastoreRows(
  rows: Record<string, unknown>[],
  columns: string[],
  iterableColumns: string[] = [],
): DatastoreRow[] {
  const iterableColumnSet = new Set(iterableColumns);
  return rows.map((row) => {
    const transformedRow: DatastoreRow = {};
    for (const column of columns) {
      transformedRow[column] = normalizeDatastoreField(row[column], iterableColumnSet.has(column));
    }
    return transformedRow;
  });
}

/**
 * Derives per-column filter options by collecting the unique non-empty values
 * across all rows. Skips `path` and `filename` columns.
 */
export function deriveFilterOptionsFromRows(rows: DatastoreRow[], columns: string[]): FilterOptions {
  const filterOptions: FilterOptions = {};

  for (const column of columns) {
    if (column === 'path' || column === 'filename') continue;

    const seen = new Set<string>();
    for (const row of rows) {
      const value = row[column];
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== null && item !== undefined && String(item).trim()) seen.add(String(item));
        });
      } else if (value !== null && value !== undefined && String(value).trim()) {
        seen.add(String(value));
      }
    }
    filterOptions[column] = Array.from(seen).sort();
  }

  return filterOptions;
}
