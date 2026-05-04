import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMetaCatFile } from '../catalogApi';
import { metacatUrl } from '../../config/catalogEndpoints';

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
});
