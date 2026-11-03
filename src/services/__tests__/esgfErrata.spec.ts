import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkEsgfErrata } from '../esgfErrata';

const drs = 'CMIP6.DAMIP.NASA-GISS.GISS-E2-1-G.hist-sol.r1i1p1f1.AERmon.bldep.gn';
const dataset = { id: `${drs}.v20180912`, version: '20180912' };
const uid = '37a3c47a-3bf9-fb67-861c-6b49fcecae4c';
const issueUrl = `https://errata.esgf.io/static/view.html?uid=${uid}`;
const entry = { drs, version: '20180912', success: true, has_errata: true, errata_ids: `['${uid}']` };
const signal = () => new AbortController().signal;
const json = (body: unknown) => ({ ok: true, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe('ESGF version-specific errata', () => {
  it('resolves a PID-keyed response with the service’s Python-style issue list', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ '21.14100/example': entry }));
    vi.stubGlobal('fetch', fetch);
    expect(await checkEsgfErrata(dataset, signal())).toEqual({ status: 'reported', issueUrls: [issueUrl] });
    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.origin + url.pathname).toBe('https://errata.esgf.io/1/resolve/simple-pid');
    expect(url.searchParams.get('datasets')).toBe(dataset.id);
    expect(fetch.mock.calls[0]![1]).toMatchObject({ credentials: 'omit', headers: { Accept: 'application/json' } });
  });

  it('handles array issue IDs, deduplicates links, and never trusts arbitrary URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({ a: { ...entry, errata_ids: [uid, uid.toUpperCase(), 'javascript:alert(1)', 'https://example.org'] } }),
        ),
    );
    expect(await checkEsgfErrata(dataset, signal())).toEqual({ status: 'reported', issueUrls: [issueUrl] });
  });

  it('keeps a reported flag even if the service omits usable issue links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ a: { ...entry, errata_ids: null } })));
    expect(await checkEsgfErrata(dataset, signal())).toEqual({ status: 'reported', issueUrls: [] });
  });

  it('does not inherit an earlier version’s errata', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          json({ old: entry, current: { ...entry, version: '20200101', has_errata: false, errata_ids: [] } }),
        )
        .mockResolvedValue(json({ count: 0, results: [] })),
    );
    expect(await checkEsgfErrata({ id: `${drs}.v20200101`, version: 'v20200101' }, signal())).toEqual({
      status: 'none',
      issueUrls: [],
    });
  });

  it('preserves the full CMIP7 versioned identifier', async () => {
    const cmip7 = 'MIP-DRS7.CMIP7.CMIP.CCCma.CanESM6-0-MR.historical.r9i1p1f1.glb.mon.tas.tavg-h2m-hxy-u.g150';
    const fetch = vi.fn().mockResolvedValue(json({ pid: { ...entry, drs: cmip7 } }));
    vi.stubGlobal('fetch', fetch);
    expect(await checkEsgfErrata({ ...dataset, id: `${cmip7}.v20180912` }, signal())).toEqual({
      status: 'reported',
      issueUrls: [issueUrl],
    });
    expect(new URL(fetch.mock.calls[0]![0]).searchParams.get('datasets')).toBe(`${cmip7}.v20180912`);
  });

  it.each([
    {},
    null,
    [],
    { error_message: 'HANDLE WAS NOT FOUND ON HANDLE SERVER' },
    { pid: { ...entry, drs: 'CMIP6.other' } },
    { pid: { ...entry, version: '20190101' } },
    { pid: { ...entry, success: false } },
    { pid: { ...entry, has_errata: 'false' } },
    { pid: { ...entry, has_errata: false } },
  ])('treats unresolved, mismatched or inconsistent responses as unknown: %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(body)));
    expect(await checkEsgfErrata(dataset, signal())).toEqual({ status: 'unknown', issueUrls: [] });
  });

  it.each([
    { id: drs, version: '' },
    { ...dataset, version: '20200101' },
    { id: `${dataset.id},another-dataset`, version: '' },
  ])('does not query a missing or inconsistent version: %j', async (input) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await checkEsgfErrata(input, signal())).status).toBe('unknown');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps service errors unknown', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }).mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    expect((await checkEsgfErrata(dataset, signal())).status).toBe('unknown');
    expect((await checkEsgfErrata(dataset, signal())).status).toBe('unknown');
  });

  it('cancels in-flight lookups with the search signal', async () => {
    const controller = new AbortController();
    let requestSignal!: AbortSignal;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            requestSignal = options.signal;
            requestSignal.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      ),
    );
    const request = checkEsgfErrata(dataset, controller.signal);
    controller.abort();
    expect(requestSignal.aborted).toBe(true);
    expect((await request).status).toBe('unknown');
  });
});
