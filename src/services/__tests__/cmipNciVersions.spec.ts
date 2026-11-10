import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCmipNciVersions } from '../cmipNciVersions';
import { initializeDuckDB } from '../duckdbClient';

vi.mock('../duckdbClient', () => ({ initializeDuckDB: vi.fn() }));
const db = { registerFileURL: vi.fn(), terminate: vi.fn() };
const conn = { query: vi.fn(), prepare: vi.fn() };
const statement = { query: vi.fn(), close: vi.fn() };
const fetchVersions = (signal = new AbortController().signal) =>
  fetchCmipNciVersions('CMIP7', 'cmip7_australian', { source_id: ['ACCESS-ESM1-6'] }, signal);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ assets: { column_name: 'path' } }) }),
  );
  vi.mocked(initializeDuckDB).mockResolvedValue({ db, conn } as any);
  db.terminate.mockResolvedValue(undefined);
  conn.query.mockResolvedValue({
    toArray: () => [
      { column_name: 'path', column_type: 'VARCHAR' },
      { column_name: 'source_id', column_type: 'VARCHAR' },
    ],
  });
  conn.prepare.mockResolvedValue(statement);
  statement.query.mockResolvedValue({
    toArray: () => [{ version: 'v20261019' }, { version: 'latest' }, { version: null }],
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('CMIP NCI version lookup', () => {
  it('reads distinct versions from all matching paths and releases the worker', async () => {
    expect(await fetchVersions()).toEqual(['v20261019', 'latest', null]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('cmip7_australian.json'), expect.any(Object));
    expect(db.registerFileURL.mock.calls[0]![1]).toContain('cmip7_australian.parquet');
    const sql = conn.prepare.mock.calls[0]![0];
    expect(sql).toContain('SELECT DISTINCT version FROM matching');
    expect(sql).not.toContain('LIMIT');
    expect(statement.query).toHaveBeenCalledWith('ACCESS-ESM1-6');
    expect(statement.close).toHaveBeenCalledOnce();
    expect(db.terminate).toHaveBeenCalledOnce();
  });

  it.each(['query', 'schema'])('releases the worker after a %s failure', async (failure) => {
    if (failure === 'query') statement.query.mockRejectedValueOnce(new Error('offline'));
    else conn.query.mockResolvedValueOnce({ toArray: () => [] });
    await expect(fetchVersions()).rejects.toThrow();
    expect(db.terminate).toHaveBeenCalledOnce();
  });

  it.each(['http', 'path'])('rejects an invalid descriptor (%s) before starting a worker', async (failure) => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: failure !== 'http', status: 503, json: async () => ({}) } as Response);
    await expect(fetchVersions()).rejects.toThrow();
    expect(initializeDuckDB).not.toHaveBeenCalled();
  });

  it('does not start a cancelled lookup', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(fetchVersions(controller.signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('terminates an in-flight lookup and rejects its late response', async () => {
    const controller = new AbortController();
    let finish!: (value: unknown) => void;
    statement.query.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = fetchVersions(controller.signal);
    const rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(statement.query).toHaveBeenCalled());
    controller.abort();
    expect(db.terminate).toHaveBeenCalledOnce();
    finish({ toArray: () => [{ version: 'v20261019' }] });
    await rejected;
    expect(statement.close).not.toHaveBeenCalled();
    expect(db.terminate).toHaveBeenCalledOnce();
  });
});
