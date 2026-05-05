import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseCsvFile } from '../personalDatastoreCsv';
import * as duckdbClient from '../duckdbClient';

describe('parseCsvFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when the file does not have a .csv extension', async () => {
    const file = new File(['data'], 'data.parquet', { type: 'application/octet-stream' });
    await expect(parseCsvFile(file)).rejects.toThrow('Personal datastore uploads must be CSV files');
  });

  it('throws when the file is empty', async () => {
    const file = new File([], 'data.csv', { type: 'text/csv' });
    await expect(parseCsvFile(file)).rejects.toThrow('The selected file is empty');
  });

  it('returns columns (excluding "filename") and rows for a valid CSV', async () => {
    const csvContent = 'variable,realm,filename\ntas,atmos,file1.nc\npr,atmos,file2.nc';
    const file = new File([csvContent], 'data.csv', { type: 'text/csv' });

    const mockConn = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          // DESCRIBE response — schema rows
          toArray: () => [{ column_name: 'variable' }, { column_name: 'realm' }, { column_name: 'filename' }],
        })
        .mockResolvedValueOnce({
          // SELECT * response — data rows
          toArray: () => [
            { variable: 'tas', realm: 'atmos', filename: 'file1.nc' },
            { variable: 'pr', realm: 'atmos', filename: 'file2.nc' },
          ],
        }),
      close: vi.fn(),
    };
    const mockDb = {
      registerFileBuffer: vi.fn(),
      terminate: vi.fn(),
    };

    vi.spyOn(duckdbClient, 'initializeDuckDB').mockResolvedValue({ db: mockDb, conn: mockConn } as any);

    const result = await parseCsvFile(file);

    // 'filename' column should be filtered out
    expect(result.columns).toEqual(['variable', 'realm']);
    expect(result.rows).toHaveLength(2);
    expect(mockDb.registerFileBuffer).toHaveBeenCalledWith('personal-datastore.csv', expect.any(Uint8Array));
  });

  it('always closes the DuckDB connection and terminates the DB, even when the query throws', async () => {
    const file = new File(['broken csv content'], 'data.csv', { type: 'text/csv' });

    const mockConn = {
      query: vi.fn().mockRejectedValue(new Error('DuckDB parse error')),
      close: vi.fn(),
    };
    const mockDb = {
      registerFileBuffer: vi.fn(),
      terminate: vi.fn(),
    };

    vi.spyOn(duckdbClient, 'initializeDuckDB').mockResolvedValue({ db: mockDb, conn: mockConn } as any);

    await expect(parseCsvFile(file)).rejects.toThrow('DuckDB parse error');
    expect(mockConn.close).toHaveBeenCalled();
    expect(mockDb.terminate).toHaveBeenCalled();
  });
});
