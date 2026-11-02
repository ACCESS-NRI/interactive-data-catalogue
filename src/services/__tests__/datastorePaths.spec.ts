import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commonDatasetDirectory, fetchDatastorePaths, groupLocalDatasetPaths } from '../datastorePaths';
import { initializeDuckDB } from '../duckdbClient';

vi.mock('../duckdbClient', () => ({ initializeDuckDB: vi.fn() }));

describe('fetchDatastorePaths', () => {
  const statement = { query: vi.fn(), close: vi.fn() };
  const conn = { query: vi.fn(), prepare: vi.fn(), close: vi.fn() };
  const db = { registerFileURL: vi.fn(), terminate: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ assets: { column_name: 'path' }, aggregation_control: { groupby_attrs: ['source_id'] } }),
      }),
    );
    vi.mocked(initializeDuckDB).mockResolvedValue({ db, conn } as any);
    conn.query.mockResolvedValue({
      toArray: () => [
        { column_name: 'path', column_type: 'VARCHAR' },
        { column_name: 'source_id', column_type: 'VARCHAR' },
        { column_name: 'variable', column_type: 'VARCHAR[]' },
      ],
    });
    conn.prepare.mockResolvedValue(statement);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('binds selections as values and returns only the requested page plus a next-page signal', async () => {
    statement.query.mockResolvedValue({
      toArray: () => [
        { group_0: 'a', first_path: '/a/v1/1.nc', last_path: '/a/v2/2.nc', file_count: 20n },
        { group_0: 'b', first_path: '/b/1.nc', last_path: '/b/9.nc', file_count: 9n },
        { group_0: 'c', first_path: '/c/1.nc', last_path: '/c/2.nc', file_count: 2n },
      ],
    });
    const selected = "model' OR 1=1 --";
    const result = await fetchDatastorePaths('cmip7_australian', { source_id: [selected], variable: ['tas'] }, 25, 2);

    expect(result).toEqual({
      datasets: [
        { id: 'a', path: '/a/', fileCount: 20 },
        { id: 'b', path: '/b/', fileCount: 9 },
      ],
      hasMore: true,
    });
    expect(conn.prepare.mock.calls[0]![0]).not.toContain(selected);
    expect(statement.query).toHaveBeenCalledWith(selected, 'tas', 3, 25);
    expect(statement.close).toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalled();
    expect(db.terminate).toHaveBeenCalled();
  });

  it('uses the descriptor grouping and orders datasets before pagination', async () => {
    statement.query.mockResolvedValue({ toArray: () => [] });
    await fetchDatastorePaths('cmip7_australian', {}, 0, 25);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/source/cmip7_australian.json'));
    const sql = conn.prepare.mock.calls[0]![0];
    expect(sql).toContain('GROUP BY "source_id" ORDER BY group_0 LIMIT ? OFFSET ?');
    expect(sql).toContain('MIN("path")');
    expect(sql).toContain('MAX("path")');
  });

  it('rejects unsupported filters instead of showing files outside the requested selection', async () => {
    await expect(fetchDatastorePaths('cmip7_australian', { missing: ['tas'] }, 0, 25)).rejects.toThrow(
      'does not contain the selected filter',
    );
    expect(conn.prepare).not.toHaveBeenCalled();
    expect(db.terminate).toHaveBeenCalled();
  });

  it('releases database resources after a failed path query', async () => {
    statement.query.mockRejectedValue(new Error('Network unavailable'));
    await expect(fetchDatastorePaths('cmip7_australian', {}, 0, 25)).rejects.toThrow('Network unavailable');
    expect(statement.close).toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalled();
    expect(db.terminate).toHaveBeenCalled();
  });
});

describe('dataset directory aggregation', () => {
  it('combines time files and version subdirectories into one path per dataset', () => {
    const rows = [
      { file_id: 'tas', path: '/data/tas/v1/2000.nc' },
      { file_id: 'tas', path: '/data/tas/v1/2001.nc' },
      { file_id: 'tas', path: '/data/tas/v2/2001.nc' },
      { file_id: 'tas', path: '/data/tas/v1/2000.nc' },
      { file_id: 'pr', path: '/data/pr/2000.nc' },
    ];
    expect(groupLocalDatasetPaths(rows, 0, 25)).toEqual({
      datasets: [
        { id: 'pr', path: '/data/pr/', fileCount: 1 },
        { id: 'tas', path: '/data/tas/', fileCount: 3 },
      ],
      hasMore: false,
      groupedByDirectory: false,
    });
  });

  it('keeps different datasets separate even when they share a directory', () => {
    const page = groupLocalDatasetPaths(
      [
        { variable: 'tas', member: 'r1', path: '/shared/tas_r1_2000.nc' },
        { variable: 'tas', member: 'r1', path: '/shared/tas_r1_2001.nc' },
        { variable: 'tas', member: 'r2', path: '/shared/tas_r2_2000.nc' },
      ],
      0,
      25,
      { columns: ['variable', 'member'], pathColumn: 'path' },
    );
    expect(page.datasets).toEqual([
      { id: 'tas.r1', path: '/shared/', fileCount: 2 },
      { id: 'tas.r2', path: '/shared/', fileCount: 1 },
    ]);
  });

  it('paginates datasets after aggregating every matching file', () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({ file_id: 'a', path: `/a/${index}.nc` }));
    rows.push({ file_id: 'b', path: '/b/one.nc' });
    expect(groupLocalDatasetPaths(rows, 0, 1)).toMatchObject({ datasets: [{ id: 'a', fileCount: 30 }], hasMore: true });
    expect(groupLocalDatasetPaths(rows, 1, 1)).toMatchObject({ datasets: [{ id: 'b', fileCount: 1 }], hasMore: false });
  });

  it('labels directory grouping when a personal CSV has no dataset IDs', () => {
    expect(groupLocalDatasetPaths([{ path: '/local/1.nc' }, { path: '/local/2.nc' }], 0, 25)).toEqual({
      datasets: [{ id: '/local/', path: '/local/', fileCount: 2 }],
      hasMore: false,
      groupedByDirectory: true,
    });
  });

  it('finds a shared directory at path boundaries, not a partial folder name', () => {
    expect(commonDatasetDirectory('/data/run1/2000/a.nc', '/data/run10/2001/b.nc')).toBe('/data/');
    expect(commonDatasetDirectory('/data/a.nc', '/data/a.nc')).toBe('/data/');
    expect(commonDatasetDirectory('a.nc', 'b.nc')).toBe('.');
  });
});
