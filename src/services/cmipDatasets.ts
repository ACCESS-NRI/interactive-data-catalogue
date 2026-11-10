import { DuckDBDataProtocol } from '@duckdb/duckdb-wasm';
import { buildDatastoreDescriptorUrl, buildDatastoreObjectStoreUrl } from '../config/catalogEndpoints';
import { initializeDuckDB } from './duckdbClient';
import { cmipNciCollections } from './cmipSearch';
import {
  aggregateCmipDatasets,
  indexCmipDatasets,
  buildCmipDatasetQuery,
  selectCmipFiles,
  exportCmipFiles,
  type CmipQuerySource,
} from './cmipDatasetQuery';
import type { CmipProject } from './cmipEsmvalcoreCode';
import type { DatastoreRow, FilterMap } from '../types/datastore';

export interface CmipNciDataset {
  key: string;
  id: string;
  facets: DatastoreRow;
  version: string | null;
  fileCount: number;
  alternatePathCount: number;
  collections: string[];
  timeRange: string | null;
}
export interface CmipDatasetPage {
  datasets: CmipNciDataset[];
  total: number;
}
export interface CmipFilePage {
  paths: string[];
  hasMore: boolean;
}
export interface CmipDatasetSearch {
  page(offset: number, limit: number): Promise<CmipDatasetPage>;
  files(datasetKey: string, offset: number, limit: number): Promise<CmipFilePage>;
  exportPaths(signal: AbortSignal, datasetKey?: string): AsyncIterable<string[]>;
  dispose(): Promise<void>;
}

interface DatasetRow {
  dataset_key: string;
  file_count: number | bigint;
  path_count: number | bigint;
  collections: Iterable<string>;
  time_start: string | null;
  time_end: string | null;
}

function formatTime(value: string) {
  // Keep model-calendar dates (including non-Gregorian dates) as text.
  const date = [value.slice(0, 4), value.slice(4, 6), value.slice(6, 8)].filter(Boolean).join('-');
  const time = value.slice(8).match(/.{2}/g)?.join(':');
  return `${date}${time ? ` ${time}` : ''}`;
}

function dataset(row: DatasetRow): CmipNciDataset {
  const key: string = row.dataset_key;
  const parts = key.split('/');
  const verified = !key.startsWith('unverified:');
  const fields =
    parts[0] === 'CMIP6'
      ? [
          'project',
          'activity_id',
          'institution_id',
          'source_id',
          'experiment_id',
          'member_id',
          'table_id',
          'variable_id',
          'grid_label',
          'version',
        ]
      : [
          'project',
          'activity_id',
          'institution_id',
          'source_id',
          'experiment_id',
          'variant_label',
          'region',
          'frequency',
          'variable_id',
          'branding_suffix',
          'grid_label',
          'version',
        ];
  const facets: DatastoreRow = verified ? Object.fromEntries(fields.map((field, index) => [field, parts[index]!])) : {};
  if (facets.branding_suffix) facets.branded_variable = `${facets.variable_id}_${facets.branding_suffix}`;
  return {
    key,
    id: verified ? parts.join('.') : key.slice('unverified:'.length),
    facets,
    version: verified ? String(facets.version) : null,
    fileCount: Number(row.file_count),
    alternatePathCount: Number(row.path_count) - Number(row.file_count),
    collections: Array.from(row.collections),
    timeRange: row.time_start
      ? `${formatTime(row.time_start)}${row.time_end ? ` – ${formatTime(row.time_end)}` : ''}`
      : null,
  };
}

/** Keep the grouped index and Parquet range cache for the current search, including
 * pagination and file expansion. Dispose it on filter/era changes or unmount.
 */
export async function createCmipDatasetSearch(
  project: CmipProject,
  filters: FilterMap,
  signal: AbortSignal,
  accessOnly = false,
): Promise<CmipDatasetSearch> {
  signal.throwIfAborted();
  const descriptors = await Promise.all(
    cmipNciCollections(project, accessOnly).map(async ({ name }) => {
      const response = await fetch(buildDatastoreDescriptorUrl(name), { signal });
      if (!response.ok) throw new Error(`Unable to read ${name}: HTTP ${response.status}.`);
      const descriptor = await response.json();
      if (typeof descriptor.assets?.column_name !== 'string' || !descriptor.assets.column_name)
        throw new Error(`The ${name} catalogue does not provide file paths.`);
      return { name, pathColumn: descriptor.assets.column_name as string };
    }),
  );
  signal.throwIfAborted();
  const { db, conn } = await initializeDuckDB();
  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', abort);
    // Terminating the worker also interrupts an in-flight remote query.
    await db.terminate();
  };
  const abort = () => {
    void dispose();
  };
  signal.addEventListener('abort', abort, { once: true });
  const query = async (sql: string, parameters: (string | number)[] = []) => {
    signal.throwIfAborted();
    if (disposed) throw new Error('This search has been closed. Refresh the search to try again.');
    const statement = await conn.prepare(sql);
    try {
      return (await statement.query(...parameters)).toArray();
    } finally {
      if (!disposed) await statement.close();
    }
  };
  try {
    signal.throwIfAborted();
    const sources: CmipQuerySource[] = [];
    for (const [index, source] of descriptors.entries()) {
      const file = `cmip-${index}.parquet`;
      await db.registerFileURL(file, buildDatastoreObjectStoreUrl(source.name), DuckDBDataProtocol.HTTP, false);
      const table = `read_parquet('${file}')`;
      const schema = (await conn.query(`DESCRIBE SELECT * FROM ${table}`)).toArray();
      sources.push({ ...source, table, types: new Map(schema.map((field) => [field.column_name, field.column_type])) });
    }
    const { cte, parameters } = buildCmipDatasetQuery(project, sources, filters);
    // Index only dataset identities for the whole catalogue. Counting every
    // distinct file/path at once exceeds the browser memory limit for CMIP6.
    // File counts and coverage are computed for the requested dataset page below.
    await query(`CREATE TEMP TABLE cmip_datasets AS ${cte} ${indexCmipDatasets}`, parameters);
    const total = Number((await query('SELECT COUNT(*) AS total FROM cmip_datasets'))[0]!.total);
    return {
      async page(offset, limit) {
        const keys = await query('SELECT dataset_key FROM cmip_datasets ORDER BY dataset_key LIMIT ? OFFSET ?', [
          limit,
          offset,
        ]);
        if (!keys.length) return { datasets: [], total };
        const groupedPage = aggregateCmipDatasets.replace(
          'FROM matching GROUP BY',
          `FROM matching WHERE dataset_key IN (${keys.map(() => '?').join(', ')}) GROUP BY`,
        );
        const rows = await query(`${cte} ${groupedPage} ORDER BY dataset_key`, [
          ...parameters,
          ...keys.map((row) => String(row.dataset_key)),
        ]);
        return { datasets: rows.map((row) => dataset(row as unknown as DatasetRow)), total };
      },
      async files(key, offset, limit) {
        const rows = await query(`${cte} ${selectCmipFiles}`, [...parameters, key, limit + 1, offset]);
        return { paths: rows.slice(0, limit).map((row) => String(row.file_path)), hasMore: rows.length > limit };
      },
      async *exportPaths(exportSignal, datasetKey) {
        signal.throwIfAborted();
        exportSignal.throwIfAborted();
        if (disposed) throw new Error('This search has been closed. Refresh the search to try again.');
        // A separate connection keeps browsing queries from replacing the export
        // stream. Both connections share the worker and remote file cache.
        const exportConn = await db.connect();
        const cancel = () => {
          void exportConn.cancelSent().catch(() => {});
        };
        exportSignal.addEventListener('abort', cancel, { once: true });
        let after = '';
        try {
          while (true) {
            signal.throwIfAborted();
            exportSignal.throwIfAborted();
            const keys = datasetKey
              ? [{ dataset_key: datasetKey }]
              : await query(
                  'SELECT dataset_key FROM cmip_datasets WHERE dataset_key > ? ORDER BY dataset_key LIMIT 5000',
                  [after],
                );
            if (!keys.length) break;
            const first = String(keys[0]!.dataset_key);
            const last = String(keys[keys.length - 1]!.dataset_key);
            exportSignal.throwIfAborted();
            const statement = await exportConn.prepare(`${cte} ${exportCmipFiles}`);
            try {
              exportSignal.throwIfAborted();
              const reader = await statement.send(...parameters, first, last);
              for await (const batch of reader) {
                signal.throwIfAborted();
                exportSignal.throwIfAborted();
                const column = batch.getChild('file_path');
                if (!column) throw new Error('The catalogue did not return file paths.');
                let paths: string[] = [];
                for (const value of column) {
                  if (typeof value !== 'string' || !value || /[\r\n\0]/.test(value))
                    throw new Error('A catalogue path cannot be represented as one line of text.');
                  paths.push(value);
                  if (paths.length === 4096) {
                    yield paths;
                    paths = [];
                  }
                }
                if (paths.length) yield paths;
              }
            } finally {
              if (!disposed) {
                await exportConn.cancelSent().catch(() => {});
                await statement.close().catch(() => {});
              }
            }
            if (datasetKey) break;
            after = last;
          }
        } finally {
          exportSignal.removeEventListener('abort', cancel);
          if (!disposed) await exportConn.close().catch(() => {});
        }
      },
      dispose,
    };
  } catch (error) {
    await dispose();
    signal.throwIfAborted();
    throw error;
  }
}
