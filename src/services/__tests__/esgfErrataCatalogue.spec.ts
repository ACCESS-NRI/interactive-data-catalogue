import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkEsgfErrata, type ErrataRequestCache } from '../esgfErrata';

const dust = {
  id: 'CMIP6.CMIP.MOHC.UKESM1-0-LL.historical.r1i1p1f2.AERmon.emidust.gn.v20190406',
  version: '20190406',
};
const issueId = '89a13e84-47f1-a04d-a6c9-e0ac0330c769';
const issue = { uid: issueId, datasets: [dust.id.replace('.v20190406', '#20190406')] };
const noPidErrata = {
  pid: {
    drs: dust.id.replace('.v20190406', ''),
    version: dust.version,
    success: true,
    has_errata: false,
    errata_ids: [],
  },
};
const search = { count: 1, results: [{ uid: issueId }] };
const signal = () => new AbortController().signal;
const json = (body: unknown) => ({ ok: true, json: async () => body });

function mockApi(options: { pid?: unknown; search?: unknown; detail?: unknown; failDetail?: boolean } = {}) {
  const fetch = vi.fn(async (input: string) => {
    const url = new URL(input);
    if (url.pathname === '/1/resolve/simple-pid') return json(options.pid ?? noPidErrata);
    if (url.pathname === '/2/search/errata') return json(options.search ?? search);
    if (url.pathname === '/2/publication/retrieve') {
      if (options.failDetail) throw new Error('unavailable');
      return json(options.detail ?? { issue });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('issue catalogue fallback for missing PID flags', () => {
  it('flags the real UKESM dust example even when its PID says has_errata=false', async () => {
    const fetch = mockApi();
    expect(await checkEsgfErrata(dust, signal())).toEqual({
      status: 'reported',
      issueUrls: [`https://errata.esgf.io/static/view.html?uid=${issueId}`],
    });
    const query = new URL(fetch.mock.calls[1]![0]);
    expect(Object.fromEntries(query.searchParams)).toEqual({
      project: 'cmip6',
      source_id: 'ukesm1-0-ll',
      experiment_id: 'historical',
      table_id: 'aermon',
    });
  });

  it('can report a published issue even when the PID is unresolved', async () => {
    mockApi({ pid: { error_message: 'HANDLE WAS NOT FOUND' } });
    expect((await checkEsgfErrata(dust, signal())).status).toBe('reported');
  });

  it('does not flag a different dataset version just because its facets match', async () => {
    mockApi({ detail: { issue: { ...issue, datasets: [dust.id.replace('20190406', '20180101')] } } });
    expect((await checkEsgfErrata(dust, signal())).status).toBe('none');
  });

  it.each([
    { search: { count: 2, results: [{ uid: issueId }] } },
    { search: { count: 1, results: [{ uid: 'invalid' }] } },
    { detail: { issue: { uid: issueId } } },
    { detail: { issue: { ...issue, uid: '37a3c47a-3bf9-fb67-861c-6b49fcecae4c' } } },
    { failDetail: true },
  ])('does not accept a negative PID result when the catalogue check is incomplete: %j', async (options) => {
    mockApi(options);
    expect((await checkEsgfErrata(dust, signal())).status).toBe('unknown');
  });

  it('shares in-flight catalogue and issue requests across datasets in the same search', async () => {
    const fetch = mockApi();
    const cache: ErrataRequestCache = new Map();
    const controller = new AbortController();
    const results = await Promise.all([
      checkEsgfErrata(dust, controller.signal, cache),
      checkEsgfErrata(dust, controller.signal, cache),
    ]);
    expect(results.every((result) => result.status === 'reported')).toBe(true);
    expect(fetch.mock.calls.filter(([url]) => url.includes('/2/'))).toHaveLength(2);
    cache.clear();
    await checkEsgfErrata(dust, controller.signal, cache);
    expect(fetch.mock.calls.filter(([url]) => url.includes('/2/'))).toHaveLength(4);
  });

  it('retries failed issue requests instead of caching a failure', async () => {
    const fetch = mockApi({ failDetail: true });
    const cache: ErrataRequestCache = new Map();
    expect((await checkEsgfErrata(dust, signal(), cache)).status).toBe('unknown');
    fetch.mockImplementation(async (url) => (url.includes('/1/') ? json(noPidErrata) : json({ issue })));
    expect((await checkEsgfErrata(dust, signal(), cache)).status).toBe('reported');
  });
});
