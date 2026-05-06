import { describe, expect, it, vi } from 'vitest';
import {
  buildRawDataSample,
  deriveFilterOptionsFromRows,
  getEsmDatastoreSize,
  getFilterOptions,
  loadEsmDatastore,
  normalizeCatalogRows,
  normalizeDatastoreField,
  normalizeDatastoreRows,
  parseStringList,
  queryMetaCatalogPq,
  setupColumns,
} from '../parquetTransforms';

describe('parquetTransforms', () => {
  it('normalizes catalog rows into the shared catalog shape', () => {
    const rows = normalizeCatalogRows([
      {
        name: 'test-catalog',
        model: ['ACCESS-CM2'],
        description: 'A test row',
        realm: 'atmos',
        frequency: '["day", "mon"]',
        variable: null,
        yaml: 'sources: {}',
      },
    ]);

    expect(rows).toEqual([
      {
        name: 'test-catalog',
        model: ['ACCESS-CM2'],
        description: 'A test row',
        realm: ['atmos'],
        frequency: ['day', 'mon'],
        variable: [],
        yaml: 'sources: {}',
        searchableModel: 'ACCESS-CM2',
        searchableRealm: 'atmos',
        searchableFrequency: 'day, mon',
        searchableVariable: '',
      },
    ]);
  });

  it('builds a debug-friendly raw data sample with vector snapshots', () => {
    const vector = { toArray: () => ['a', 'b'] };
    const sample = buildRawDataSample([{ model: vector, count: 3 }]);

    expect(sample[0]?.model).toMatchObject({ isArray: false, asArray: ['a', 'b'] });
    expect(sample[0]?.count).toMatchObject({ value: 3, type: 'number' });
  });

  it('filters internal columns out of setupColumns output', () => {
    expect(setupColumns(['variable', '__index_level_0__', 'realm'])).toEqual(['variable', 'realm']);
  });

  it('extracts sidecar filter options from vector-like values', async () => {
    const mockConn = {
      query: vi.fn().mockResolvedValue({
        toArray: () => [
          {
            variable: { toArray: () => ['tas', null, 'pr'] },
            realm: { toArray: () => ['atmos', 'ocean'] },
            filename: { toArray: () => ['ignore-me'] },
          },
        ],
      }),
    };

    await expect(getFilterOptions(mockConn as never, 'test_uniqs.parquet')).resolves.toEqual({
      variable: ['pr', 'tas'],
      realm: ['atmos', 'ocean'],
    });
  });
});

describe('parseStringList', () => {
  it('parses a JSON-style bracket array string', () => {
    expect(parseStringList('["a","b"]')).toEqual(['a', 'b']);
  });

  it('parses a Python-style bracket string with single quotes', () => {
    expect(parseStringList("['tas', 'pr']")).toEqual(['tas', 'pr']);
  });

  it('parses bracket-wrapped comma-separated values without quotes', () => {
    expect(parseStringList('[a, b, c]')).toEqual(['a', 'b', 'c']);
  });

  it('returns null for a plain (non-bracket) string', () => {
    expect(parseStringList('plain-string')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseStringList('')).toBeNull();
  });

  it('returns null when JSON.parse succeeds but the result is not an array', () => {
    // Force the try-branch to succeed with a non-array so execution falls
    // through to the final `return null` (line 200 of parquetTransforms.ts).
    vi.spyOn(JSON, 'parse').mockReturnValueOnce('not-an-array');
    expect(parseStringList('[anything]')).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('normalizeDatastoreField', () => {
  it('returns null for null', () => {
    expect(normalizeDatastoreField(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeDatastoreField(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(normalizeDatastoreField('')).toBeNull();
  });

  it('returns a scalar string for a single-item DuckDB Vector', () => {
    const vector = { toArray: () => ['tas'] };
    expect(normalizeDatastoreField(vector)).toBe('tas');
  });

  it('returns an array for a multi-item DuckDB Vector', () => {
    const vector = { toArray: () => ['tas', 'pr'] };
    expect(normalizeDatastoreField(vector)).toEqual(['tas', 'pr']);
  });

  it('returns a scalar string for a plain string', () => {
    expect(normalizeDatastoreField('daily')).toBe('daily');
  });

  it('parses a bracket-wrapped string into an array', () => {
    expect(normalizeDatastoreField("['tas', 'pr']")).toEqual(['tas', 'pr']);
  });

  it('returns an array for a JS array input', () => {
    expect(normalizeDatastoreField(['tas', 'pr'])).toEqual(['tas', 'pr']);
  });

  it('forces a single value into an array when forceList is true', () => {
    expect(normalizeDatastoreField('daily', true)).toEqual(['daily']);
  });

  it('forces a Vector single value into an array when forceList is true', () => {
    const vector = { toArray: () => ['atmos'] };
    expect(normalizeDatastoreField(vector, true)).toEqual(['atmos']);
  });

  it('converts a non-string primitive (number) to a string via the else branch', () => {
    // Numbers are not DuckDB vectors, not arrays, and not strings — they hit
    // the `else { values = [value] }` branch (line 226 of parquetTransforms.ts).
    expect(normalizeDatastoreField(42)).toBe('42');
  });
});

describe('normalizeDatastoreRows', () => {
  it('coerces iterable columns to arrays and leaves others as scalars', () => {
    const rows = [{ variable: 'tas', realm: 'atmos' }];
    const result = normalizeDatastoreRows(rows, ['variable', 'realm'], ['variable']);
    expect(result[0]!.variable).toEqual(['tas']);
    expect(result[0]!.realm).toBe('atmos');
  });

  it('returns null for missing column values', () => {
    const rows = [{ variable: null }];
    const result = normalizeDatastoreRows(rows, ['variable']);
    expect(result[0]!.variable).toBeNull();
  });
});

describe('deriveFilterOptionsFromRows', () => {
  it('collects unique sorted values per column', () => {
    const rows = [
      { variable: 'pr', realm: 'ocean' },
      { variable: ['tas', 'pr'], realm: 'atmos' },
    ];
    const opts = deriveFilterOptionsFromRows(rows as any, ['variable', 'realm']);
    expect(opts.variable).toEqual(['pr', 'tas']);
    expect(opts.realm).toEqual(['atmos', 'ocean']);
  });

  it('skips path and filename columns', () => {
    const rows = [{ path: '/data/file.nc', filename: 'file.nc', realm: 'atmos' }];
    const opts = deriveFilterOptionsFromRows(rows as any, ['path', 'filename', 'realm']);
    expect(opts.path).toBeUndefined();
    expect(opts.filename).toBeUndefined();
    expect(opts.realm).toEqual(['atmos']);
  });

  it('ignores null and empty values', () => {
    const rows = [{ variable: null }, { variable: '' }, { variable: 'tas' }];
    const opts = deriveFilterOptionsFromRows(rows as any, ['variable']);
    expect(opts.variable).toEqual(['tas']);
  });
});

describe('processListField — fallback branch', () => {
  it('converts a raw number value to a single-element string array via normalizeCatalogRows', () => {
    // processListField is not exported; exercise it indirectly via normalizeCatalogRows.
    // Passing a bare number for `realm` (not null, not array, not string, not DuckDB vector)
    // hits the `return [String(value)]` fallback on line 32 of parquetTransforms.ts.
    const rows = normalizeCatalogRows([
      {
        name: 'test',
        model: [],
        description: '',
        realm: 42 as any,
        frequency: [],
        variable: [],
        yaml: null,
      },
    ]);
    expect(rows[0]!.realm).toEqual(['42']);
  });
});

describe('queryMetaCatalogPq', () => {
  it('registers the file buffer and returns normalized catalog rows and raw sample', async () => {
    const rawRows = [
      {
        name: 'cat1',
        model: { toArray: () => ['ACCESS-CM2'] },
        description: 'desc',
        realm: { toArray: () => ['atmos'] },
        frequency: { toArray: () => ['mon'] },
        variable: { toArray: () => ['tas'] },
        yaml: 'sources: {}',
      },
    ];
    const mockDb = {
      registerFileBuffer: vi.fn().mockResolvedValue(undefined),
    };
    const mockConn = {
      query: vi.fn().mockResolvedValue({ toArray: () => rawRows }),
    };

    const result = await queryMetaCatalogPq(mockDb as any, mockConn as any, new Uint8Array([1, 2, 3]));

    expect(mockDb.registerFileBuffer).toHaveBeenCalledWith('metacatalog.parquet', expect.any(Uint8Array));
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.name).toBe('cat1');
    expect(result.rawDataSample).toHaveLength(1);
  });
});

describe('loadEsmDatastore', () => {
  it('queries schema and data and returns transformed rows', async () => {
    const schemaRows = [{ column_name: 'realm' }, { column_name: 'frequency' }, { column_name: 'filename' }];
    const dataRows = [
      { realm: { toArray: () => ['atmos'] }, frequency: { toArray: () => ['mon'] }, filename: 'f.parquet' },
    ];

    const mockConn = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ toArray: () => schemaRows }) // DESCRIBE query
        .mockResolvedValueOnce({ toArray: () => dataRows }), // SELECT * query
    };

    const result = await loadEsmDatastore(mockConn as any, 'test.parquet');

    // filename column is filtered out; realm and frequency remain
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('realm');
    expect(result[0]).toHaveProperty('frequency');
    expect(result[0]).not.toHaveProperty('filename');
  });

  it('collapses single-element arrays to scalar values', async () => {
    const schemaRows = [{ column_name: 'realm' }];
    const dataRows = [{ realm: { toArray: () => ['atmos'] } }];

    const mockConn = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ toArray: () => schemaRows })
        .mockResolvedValueOnce({ toArray: () => dataRows }),
    };

    const result = await loadEsmDatastore(mockConn as any, 'test.parquet');
    expect(result[0]!['realm']).toBe('atmos');
  });

  it('returns null for empty vector values', async () => {
    const schemaRows = [{ column_name: 'variable' }];
    const dataRows = [{ variable: { toArray: () => [] } }];

    const mockConn = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ toArray: () => schemaRows })
        .mockResolvedValueOnce({ toArray: () => dataRows }),
    };

    const result = await loadEsmDatastore(mockConn as any, 'test.parquet');
    expect(result[0]!['variable']).toBeNull();
  });
});

describe('getEsmDatastoreSize', () => {
  it('returns num_records from parquet metadata', async () => {
    const encoder = new TextEncoder();
    const mockConn = {
      query: vi.fn().mockResolvedValue({
        toArray: () => [{ key: encoder.encode('num_records'), value: encoder.encode('42') }],
      }),
    };

    const result = await getEsmDatastoreSize(mockConn as any, 'test_uniqs.parquet');
    expect(result).toBe(42);
  });

  it('returns 1000000 when num_records key is missing', async () => {
    const encoder = new TextEncoder();
    const mockConn = {
      query: vi.fn().mockResolvedValue({
        toArray: () => [{ key: encoder.encode('other_key'), value: encoder.encode('somevalue') }],
      }),
    };

    const result = await getEsmDatastoreSize(mockConn as any, 'test_uniqs.parquet');
    expect(result).toBe(1000000);
  });

  it('returns 1000000 when the query throws', async () => {
    const mockConn = {
      query: vi.fn().mockRejectedValue(new Error('Query failed')),
    };

    const result = await getEsmDatastoreSize(mockConn as any, 'test_uniqs.parquet');
    expect(result).toBe(1000000);
  });
});
