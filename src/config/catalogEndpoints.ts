const objectStoreBaseUrl =
  'https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog';

export const trackingServicesBaseUrl =
  process.env.NODE_ENV === 'production' ? 'https://reporting.access-nri-store.cloud.edu.au/' : 'http://127.0.0.1:8000/';

export const metacatUrl = `${objectStoreBaseUrl}/metacatalog.parquet`;

export const buildDatastoreObjectStoreUrl = (datastoreName: string) =>
  `${objectStoreBaseUrl}/source/${datastoreName}.parquet`;

export const buildDatastoreSidecarUrl = (datastoreName: string) =>
  buildDatastoreObjectStoreUrl(datastoreName).replace('.parquet', '_uniqs.parquet');

export const buildDatastoreContentUrl = (datastoreName: string) =>
  `${trackingServicesBaseUrl}intake/table/datastore-content/${datastoreName}`;

export const buildDatastoreProjectUrl = (datastoreName: string) =>
  `${trackingServicesBaseUrl}intake/table/datastore-project/${datastoreName}`;

export const buildEsmDatastoreTableUrl = (datastoreName: string, params: string) =>
  `${trackingServicesBaseUrl}intake/table/esm-datastore/${datastoreName}?${params}`;
