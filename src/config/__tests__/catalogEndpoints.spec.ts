import { describe, expect, it, vi } from 'vitest';
import {
  buildDatastoreContentUrl,
  buildDatastoreObjectStoreUrl,
  buildDatastoreProjectUrl,
  buildDatastoreSidecarUrl,
  buildEsmDatastoreTableUrl,
  metacatUrl,
  trackingServicesBaseUrl,
} from '../catalogEndpoints';

describe('catalogEndpoints', () => {
  it('builds the metacatalog URL from the shared object-store base', () => {
    expect(metacatUrl).toContain('/access-nri-intake-catalog/metacatalog.parquet');
  });

  it('builds datastore object-store URLs', () => {
    expect(buildDatastoreObjectStoreUrl('woa23')).toBe(
      'https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog/source/woa23.parquet',
    );
  });

  it('builds sidecar URLs from datastore names', () => {
    expect(buildDatastoreSidecarUrl('woa23')).toBe(
      'https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog/source/woa23_uniqs.parquet',
    );
  });

  it.each([
    ['content', buildDatastoreContentUrl, 'intake/table/datastore-content/woa23'],
    ['project', buildDatastoreProjectUrl, 'intake/table/datastore-project/woa23'],
  ])('builds %s tracking-service URLs', (_label, builder, suffix) => {
    expect(builder('woa23')).toBe(`${trackingServicesBaseUrl}${suffix}`);
  });

  it('builds esm-datastore table URLs with encoded params appended', () => {
    expect(buildEsmDatastoreTableUrl('woa23', 'offset=0&limit=25')).toBe(
      `${trackingServicesBaseUrl}intake/table/esm-datastore/woa23?offset=0&limit=25`,
    );
  });

  it('trackingServicesBaseUrl uses the production URL when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();

    const { trackingServicesBaseUrl: prodUrl } = await import('../catalogEndpoints');
    expect(prodUrl).toBe('https://reporting-dev.access-nri-store.cloud.edu.au/');

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
