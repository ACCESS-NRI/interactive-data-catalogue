import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as duckdb from '@duckdb/duckdb-wasm';
import type { CatalogRow } from '../types/catalog';
import type { DatastoreCache } from '../types/datastore';
import {
  fetchDatastoreParquet,
  fetchDatastoreSidecarParquet,
  fetchMetaCatFile,
  getEsmDatastoreProject,
  getEsmDatastoreRecordCount,
  queryEsmDatastore,
} from '../services/catalogApi';
import { initializeDuckDB } from '../services/duckdbClient';
import {
  getEsmDatastoreSize,
  getFilterOptions,
  loadEsmDatastore,
  queryMetaCatalogPq,
  setupColumns,
} from '../services/parquetTransforms';

export const useCatalogStore = defineStore('catalog', () => {
  // State
  const data = ref<CatalogRow[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const rawDataSample = ref<any[]>([]); // For debugging - store clean sample

  // Datastore cache state
  const datastoreCache = ref<Record<string, DatastoreCache>>({});

  // Getters
  const catalogCount = computed(() => data.value.length);
  const hasData = computed(() => data.value.length > 0);
  const isLoading = computed(() => loading.value);
  const hasError = computed(() => error.value !== null);

  // Actions
  /**
   * Public action to fetch and populate the metacatalog into the store.
   * This will reuse cached data when present and perform DuckDB queries
   * to normalize fields.
   */
  async function fetchCatalogData() {
    // If we already have data and no error, don't fetch again
    if (data.value.length > 0 && !error.value) {
      console.log('✅ Using cached metacatalog data');
      return;
    }

    loading.value = true;
    error.value = null;

    let db: duckdb.AsyncDuckDB | null = null;
    let conn: duckdb.AsyncDuckDBConnection | null = null;

    try {
      console.log('🚀 Fetching catalog data...');

      // Fetch parquet file and initialize DuckDB concurrently
      const [uint8Array, dbConnection] = await Promise.all([fetchMetaCatFile(), initializeDuckDB()]);

      console.log(`📦 Downloaded ${uint8Array.length} bytes`);
      db = dbConnection.db;
      conn = dbConnection.conn;

      // Query and transform data
      const result = await queryMetaCatalogPq(db, conn, uint8Array);
      data.value = result.data;
      rawDataSample.value = result.rawDataSample;
      console.log(`📚 Loaded ${data.value.length} catalog entries`);
    } catch (err) {
      console.error('❌ Error loading catalog data:', err);
      error.value = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      // Cleanup
      if (conn) await conn.close();
      if (db) await db.terminate();
      loading.value = false;
    }
  }

  /** Reset catalog-related state held by the store. */
  function clearData() {
    data.value = [];
    rawDataSample.value = [];
    error.value = null;
  }

  // Datastore management functions
  /**
   * Load or return cached ESM datastore metadata. This only fetches column names,
   * filter options, and row count - not the actual data rows. The DatastoreTable
   * component handles fetching actual data with server-side pagination via the
   * esm-datastore endpoint.
   *
   * @param datastoreName - logical name used to locate the parquet file
   */
  async function loadDatastore(datastoreName: string): Promise<DatastoreCache> {
    // Check if already cached and not loading
    const cached = datastoreCache.value[datastoreName];
    if (cached && cached.columns.length > 0 && !cached.loading) {
      console.log(`✅ Using cached metadata for ${datastoreName}`);
      return cached;
    }

    // If currently loading, wait for it to complete
    if (cached?.loading) {
      console.log(`⏳ Already loading ${datastoreName}, waiting...`);
      // Poll until loading is complete
      while (datastoreCache.value[datastoreName]?.loading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return datastoreCache.value[datastoreName] || createEmptyCache();
    }

    // Initialize cache entry
    datastoreCache.value[datastoreName] = {
      data: [],
      totalRecords: 0,
      columns: [],
      filterOptions: {},
      loading: true,
      error: null,
      project: null,
      lastFetched: new Date(),
    };

    let db: duckdb.AsyncDuckDB | null = null;
    let conn: duckdb.AsyncDuckDBConnection | null = null;

    try {
      console.log(`🚀 Loading datastore metadata: ${datastoreName}`);

      // Fetch sidecar file and initialize DuckDB concurrently
      const [sidecarUint8Array, dbConnection] = await Promise.all([
        fetchDatastoreSidecarParquet(datastoreName),
        initializeDuckDB(),
      ]);

      db = dbConnection.db;
      conn = dbConnection.conn;

      // Register the sidecar file with DuckDB
      const sidecarFileName = `${datastoreName}_uniqs.parquet`;
      console.log(`📦 Downloaded ${sidecarUint8Array.length} bytes for sidecar file`);

      await db.registerFileBuffer(sidecarFileName, sidecarUint8Array);

      // Query metadata: project, filter options, and row count
      // Note: We fetch a small sample just to get column names
      const [project, filterOptions, numRecords] = await Promise.all([
        getEsmDatastoreProject(datastoreName),
        getFilterOptions(conn, sidecarFileName),
        getEsmDatastoreSize(conn, sidecarFileName),
      ]);

      // Query metadata: project, filter options, and row count
      // Note: We fetch a small sample just to get column names
      const sampleData = await queryEsmDatastore(datastoreName); // Gets first 100 rows just for column names
      const columns = Object.keys(sampleData[0] || {});
      const displayColumns = setupColumns(columns);

      if (numRecords > 5000) {
        console.log('⚠️ Datastore exceeds 5,000 records - skipping data load for cache');
        // Update cache with metadata only (no data rows stored)
        datastoreCache.value[datastoreName] = {
          data: [], // Don't store data - fetched on demand
          totalRecords: numRecords,
          columns: displayColumns,
          filterOptions,
          loading: false,
          error: null,
          project,
          lastFetched: new Date(),
        };
      } else {
        console.log(`ℹ️ Datastore has ${numRecords} records - loading full data into cache`);
        // Small datastore - load all the data directly and bang it into the cache

        // Fetch both parquet files and initialize DuckDB concurrently
        const uint8Array = await fetchDatastoreParquet(datastoreName);
        console.log(`📦 Downloaded ${uint8Array.length} bytes for ${datastoreName}`);

        const fileName = `${datastoreName}.parquet`;
        await db.registerFileBuffer(fileName, uint8Array);
        // Query the ESM datastore data, project, and filter options concurrently
        const datastoreData = await loadEsmDatastore(conn, fileName);

        // Update cache with metadata only (no data rows stored)
        datastoreCache.value[datastoreName] = {
          data: datastoreData,
          totalRecords: numRecords,
          columns: displayColumns,
          filterOptions,
          loading: false,
          error: null,
          project,
          lastFetched: new Date(),
        };
      }

      console.log(
        `✅ Loaded metadata for ${datastoreName}: ${displayColumns.length} columns, ${numRecords} total records`,
      );
      return datastoreCache.value[datastoreName];
    } catch (err) {
      console.error('❌ Error loading datastore metadata:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load datastore';

      datastoreCache.value[datastoreName] = {
        data: [],
        totalRecords: 0,
        columns: [],
        filterOptions: {},
        loading: false,
        error: errorMessage,
        project: null,
        lastFetched: new Date(),
      };

      throw err;
    } finally {
      // Cleanup DuckDB resources
      if (conn) await conn.close();
      if (db) await db.terminate();
    }
  }

  function createEmptyCache(): DatastoreCache {
    return {
      data: [],
      totalRecords: 0,
      columns: [],
      filterOptions: {},
      loading: false,
      error: 'Datastore not found',
      project: null,
      lastFetched: new Date(),
    };
  }

  function getDatastoreFromCache(datastoreName: string): DatastoreCache | null {
    return datastoreCache.value[datastoreName] || null;
  }

  function isDatastoreLoading(datastoreName: string): boolean {
    return datastoreCache.value[datastoreName]?.loading || false;
  }

  function clearDatastoreCache(datastoreName?: string) {
    if (datastoreName) {
      delete datastoreCache.value[datastoreName];
      console.log(`🗑️ Cleared cache for datastore: ${datastoreName}`);
    } else {
      datastoreCache.value = {};
      console.log('🗑️ Cleared all datastore cache');
    }
  }

  return {
    // State
    data,
    loading,
    error,
    rawDataSample,
    datastoreCache,

    // Getters
    catalogCount,
    hasData,
    isLoading,
    hasError,

    // Actions
    fetchCatalogData,
    clearData,

    // Datastore management
    loadDatastore,
    getDatastoreFromCache,
    isDatastoreLoading,
    clearDatastoreCache,

    // Utility functions for other components
    fetchMetaCatFile,
    initializeDuckDB,
    queryEsmDatastore,
    getEsmDatastoreRecordCount,
    getFilterOptions,
    setupColumns,
    getEsmDatastoreSize,
  };
});
