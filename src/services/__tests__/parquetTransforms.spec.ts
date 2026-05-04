import { describe, expect, it, vi } from 'vitest';
import { buildRawDataSample, getFilterOptions, normalizeCatalogRows, setupColumns } from '../parquetTransforms';

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
