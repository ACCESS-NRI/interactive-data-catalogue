import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchMetaCatFile,
  fetchParquetArrayBuffer,
  fetchDatastoreParquet,
  fetchDatastoreSidecarParquet,
  getEsmDatastoreRecordCount,
  queryEsmDatastore,
  getEsmDatastoreProject,
} from '../catalogApi';
import { metacatUrl, buildDatastoreObjectStoreUrl, buildDatastoreSidecarUrl } from '../../config/catalogEndpoints';

describe('catalogApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchMetaCatFile', () => {
    it('fetches the metacatalog parquet file as a Uint8Array', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => bytes.buffer,
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(fetchMetaCatFile()).resolves.toEqual(bytes);
      expect(fetchMock).toHaveBeenCalledWith(metacatUrl);
    });

    it('throws when the metacatalog parquet fetch fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
        }),
      );

      await expect(fetchMetaCatFile()).rejects.toThrow('Failed to fetch parquet file: 503');
    });
  });

  describe('fetchParquetArrayBuffer', () => {
    it('returns an ArrayBuffer on success', async () => {
      const buffer = new ArrayBuffer(4);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => buffer }));

      await expect(fetchParquetArrayBuffer('https://example.com/file.parquet')).resolves.toBe(buffer);
    });

    it('throws when response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

      await expect(fetchParquetArrayBuffer('https://example.com/file.parquet')).rejects.toThrow(
        'Failed to fetch parquet file: 404',
      );
    });
  });

  describe('fetchDatastoreParquet', () => {
    it('fetches the datastore parquet and returns a Uint8Array', async () => {
      const bytes = new Uint8Array([10, 20, 30]);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer }));

      const result = await fetchDatastoreParquet('my-datastore');
      expect(result).toEqual(bytes);
    });

    it('calls the correct object store URL', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
      vi.stubGlobal('fetch', fetchMock);

      await fetchDatastoreParquet('my-datastore');
      expect(fetchMock).toHaveBeenCalledWith(buildDatastoreObjectStoreUrl('my-datastore'), { method: 'GET' });
    });
  });

  describe('fetchDatastoreSidecarParquet', () => {
    it('fetches the sidecar parquet and returns a Uint8Array', async () => {
      const bytes = new Uint8Array([5, 6, 7]);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes.buffer }));

      const result = await fetchDatastoreSidecarParquet('my-datastore');
      expect(result).toEqual(bytes);
    });

    it('calls the correct sidecar URL', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
      vi.stubGlobal('fetch', fetchMock);

      await fetchDatastoreSidecarParquet('my-datastore');
      expect(fetchMock).toHaveBeenCalledWith(buildDatastoreSidecarUrl('my-datastore'), { method: 'GET' });
    });
  });

  describe('getEsmDatastoreRecordCount', () => {
    it('returns the length of the fetched JSON array', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ a: 1 }, { b: 2 }, { c: 3 }] }));

      await expect(getEsmDatastoreRecordCount('my-datastore')).resolves.toBe(3);
    });

    it('throws on non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' }),
      );

      await expect(getEsmDatastoreRecordCount('my-datastore')).rejects.toThrow('HTTP error 500');
    });
  });

  describe('queryEsmDatastore', () => {
    it('returns the parsed JSON array', async () => {
      const data = [{ name: 'row1' }, { name: 'row2' }];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));

      const result = await queryEsmDatastore('my-datastore');
      expect(result).toEqual(data);
    });

    it('throws on non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));

      await expect(queryEsmDatastore('my-datastore')).rejects.toThrow('HTTP error 404');
    });
  });

  describe('getEsmDatastoreProject', () => {
    it('returns the project field from the response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ project: 'my-project' }) }));

      await expect(getEsmDatastoreProject('my-datastore')).resolves.toBe('my-project');
    });

    it('throws on non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' }));

      await expect(getEsmDatastoreProject('my-datastore')).rejects.toThrow('HTTP error 403');
    });
  });
});
