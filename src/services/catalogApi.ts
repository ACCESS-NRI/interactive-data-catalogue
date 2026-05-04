import type { DatastoreRow } from '../types/datastore';
import {
  buildDatastoreContentUrl,
  buildDatastoreProjectUrl,
  buildDatastoreSidecarUrl,
  buildDatastoreObjectStoreUrl,
  metacatUrl,
} from '../config/catalogEndpoints';

export async function fetchMetaCatFile(): Promise<Uint8Array> {
  return fetch(metacatUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch parquet file: ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => new Uint8Array(arrayBuffer));
}

export async function fetchParquetArrayBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Failed to fetch parquet file: ${response.status}`);
  }
  return response.arrayBuffer();
}

export async function fetchDatastoreParquet(datastoreName: string): Promise<Uint8Array> {
  const arrayBuffer = await fetchParquetArrayBuffer(buildDatastoreObjectStoreUrl(datastoreName));
  return new Uint8Array(arrayBuffer);
}

export async function fetchDatastoreSidecarParquet(datastoreName: string): Promise<Uint8Array> {
  const arrayBuffer = await fetchParquetArrayBuffer(buildDatastoreSidecarUrl(datastoreName));
  return new Uint8Array(arrayBuffer);
}

export async function getEsmDatastoreRecordCount(datastoreName: string): Promise<number> {
  const transformedData = await fetch(buildDatastoreContentUrl(datastoreName)).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  });

  return transformedData.length;
}

export async function queryEsmDatastore(datastoreName: string): Promise<DatastoreRow[]> {
  const transformedData = await fetch(buildDatastoreContentUrl(datastoreName)).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  });

  console.log('✅ ESM Datastore transformed data sample:', transformedData.slice(0, 2));
  console.log('📊 Total records:', transformedData.length);

  return transformedData;
}

export async function getEsmDatastoreProject(datastoreName: string): Promise<string | null> {
  return fetch(buildDatastoreProjectUrl(datastoreName))
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then((response) => response.project);
}
