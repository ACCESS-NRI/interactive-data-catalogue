import { afterEach, describe, expect, it, vi } from 'vitest';
import { accessFilters, fetchCmipNciOptions, fetchCmipNciPage } from '../cmipSearch';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const response = (body: unknown) => Promise.resolve({ ok: true, json: async () => body });

describe('CMIP scope queries', () => {
  it.each(['CMIP6', 'CMIP7'] as const)(
    'fetches only publication facets for %s ACCESS-only selections',
    async (project) => {
      const fetcher = vi
        .fn()
        .mockImplementation(() =>
          response({ total: 1, records: [{}], dynamic_filter_options: { source_id: ['ACCESS-ESM1-6'] } }),
        );
      vi.stubGlobal('fetch', fetcher);
      await fetchCmipNciOptions(project, new AbortController().signal, { variable_id: ['tas'] }, true);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher.mock.lastCall![0]).toContain(project === 'CMIP6' ? 'cmip6_fs38?' : 'cmip7_australian?');
    },
  );

  it('allows longer local catalogue queries and reports a timeout separately from cancellation', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url: string, { signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const request = fetchCmipNciPage('cmip6_fs38', {}, new AbortController().signal);
    const assertion = expect(request).rejects.toThrow('Search timed out. Try again or narrow your filters.');
    await vi.advanceTimersByTimeAsync(20_001);
    expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(40_000);
    await assertion;
  });

  it('intersects selected models with ACCESS without overwriting other filters or sending an empty model list', () => {
    const options = { source_id: ['ACCESS-ESM1-6', 'ACCESS-CM3', 'OtherModel'] };
    expect(accessFilters({ variable_id: ['tas'] }, options)).toEqual({
      variable_id: ['tas'],
      source_id: ['ACCESS-ESM1-6', 'ACCESS-CM3'],
    });
    const filters = { source_id: ['OtherModel', 'ACCESS-CM3'], experiment_id: ['historical'] };
    expect(accessFilters(filters, options)).toEqual({ ...filters, source_id: ['ACCESS-CM3'] });
    expect(filters.source_id).toEqual(['OtherModel', 'ACCESS-CM3']);
    expect(accessFilters({ source_id: ['OtherModel'] }, options)).toBeNull();
    expect(accessFilters({}, { source_id: ['OtherModel'] })).toBeNull();
  });

  it.each(['CMIP6', 'CMIP7'] as const)(
    'loads complete %s facets from both collections, including models beyond the first page',
    async (project) => {
      const fetcher = vi
        .fn()
        .mockImplementationOnce(() =>
          response({
            total: 50,
            records: [{ source_id: 'ACCESS-CM3' }],
            dynamic_filter_options: {
              source_id: ['ACCESS-CM3', 'ACCESS-ESM1-6'],
              variable_id: ['tas'],
              parent_experiment_id: ['piControl', null],
            },
          }),
        )
        .mockImplementationOnce(() =>
          response({
            total: 50,
            records: [{ source_id: 'OtherModel' }],
            dynamic_filter_options: { source_id: ['OtherModel'], variable_id: ['pr', 'tas'] },
          }),
        );
      vi.stubGlobal('fetch', fetcher);
      const options = await fetchCmipNciOptions(project, new AbortController().signal);
      expect(options).toEqual({
        source_id: ['ACCESS-CM3', 'ACCESS-ESM1-6', 'OtherModel'],
        variable_id: ['pr', 'tas'],
        parent_experiment_id: ['piControl'],
      });
      expect(fetcher.mock.calls[0]![0]).toContain(project === 'CMIP6' ? '/cmip6_fs38?' : '/cmip7_australian?');
      expect(fetcher.mock.calls[1]![0]).toContain(project === 'CMIP6' ? '/cmip6_oi10?' : '/cmip7_replicated?');
      expect(new URL(fetcher.mock.calls[0]![0], 'https://test.example').searchParams.get('filters')).toBe('{}');
    },
  );

  it('does not treat a failed or incomplete collection lookup as a complete model list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => response({ total: 10, records: [{}], dynamic_filter_options: {} })),
    );
    await expect(fetchCmipNciOptions('CMIP7', new AbortController().signal)).rejects.toThrow('NCI filter options');
  });

  it('gets constrained choices from both full catalogues even when one has no matching records', async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => response({ total: 0, records: [], dynamic_filter_options: {} }))
      .mockImplementationOnce(() =>
        response({
          total: 200,
          records: [{ variable_id: 'tas' }],
          dynamic_filter_options: { source_id: ['OtherModel'], branded_variable: ['tas_tavg', 'tas_tmax'] },
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchCmipNciOptions('CMIP7', new AbortController().signal, { variable_id: ['tas'] })).toEqual({
      source_id: ['OtherModel'],
      branded_variable: ['tas_tavg', 'tas_tmax'],
    });
    for (const call of fetcher.mock.calls) {
      const query = new URL(call[0], 'https://test.example').searchParams;
      expect(JSON.parse(query.get('filters')!)).toEqual({ variable_id: ['tas'] });
      expect(query.get('limit')).toBe('1');
    }
  });

  it('sends filters and pagination to the catalogue rather than filtering the loaded page', async () => {
    const fetcher = vi.fn().mockImplementation(() => response({ total: 0, records: [] }));
    vi.stubGlobal('fetch', fetcher);
    await fetchCmipNciPage(
      'cmip7_replicated',
      { source_id: ['ACCESS-CM3'], variable_id: ['tas'] },
      new AbortController().signal,
      20,
      10,
    );
    const params = new URL(fetcher.mock.calls[0]![0], 'https://test.example').searchParams;
    expect(params.get('offset')).toBe('20');
    expect(params.get('limit')).toBe('10');
    expect(JSON.parse(params.get('filters')!)).toEqual({ source_id: ['ACCESS-CM3'], variable_id: ['tas'] });
  });

  it('rejects malformed local responses instead of reporting no results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => response({ total: -1, records: [] })),
    );
    await expect(fetchCmipNciPage('cmip7_australian', {}, new AbortController().signal)).rejects.toThrow(
      'unexpected response',
    );
  });
});
