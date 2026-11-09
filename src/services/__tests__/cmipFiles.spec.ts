import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCmipFilePaths } from '../cmipFiles';
import { initializeDuckDB } from '../duckdbClient';

vi.mock('../duckdbClient', () => ({ initializeDuckDB: vi.fn() }));

describe('CMIP result file lookup', () => {
  const statement = { query: vi.fn(), close: vi.fn() };
  const conn = { query: vi.fn(), prepare: vi.fn(), close: vi.fn() };
  const db = { registerFileURL: vi.fn(), terminate: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ assets: { column_name: 'path' } }),
      }),
    );
    vi.mocked(initializeDuckDB).mockResolvedValue({ db, conn } as any);
    conn.query.mockResolvedValue({
      toArray: () => [
        { column_name: 'path', column_type: 'VARCHAR' },
        { column_name: 'source_id', column_type: 'VARCHAR' },
        { column_name: 'version', column_type: 'VARCHAR' },
        { column_name: 'start_time', column_type: 'DOUBLE' },
        { column_name: 'parent_experiment_id', column_type: 'VARCHAR' },
        { column_name: 'variable', column_type: 'VARCHAR[]' },
      ],
    });
    conn.prepare.mockResolvedValue(statement);
    statement.query.mockResolvedValue({ toArray: () => [] });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('binds filters and all row metadata, preserving versions, numeric dates, and nulls', async () => {
    const selected = "model' OR 1=1 --";
    statement.query.mockResolvedValue({
      toArray: () => [{ file_path: '/g/data/1.nc' }, { file_path: '/g/data/2.nc' }, { file_path: '/g/data/3.nc' }],
    });
    const page = await fetchCmipFilePaths(
      'cmip7_replicated',
      { source_id: [selected] },
      {
        source_id: selected,
        version: 'v20261101',
        start_time: 197901,
        parent_experiment_id: null,
      },
      10,
      2,
    );
    expect(page).toEqual({ paths: ['/g/data/1.nc', '/g/data/2.nc'], hasMore: true });
    const sql = conn.prepare.mock.calls[0]![0];
    expect(sql).not.toContain(selected);
    expect(sql).toContain('"version" = ?');
    expect(sql).toContain('"start_time" = ?');
    expect(sql).toContain('"parent_experiment_id" IS NULL');
    expect(sql).toContain('SELECT DISTINCT "path" AS file_path');
    expect(sql).toContain('ORDER BY "path" LIMIT ? OFFSET ?');
    expect(statement.query).toHaveBeenCalledWith(selected, selected, 'v20261101', 197901, 3, 10);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/source/cmip7_replicated.json'));
    expect(statement.close).toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalled();
    expect(db.terminate).toHaveBeenCalled();
  });

  it('matches array-valued metadata without discarding its null elements', async () => {
    await fetchCmipFilePaths(
      'cmip7_australian',
      { variable: ['tas'], source_id: [] },
      {
        variable: ['tas', null],
      },
      0,
      10,
    );
    const sql = conn.prepare.mock.calls[0]![0];
    expect(sql).toContain('list_has_any');
    expect(sql).toContain('"variable" IS NOT DISTINCT FROM [?, NULL]');
    expect(statement.query).toHaveBeenCalledWith('tas', 'tas', 11, 0);
  });

  it.each(['filter', 'record'])('rejects an unknown %s instead of returning broader file matches', async (kind) => {
    await expect(
      fetchCmipFilePaths(
        'cmip7_australian',
        kind === 'filter' ? { missing: ['tas'] } : {},
        kind === 'record' ? { missing: 'tas' } : { source_id: 'ACCESS' },
        0,
        10,
      ),
    ).rejects.toThrow('missing missing');
    expect(conn.prepare).not.toHaveBeenCalled();
    expect(db.terminate).toHaveBeenCalled();
  });

  it('does not query every file when no identifying metadata is supplied', async () => {
    await expect(fetchCmipFilePaths('cmip7_australian', {}, {}, 0, 10)).rejects.toThrow('no metadata');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports a descriptor failure before starting the database', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(fetchCmipFilePaths('cmip7_australian', {}, { source_id: 'ACCESS' }, 0, 10)).rejects.toThrow(
      'HTTP 503',
    );
    expect(initializeDuckDB).not.toHaveBeenCalled();
  });

  it.each([{}, { assets: { column_name: 'absent_path' } }])(
    'rejects missing file path metadata',
    async (descriptor) => {
      vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => descriptor } as Response);
      await expect(fetchCmipFilePaths('cmip7_australian', {}, { source_id: 'ACCESS' }, 0, 10)).rejects.toThrow(
        'does not provide file paths',
      );
      expect(conn.prepare).not.toHaveBeenCalled();
    },
  );

  it('releases database resources when the file query fails', async () => {
    statement.query.mockRejectedValue(new Error('Network unavailable'));
    await expect(fetchCmipFilePaths('cmip7_australian', {}, { source_id: 'ACCESS' }, 0, 10)).rejects.toThrow(
      'Network unavailable',
    );
    expect(statement.close).toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalled();
    expect(db.terminate).toHaveBeenCalled();
  });
});
