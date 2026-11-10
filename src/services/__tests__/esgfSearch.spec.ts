import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCmipNciVersions } from '../cmipNciVersions';
vi.mock('../cmipNciVersions', () => ({ fetchCmipNciVersions: vi.fn() }));
import {
  buildEsgfSearchUrl,
  checkNciAvailability,
  getReplicaProject,
  fetchEsgfFilterOptions,
  searchEsgf,
  type EsgfDataset,
} from '../esgfSearch';

const signal = () => new AbortController().signal;
const json = (body: unknown) => ({ ok: true, json: async () => body });
const cmip6 = {
  instance_id: 'CMIP6.CMIP.INST.Model.historical.r1i1p1f1.Amon.tas.gn.v20250101',
  version: '20250101',
  activity_id: ['CMIP'],
  institution_id: ['INST'],
  source_id: ['Model'],
  experiment_id: ['historical'],
  member_id: ['r1i1p1f1'],
  table_id: ['Amon'],
  variable_id: ['tas'],
  grid_label: ['gn'],
  data_node: 'esgf.example.org',
  number_of_files: 2,
  size: 1000,
};
const cmip7 = {
  id: 'MIP-DRS7.CMIP7.CMIP.INST.Model.historical.r1i1p1f1.glb.mon.tas.tavg-h2m-hxy-u.gn.v20250101',
  properties: {
    version: '20250101',
    'cmip7:activity_id': 'CMIP',
    'cmip7:institution_id': 'INST',
    'cmip7:source_id': 'Model',
    'cmip7:experiment_id': 'historical',
    'cmip7:variant_label': 'r1i1p1f1',
    'cmip7:region': 'glb',
    'cmip7:frequency': 'mon',
    'cmip7:variable_branded_name': 'tas_tavg-h2m-hxy-u',
    'cmip7:variable_id': 'tas',
    'cmip7:temporal_label': 'tavg',
    'cmip7:vertical_label': 'h2m',
    'cmip7:horizontal_label': 'hxy',
    'cmip7:area_label': 'u',
    'cmip7:grid_label': 'gn',
    size: 1000,
  },
  assets: {
    'tas.nc': {
      href: 'https://esgf.example.org/tas.nc',
      'file:size': 1000,
      alternate: { nci: { href: 'https://esgf.nci.org.au/tas.nc' } },
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(fetchCmipNciVersions).mockReset();
});

describe('ESGF dropdown facets', () => {
  it('requests full CMIP6 facets without dataset pages and maps names and versions back to NCI fields', async () => {
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input);
      const facets = Object.fromEntries(
        url.searchParams
          .get('facets')!
          .split(',')
          .map((field) => [field, []]),
      );
      return json({
        facet_counts: {
          facet_fields: {
            ...facets,
            activity_id: ['CMIP', 5],
            version: ['20250101', 2],
            source_id: ['RemoteModel', 4, 'EmptyModel', 0],
          },
        },
      });
    });
    vi.stubGlobal('fetch', fetch);
    expect(await fetchEsgfFilterOptions('CMIP6', signal())).toMatchObject({
      project_id: ['CMIP'],
      version: ['v20250101'],
      source_id: ['RemoteModel'],
    });
    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.searchParams.get('limit')).toBe('0');
    expect(url.searchParams.get('facets')).toContain('activity_id');
    expect(url.searchParams.get('facets')).not.toContain('project_id');
    expect(url.searchParams.get('latest')).toBe('true');
  });

  function stacFacets(overflow = 0) {
    return vi.fn(async (input: string) => {
      const names = new URL(input).searchParams.get('aggregations')!.split(',');
      return json({
        aggregations: names.map((name) => ({
          name,
          overflow,
          buckets:
            name === 'cmip7_variable_branded_name_frequency'
              ? [
                  { key: 'tas_tavg-h2m-hxy-u', frequency: 12 },
                  { key: 'unused', frequency: 0 },
                ]
              : [],
        })),
      });
    });
  }

  it('uses CMIP7 aggregations instead of the first result page and maps branded variables', async () => {
    const fetch = stacFacets();
    vi.stubGlobal('fetch', fetch);
    expect(await fetchEsgfFilterOptions('CMIP7', signal())).toMatchObject({ branded_variable: ['tas_tavg-h2m-hxy-u'] });
    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.pathname).toBe('/aggregate');
    expect(url.searchParams.get('collections')).toBe('CMIP7');
    expect(url.searchParams.get('limit')).toBe('10000');
    expect(url.searchParams.get('filter')).toContain('properties.latest');
  });

  it('rejects truncated STAC facet responses', async () => {
    vi.stubGlobal('fetch', stacFacets(3));
    await expect(fetchEsgfFilterOptions('CMIP7', signal())).rejects.toThrow('incomplete');
  });

  it('includes dependent selections in CMIP7 facet aggregation requests', async () => {
    const fetch = stacFacets();
    vi.stubGlobal('fetch', fetch);
    await fetchEsgfFilterOptions('CMIP7', signal(), {
      variable_id: ['tas'],
      realm: ['atmos'],
      frequency: ['day', 'mon'],
    });
    const url = new URL(fetch.mock.calls[0]![0]);
    const filter = JSON.parse(url.searchParams.get('filter')!);
    expect(filter.args).toContainEqual({ op: '=', args: [{ property: 'properties.cmip7:variable_id' }, 'tas'] });
    expect(filter.args).toContainEqual({ op: '=', args: [{ property: 'properties.cmip7:realm' }, 'atmos'] });
    expect(filter.args).toContainEqual({
      op: 'or',
      args: [
        { op: '=', args: [{ property: 'properties.cmip7:frequency' }, 'day'] },
        { op: '=', args: [{ property: 'properties.cmip7:frequency' }, 'mon'] },
      ],
    });
  });

  it('includes dependent selections and explicit versions in CMIP6 facet requests', async () => {
    const fetch = vi.fn(async (input: string) =>
      json({
        facet_counts: {
          facet_fields: Object.fromEntries(
            new URL(input).searchParams
              .get('facets')!
              .split(',')
              .map((field) => [field, []]),
          ),
        },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    await fetchEsgfFilterOptions('CMIP6', signal(), {
      realm: ['ocean'],
      variable_id: ['tos', 'so'],
      version: ['v20260101'],
    });
    const params = new URL(fetch.mock.calls[0]![0]).searchParams;
    expect(params.get('realm')).toBe('ocean');
    expect(params.getAll('variable_id')).toEqual(['tos', 'so']);
    expect(params.get('version')).toBe('20260101');
    expect(params.has('latest')).toBe(false);
  });

  it.each(['CMIP6', 'CMIP7'] as const)('rejects missing %s facet metadata', async (project) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({})));
    await expect(fetchEsgfFilterOptions(project, signal())).rejects.toThrow('Invalid');
  });

  it('rejects incomplete distributed facets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ responseHeader: { partialResults: true } })));
    await expect(fetchEsgfFilterOptions('CMIP6', signal())).rejects.toThrow('incomplete');
  });
});

describe('ESGF searches', () => {
  it('limits opt-in to the two supported replica collections', () => {
    expect(getReplicaProject('cmip6_oi10')).toBe('CMIP6');
    expect(getReplicaProject('cmip7_replicated')).toBe('CMIP7');
    expect(getReplicaProject('cmip7_australian')).toBeNull();
    expect(getReplicaProject('esmvaltool-obs-ct11')).toBeNull();
  });

  it('maps CMIP6 activity and OR facets, includes replicas, and honours explicit older versions', () => {
    const url = new URL(
      buildEsgfSearchUrl('CMIP6', { project_id: ['CMIP'], variable_id: ['tas', 'pr'], version: ['v20200101'] }, '10'),
    );
    expect(url.searchParams.get('activity_id')).toBe('CMIP');
    expect(url.searchParams.getAll('variable_id')).toEqual(['tas', 'pr']);
    expect(url.searchParams.get('version')).toBe('20200101');
    expect(url.searchParams.has('latest')).toBe(false);
    expect(url.searchParams.has('replica')).toBe(false);
    expect(url.searchParams.get('offset')).toBe('10');
    expect(url.searchParams.get('retracted')).toBe('false');
  });

  it('uses CMIP7 namespaced CQL filters with OR within and AND between facets', () => {
    const url = new URL(
      buildEsgfSearchUrl('CMIP7', { branded_variable: ['tas_tavg-h2m-hxy-u'], source_id: ['A', 'B'] }, 'next+token'),
    );
    const filter = JSON.parse(url.searchParams.get('filter')!);
    expect(filter.op).toBe('and');
    expect(filter.args).toContainEqual({ op: '=', args: [{ property: 'properties.latest' }, true] });
    expect(filter.args).toContainEqual({
      op: '=',
      args: [{ property: 'properties.cmip7:variable_branded_name' }, 'tas_tavg-h2m-hxy-u'],
    });
    expect(filter.args[3].op).toBe('or');
    expect(url.searchParams.get('token')).toBe('next+token');
  });

  it('does not silently drop local-only filters', () => {
    expect(() => buildEsgfSearchUrl('CMIP6', { time_range: ['185001-185912'] })).toThrow('time_range');
  });

  it('translates compound NCI realm values to membership checks on the STAC array', () => {
    const url = new URL(buildEsgfSearchUrl('CMIP7', { realm: ['landIce land', 'ocean'] }));
    const clause = JSON.parse(url.searchParams.get('filter')!).args[2];
    expect(clause.op).toBe('or');
    expect(clause.args[0]).toEqual({
      op: 'and',
      args: [
        { op: '=', args: [{ property: 'properties.cmip7:realm' }, 'landIce'] },
        { op: '=', args: [{ property: 'properties.cmip7:realm' }, 'land'] },
      ],
    });
  });

  it('deduplicates replica nodes by versioned ID without losing distinct versions or pagination', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          response: {
            numFound: 12,
            docs: [
              cmip6,
              { ...cmip6, data_node: 'replica.example.org' },
              { ...cmip6, instance_id: 'older-version', version: '20200101' },
            ],
          },
        }),
      ),
    );
    const page = await searchEsgf('CMIP6', {}, signal());
    expect(page.datasets).toHaveLength(2);
    expect(page.datasets[0]?.nodes).toEqual(['esgf.example.org', 'replica.example.org']);
    expect(page.next).toBe('3');
    expect(page.total).toBe(12);
    const portal = new URL(page.datasets[0]!.portalUrl);
    expect(portal.searchParams.get('minVersionDate')).toBe('20250101');
    expect(portal.searchParams.get('versionType')).toBe('all');
  });

  it('normalizes STAC facets and assets and extracts only the next token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          features: [cmip7],
          numberMatched: 20,
          links: [{ rel: 'next', href: 'https://search.east.esgf.io/search?token=abc%2Bdef' }],
        }),
      ),
    );
    const page = await searchEsgf('CMIP7', {}, signal());
    expect(page.datasets[0]?.facets.branded_variable).toEqual(['tas_tavg-h2m-hxy-u']);
    expect(page.datasets[0]?.nodes).toEqual(['esgf.example.org', 'esgf.nci.org.au']);
    expect(page.datasets[0]?.fileCount).toBe(1);
    expect(page.next).toBe('abc+def');
    const portal = new URL(page.datasets[0]!.portalUrl);
    const facets = JSON.parse(portal.searchParams.get('activeFacets')!);
    expect(facets).toMatchObject({
      variable_id: ['tas'],
      temporal_label: ['tavg'],
      vertical_label: ['h2m'],
      horizontal_label: ['hxy'],
      area_label: ['u'],
    });
    expect(facets.variable_branded_name).toBeUndefined();
  });

  it.each([{ response: {} }, { response: { numFound: 1, docs: [{}] } }])(
    'rejects malformed responses instead of reporting no matches',
    async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(body)));
      await expect(searchEsgf('CMIP6', {}, signal())).rejects.toThrow();
    },
  );

  it('rejects a partial distributed search rather than reporting a complete result', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(json({ responseHeader: { partialResults: true }, response: { numFound: 0, docs: [] } })),
    );
    await expect(searchEsgf('CMIP6', {}, signal())).rejects.toThrow('incomplete');
  });
});

describe('NCI comparison', () => {
  async function dataset(project: 'CMIP6' | 'CMIP7' = 'CMIP6'): Promise<EsgfDataset> {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json(project === 'CMIP6' ? { response: { numFound: 1, docs: [cmip6] } } : { features: [cmip7] }),
        ),
    );
    return (await searchEsgf(project, {}, signal())).datasets[0]!;
  }

  it('checks both full catalogues, including Australian submissions, using the full dataset identity', async () => {
    const item = await dataset();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ total: 0, records: [] }))
      .mockResolvedValueOnce(json({ total: 2, records: [{}], dynamic_filter_options: { version: ['v20250101'] } }));
    vi.stubGlobal('fetch', fetch);
    expect(await checkNciAvailability(item, signal())).toEqual({ status: 'listed', collections: ['cmip6_fs38'] });
    const query = new URL(fetch.mock.calls[0]![0], 'http://localhost');
    expect(JSON.parse(query.searchParams.get('filters')!)).toMatchObject({
      project_id: ['CMIP'],
      member_id: ['r1i1p1f1'],
      table_id: ['Amon'],
      grid_label: ['gn'],
    });
    expect(fetch.mock.calls[1]![0]).toContain('cmip6_fs38');
  });

  it('distinguishes a different CMIP6 version from the requested version', async () => {
    const item = await dataset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ total: 1, records: [{}], dynamic_filter_options: { version: ['v20200101'] } })),
    );
    expect((await checkNciAvailability(item, signal())).status).toBe('different-version');
  });

  it.each(['20250101', 'v20250101'])('verifies a CMIP7 version %s across all local paths', async (version) => {
    const item = await dataset('CMIP7');
    item.version = version;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ total: 100, records: [{}] })));
    vi.mocked(fetchCmipNciVersions)
      .mockResolvedValueOnce(['v20240101'])
      .mockResolvedValueOnce(['v20240101', 'latest', 'v20250101']);
    expect(await checkNciAvailability(item, signal())).toEqual({
      status: 'listed',
      collections: ['cmip7_australian'],
    });
    expect(fetchCmipNciVersions).toHaveBeenCalledWith(
      'CMIP7',
      'cmip7_australian',
      {
        activity_id: ['CMIP'],
        institution_id: ['INST'],
        source_id: ['Model'],
        experiment_id: ['historical'],
        variant_label: ['r1i1p1f1'],
        region: ['glb'],
        frequency: ['mon'],
        branded_variable: ['tas_tavg-h2m-hxy-u'],
        grid_label: ['gn'],
      },
      expect.any(AbortSignal),
    );
  });

  it('reports a different CMIP7 version only after both catalogues and all dated paths are checked', async () => {
    const item = await dataset('CMIP7');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ total: 1, records: [{}] })));
    vi.mocked(fetchCmipNciVersions).mockResolvedValue(['v20240101', 'v20260101']);
    expect((await checkNciAvailability(item, signal())).status).toBe('different-version');
  });

  it.each([null, 'latest'])('keeps undated CMIP7 paths %s unverified', async (undated) => {
    const item = await dataset('CMIP7');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ total: 1, records: [{}] })));
    vi.mocked(fetchCmipNciVersions).mockResolvedValue(['v20240101', undated]);
    expect((await checkNciAvailability(item, signal())).status).toBe('version-unverified');
  });

  it.each(['failed', 'empty'])('does not infer a different version from a %s path lookup', async (mode) => {
    const item = await dataset('CMIP7');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ total: 1, records: [{}] })));
    vi.mocked(fetchCmipNciVersions).mockResolvedValueOnce(['v20240101']);
    if (mode === 'failed') vi.mocked(fetchCmipNciVersions).mockRejectedValueOnce(new Error('offline'));
    else vi.mocked(fetchCmipNciVersions).mockResolvedValueOnce([]);
    expect((await checkNciAvailability(item, signal())).status).toBe('unknown');
  });

  it.each(['v20250101', 'v20240101'])('handles a failed collection check when another has %s', async (version) => {
    const item = await dataset('CMIP7');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(json({ total: 1, records: [{}] })),
    );
    vi.mocked(fetchCmipNciVersions).mockResolvedValueOnce([version]);
    expect((await checkNciAvailability(item, signal())).status).toBe(version === 'v20250101' ? 'listed' : 'unknown');
  });

  it('does not guess an absent ESGF version or query versions for a zero-match collection', async () => {
    const item = await dataset('CMIP7');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ total: 0, records: [] })));
    expect((await checkNciAvailability(item, signal())).status).toBe('missing');
    item.version = '';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ total: 1, records: [{}] })));
    expect((await checkNciAvailability(item, signal())).status).toBe('version-unverified');
    expect(fetchCmipNciVersions).not.toHaveBeenCalled();
  });

  it('discards a version result when the search was cancelled', async () => {
    const item = await dataset('CMIP7');
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ total: 1, records: [{}] })));
    vi.mocked(fetchCmipNciVersions).mockImplementation(async () => {
      controller.abort();
      return ['v20250101'];
    });
    await expect(checkNciAvailability(item, controller.signal)).rejects.toThrow();
  });

  it('reports absence only after successful zero-match checks in both collections', async () => {
    const item = await dataset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ total: 0, records: [] })));
    expect((await checkNciAvailability(item, signal())).status).toBe('missing');
  });

  it('leaves availability unknown after a failed lookup, rather than claiming absence', async () => {
    const item = await dataset();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ total: 0, records: [] }))
        .mockRejectedValueOnce(new Error('offline')),
    );
    expect((await checkNciAvailability(item, signal())).status).toBe('unknown');
  });

  it('does not query NCI with incomplete identity metadata', async () => {
    const item = await dataset();
    delete item.facets.grid_label;
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await checkNciAvailability(item, signal())).status).toBe('unknown');
    expect(fetch).not.toHaveBeenCalled();
  });
});
