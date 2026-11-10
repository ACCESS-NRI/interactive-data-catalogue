import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCmipDatasetSearch } from '../cmipDatasets';
import { initializeDuckDB } from '../duckdbClient';
vi.mock('../duckdbClient', () => ({ initializeDuckDB: vi.fn() }));
const db = { registerFileURL: vi.fn(), terminate: vi.fn(), connect: vi.fn() };
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
  it.each(['CMIP6', 'CMIP7'] as const)(
    'does not open the %s replica catalogue for ACCESS-only search or exports',
    async (project) => {
      const search = await createCmipDatasetSearch(project, {}, new AbortController().signal, true);
      expect(fetch).toHaveBeenCalledOnce();
      expect(vi.mocked(fetch).mock.lastCall![0]).toContain(
        project === 'CMIP6' ? 'cmip6_fs38.json' : 'cmip7_australian.json',
      );
      expect(db.registerFileURL).toHaveBeenCalledOnce();
      expect(db.registerFileURL.mock.lastCall![1]).toContain(
        project === 'CMIP6' ? 'cmip6_fs38.parquet' : 'cmip7_australian.parquet',
      );
      expect(statements[0]!.sql).not.toContain('cmip-1.parquet');
      await search.dispose();
    },
  );

  it('exports successive dataset ranges without page limits, using a separate streaming connection', async () => {
    const search = await createCmipDatasetSearch('CMIP7', { variable_id: ['tas'] }, new AbortController().signal);
    const exportStatements: { sql: string; send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }[] = [];
    const exportConn = {
      prepare: vi.fn(async (sql: string) => {
        const statement = {
          sql,
          close: vi.fn().mockResolvedValue(undefined),
          send: vi.fn(async function* (...args: string[]) {
            yield { getChild: () => (args[2] === 'first' ? ['/g/data/a.nc', '/g/data/b.nc'] : ['/g/data/c.nc']) };
          }),
        };
        exportStatements.push(statement);
        return statement;
      }),
      close: vi.fn().mockResolvedValue(undefined),
      cancelSent: vi.fn().mockResolvedValue(true),
    };
    db.connect.mockResolvedValue(exportConn);
    const keyQuery = vi.fn(async (after: string) => ({
      toArray: () =>
        after === ''
          ? [{ dataset_key: 'first' }, { dataset_key: 'middle' }]
          : after === 'middle'
            ? [{ dataset_key: 'last' }]
            : [],
    }));
    conn.prepare.mockImplementation(async (sql: string) => {
      expect(sql).toContain('WHERE dataset_key > ? ORDER BY dataset_key LIMIT 5000');
      return { query: keyQuery, close: vi.fn() };
    });
    const paths: string[] = [];
    for await (const batch of search.exportPaths(new AbortController().signal)) paths.push(...batch);
    expect(paths).toEqual(['/g/data/a.nc', '/g/data/b.nc', '/g/data/c.nc']);
    expect(keyQuery.mock.calls).toEqual([[''], ['middle'], ['last']]);
    expect(exportStatements[0]!.send).toHaveBeenCalledWith('tas', 'tas', 'first', 'middle');
    expect(exportStatements[1]!.send).toHaveBeenCalledWith('tas', 'tas', 'last', 'last');
    expect(exportStatements.every((s) => !s.sql.includes('LIMIT') && s.close.mock.calls.length === 1)).toBe(true);
    expect(exportConn.close).toHaveBeenCalledOnce();
    expect(db.terminate).not.toHaveBeenCalled();
  });

  it('cancels a dataset export without terminating the search, and closes its stream on failure', async () => {
    const search = await createCmipDatasetSearch('CMIP7', {}, new AbortController().signal);
    const send = vi.fn(async function* () {
      yield { getChild: () => ['/g/data/one.nc'] };
      yield { getChild: () => ['/g/data/two.nc'] };
    });
    const statement = { send, close: vi.fn().mockResolvedValue(undefined) };
    const exportConn = {
      prepare: vi.fn().mockResolvedValue(statement),
      close: vi.fn().mockResolvedValue(undefined),
      cancelSent: vi.fn().mockResolvedValue(true),
    };
    db.connect.mockResolvedValue(exportConn);
    const controller = new AbortController();
    const iterator = search.exportPaths(controller.signal, key)[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toEqual(['/g/data/one.nc']);
    controller.abort();
    await expect(iterator.next()).rejects.toThrow();
    expect(exportConn.cancelSent).toHaveBeenCalled();
    expect(exportConn.close).toHaveBeenCalledOnce();
    expect(statement.close).toHaveBeenCalledOnce();
    expect(db.terminate).not.toHaveBeenCalled();
    await expect(search.page(0, 20)).resolves.toMatchObject({ total: 2 });
    send.mockImplementationOnce(async function* () {
      yield { getChild: () => ['/invalid\npath.nc'] };
    });
    const invalid = search.exportPaths(new AbortController().signal, key)[Symbol.asyncIterator]();
    await expect(invalid.next()).rejects.toThrow('one line of text');
    expect(exportConn.close).toHaveBeenCalledTimes(2);
  });

  it('streams a large dataset in bounded chunks without dropping the final paths', async () => {
    const search = await createCmipDatasetSearch('CMIP7', {}, new AbortController().signal);
    const paths = Array.from({ length: 8200 }, (_, index) => `/g/data/file-${index}.nc`);
    const statement = {
      send: vi.fn(async function* () {
        yield { getChild: () => paths };
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const exportConn = {
      prepare: vi.fn().mockResolvedValue(statement),
      close: vi.fn().mockResolvedValue(undefined),
      cancelSent: vi.fn().mockResolvedValue(true),
    };
    db.connect.mockResolvedValue(exportConn);
    const batches: string[][] = [];
    for await (const batch of search.exportPaths(new AbortController().signal, key)) batches.push(batch);
    expect(batches.map((batch) => batch.length)).toEqual([4096, 4096, 8]);
    expect(batches.flat()).toEqual(paths);
    expect(statement.send).toHaveBeenCalledWith(key, key);
    expect(exportConn.close).toHaveBeenCalledOnce();
    await search.dispose();
  });

  it('retains CMIP6 member and table facets and represents unknown layouts without invented dates', async () => {
    const search = await createCmipDatasetSearch('CMIP6', {}, new AbortController().signal);
    const rows = [
      {
        ...row,
        dataset_key: 'CMIP6/CMIP/CSIRO/ACCESS-CM2/historical/r1i1p1f1/Amon/tas/gn/v20200101',
        collections: ['cmip6_fs38'],
        time_start: '200001',
        time_end: '200012',
      },
      { ...row, dataset_key: 'unverified:/g/data/custom.nc', time_start: null, time_end: null },
    ];
    conn.prepare.mockResolvedValue({
      query: vi.fn().mockResolvedValue({ toArray: () => rows }),
      close: vi.fn(),
    });
    const result = await search.page(0, 20);
    expect(result.datasets[0]).toMatchObject({
      facets: { source_id: 'ACCESS-CM2', member_id: 'r1i1p1f1', table_id: 'Amon', variable_id: 'tas' },
      version: 'v20200101',
      timeRange: '2000-01 – 2000-12',
    });
    expect(result.datasets[0]!.facets).not.toHaveProperty('branded_variable');
    expect(result.datasets[1]).toMatchObject({ id: '/g/data/custom.nc', facets: {}, version: null, timeRange: null });
    await search.dispose();
  });

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
