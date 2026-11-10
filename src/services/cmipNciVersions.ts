import { DuckDBDataProtocol } from '@duckdb/duckdb-wasm';
import { buildDatastoreDescriptorUrl, buildDatastoreObjectStoreUrl } from '../config/catalogEndpoints';
import type { FilterMap } from '../types/datastore';
import type { CmipProject } from './cmipEsmvalcoreCode';
import { buildCmipDatasetQuery } from './cmipDatasetQuery';
import { initializeDuckDB } from './duckdbClient';

/** Read versions across every matching file, using the same path rules as NCI
 * dataset grouping. A missing date or an undated latest path stays unverified.
 */
export async function fetchCmipNciVersions(
  project: CmipProject,
  name: string,
  filters: FilterMap,
  signal: AbortSignal,
): Promise<(string | null)[]> {
  const request = AbortSignal.any([signal, AbortSignal.timeout(60_000)]);
  request.throwIfAborted();
  const response = await fetch(buildDatastoreDescriptorUrl(name), { signal: request });
  if (!response.ok) throw new Error(`Unable to read ${name}: HTTP ${response.status}.`);
  const descriptor = await response.json();
  const pathColumn = descriptor.assets?.column_name;
  if (typeof pathColumn !== 'string' || !pathColumn) throw new Error('This catalogue does not provide file paths.');
  request.throwIfAborted();
  const { db, conn } = await initializeDuckDB();
  let termination: Promise<void> | undefined;
  const dispose = () => (termination ??= db.terminate());
  const abort = () => void dispose().catch(() => {});
  request.addEventListener('abort', abort, { once: true });
  try {
    request.throwIfAborted();
    await db.registerFileURL('versions.parquet', buildDatastoreObjectStoreUrl(name), DuckDBDataProtocol.HTTP, false);
    const table = "read_parquet('versions.parquet')";
    const schema = (await conn.query(`DESCRIBE SELECT * FROM ${table}`)).toArray();
    request.throwIfAborted();
    const { cte, parameters } = buildCmipDatasetQuery(
      project,
      [{ name, table, pathColumn, types: new Map(schema.map((field) => [field.column_name, field.column_type])) }],
      filters,
    );
    const statement = await conn.prepare(`${cte} SELECT DISTINCT version FROM matching`);
    try {
      const rows = (await statement.query(...parameters)).toArray();
      request.throwIfAborted();
      return rows.map((row) => (row.version === null ? null : String(row.version)));
    } finally {
      if (!termination) await statement.close();
    }
  } finally {
    request.removeEventListener('abort', abort);
    await dispose();
  }
}
