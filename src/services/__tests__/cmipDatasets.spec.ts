import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCmipDatasetSearch } from '../cmipDatasets';
import { initializeDuckDB } from '../duckdbClient';
vi.mock('../duckdbClient', () => ({ initializeDuckDB: vi.fn() }));
const db = { registerFileURL: vi.fn(), terminate: vi.fn() };
const conn = { query: vi.fn(), prepare: vi.fn() };
const statements: { sql: string; query: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }[] = [];
const key =
  'CMIP7/C4MIP/ACCESS-Consortium/ACCESS-ESM1-6/1pctCO2-rad/r1i1p1f1/glb/day/tas/tavg-h2m-hxy-u/g115/v20261019';
const row = {
  dataset_key: key,
  file_count: 34n,
  path_count: 68n,
  collections: ['cmip7_australian'],
  time_start: '02010101',
  time_end: '03681231',
};
beforeEach(() => {
  vi.resetAllMocks();
  statements.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ assets: { column_name: 'path' } }) }),
  );
  vi.mocked(initializeDuckDB).mockResolvedValue({ db, conn } as any);
  conn.query.mockResolvedValue({
    toArray: () => [
      { column_name: 'path', column_type: 'VARCHAR' },
      { column_name: 'variable_id', column_type: 'VARCHAR' },
    ],
  });
  conn.prepare.mockImplementation(async (sql: string) => {
    const statement = {
      sql,
      close: vi.fn(),
      query: vi.fn().mockResolvedValue({
        toArray: () =>
          sql.includes('COUNT(*) AS total')
            ? [{ total: 2n }]
            : sql.includes('SELECT dataset_key FROM cmip_datasets') || sql.includes('COUNT(DISTINCT filename)')
              ? [row]
              : sql.includes('AS file_path')
                ? [{ file_path: '/listed/1.nc' }, { file_path: '/listed/2.nc' }, { file_path: '/listed/3.nc' }]
                : [],
      }),
    };
    statements.push(statement);
    return statement;
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('CMIP dataset search lifecycle', () => {
  it('builds one grouped index for both catalogues, reuses it for paging, and resolves all files for the selected dataset', async () => {
    const signal = new AbortController().signal;
    const search = await createCmipDatasetSearch('CMIP7', { variable_id: ['tas'] }, signal);
    const first = await search.page(0, 20);
    await search.page(20, 20);
    expect(first).toEqual({
      total: 2,
      datasets: [
        {
          key,
          id: key.split('/').join('.'),
          facets: {
            project: 'CMIP7',
            activity_id: 'C4MIP',
            institution_id: 'ACCESS-Consortium',
            source_id: 'ACCESS-ESM1-6',
            experiment_id: '1pctCO2-rad',
            variant_label: 'r1i1p1f1',
            region: 'glb',
            frequency: 'day',
            variable_id: 'tas',
            branding_suffix: 'tavg-h2m-hxy-u',
            branded_variable: 'tas_tavg-h2m-hxy-u',
            grid_label: 'g115',
            version: 'v20261019',
          },
          version: 'v20261019',
          fileCount: 34,
          alternatePathCount: 34,
          collections: ['cmip7_australian'],
          timeRange: '0201-01-01 – 0368-12-31',
        },
      ],
    });
    expect(initializeDuckDB).toHaveBeenCalledTimes(1);
    expect(db.registerFileURL).toHaveBeenCalledTimes(2);
    expect(statements.filter((s) => s.sql.startsWith('CREATE TEMP TABLE'))).toHaveLength(1);
    expect(statements[0]!.query).toHaveBeenCalledWith('tas', 'tas');
    expect(await search.files(key, 10, 2)).toEqual({ paths: ['/listed/1.nc', '/listed/2.nc'], hasMore: true });
    expect(statements[statements.length - 1]!.query).toHaveBeenCalledWith('tas', 'tas', key, 3, 10);
    expect(statements.every((s) => s.close.mock.calls.length === 1)).toBe(true);
    await search.dispose();
    await search.dispose();
    expect(db.terminate).toHaveBeenCalledTimes(1);
    await expect(search.page(0, 20)).rejects.toThrow('closed');
  });

  it('terminates the query worker when the search is cancelled', async () => {
    const controller = new AbortController();
    const search = await createCmipDatasetSearch('CMIP6', {}, controller.signal);
    controller.abort();
    expect(db.terminate).toHaveBeenCalledTimes(1);
    await expect(search.page(0, 20)).rejects.toThrow();
  });

  it('cleans up failed grouping and does not present an incomplete dataset count', async () => {
    conn.prepare.mockRejectedValueOnce(new Error('Replica unavailable'));
    await expect(createCmipDatasetSearch('CMIP7', {}, new AbortController().signal)).rejects.toThrow(
      'Replica unavailable',
    );
    expect(db.terminate).toHaveBeenCalledTimes(1);
  });

  it('reports missing metadata and does not initialize a worker after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createCmipDatasetSearch('CMIP7', {}, controller.signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    await expect(createCmipDatasetSearch('CMIP7', {}, new AbortController().signal)).rejects.toThrow(
      'does not provide file paths',
    );
    expect(initializeDuckDB).not.toHaveBeenCalled();
  });

  it('releases a worker that finishes initializing after cancellation', async () => {
    const controller = new AbortController();
    vi.mocked(initializeDuckDB).mockImplementationOnce(async () => {
      controller.abort();
      return { db, conn } as any;
    });
    await expect(createCmipDatasetSearch('CMIP7', {}, controller.signal)).rejects.toThrow();
    expect(db.terminate).toHaveBeenCalledTimes(1);
  });
});
