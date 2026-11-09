import { DuckDBDataProtocol } from '@duckdb/duckdb-wasm';
import { buildDatastoreDescriptorUrl, buildDatastoreObjectStoreUrl } from '../config/catalogEndpoints';
import { initializeDuckDB } from './duckdbClient';
import type { DatastoreRow, FilterMap } from '../types/datastore';

export interface CmipFilePage {
  paths: string[];
  hasMore: boolean;
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Resolve actual filenames for a result; never reconstruct paths from CMIP facets. */
export async function fetchCmipFilePaths(
  datastoreName: string,
  filters: FilterMap,
  record: DatastoreRow,
  offset: number,
  limit: number,
): Promise<CmipFilePage> {
  if (!Object.keys(record).length) throw new Error('This result has no metadata to identify its files.');
  const response = await fetch(buildDatastoreDescriptorUrl(datastoreName));
  if (!response.ok) throw new Error(`Unable to read file metadata: HTTP ${response.status}.`);
  const descriptor = await response.json();
  const pathColumn = descriptor.assets?.column_name;
  if (typeof pathColumn !== 'string' || !pathColumn) throw new Error('This catalogue does not provide file paths.');
  const { db, conn } = await initializeDuckDB();
  try {
    await db.registerFileURL(
      'cmip-files.parquet',
      buildDatastoreObjectStoreUrl(datastoreName),
      DuckDBDataProtocol.HTTP,
      false,
    );
    const schema = (await conn.query("DESCRIBE SELECT * FROM read_parquet('cmip-files.parquet')")).toArray();
    const types = new Map<string, string>(schema.map((field) => [field.column_name, field.column_type]));
    if (!types.has(pathColumn)) throw new Error('This catalogue does not provide file paths.');
    const path = quote(pathColumn);
    const conditions = [`${path} IS NOT NULL`, `${path} <> ''`];
    const parameters: (string | number | boolean)[] = [];
    const fieldName = (field: string) => {
      if (!types.has(field)) throw new Error(`Cannot match this result: the catalogue is missing ${field}.`);
      return quote(field);
    };
    for (const [field, values] of Object.entries(filters)) {
      if (!values.length) continue;
      const column = fieldName(field);
      const placeholders = values.map(() => '?').join(', ');
      conditions.push(
        types.get(field)!.endsWith('[]')
          ? `list_has_any(list_transform(${column}, value -> CAST(value AS VARCHAR)), [${placeholders}])`
          : `CAST(${column} AS VARCHAR) IN (${placeholders})`,
      );
      parameters.push(...values);
    }
    // Include all row metadata, especially time ranges and version when available,
    // rather than returning every file for the model/variable. Bind numbers as numbers.
    for (const [field, value] of Object.entries(record)) {
      const column = fieldName(field);
      if (value === null) conditions.push(`${column} IS NULL`);
      else if (Array.isArray(value)) {
        conditions.push(
          `${column} IS NOT DISTINCT FROM [${value.map((item) => (item === null ? 'NULL' : '?')).join(', ')}]`,
        );
        parameters.push(...value.filter((item) => item !== null));
      } else {
        conditions.push(`${column} = ?`);
        parameters.push(value);
      }
    }
    const statement = await conn.prepare(`SELECT DISTINCT ${path} AS file_path
      FROM read_parquet('cmip-files.parquet') WHERE ${conditions.join(' AND ')}
      ORDER BY ${path} LIMIT ? OFFSET ?`);
    try {
      const records = (await statement.query(...parameters, limit + 1, offset)).toArray();
      return { paths: records.slice(0, limit).map((row) => String(row.file_path)), hasMore: records.length > limit };
    } finally {
      await statement.close();
    }
  } finally {
    try {
      await conn.close();
    } finally {
      await db.terminate();
    }
  }
}
