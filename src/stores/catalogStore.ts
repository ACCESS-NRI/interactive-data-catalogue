import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import type { get } from 'http';

/**
 * A single normalized catalog row returned by querying the metacatalog
 * parquet file. All list-like fields are represented as arrays of strings
 * for consistent consumption by the UI.
 */
export interface CatalogRow {
  /** Display name or unique identifier for the catalog entry. */
  name: string;
  /** One or more model identifiers associated with this entry. */
  model: string[];
  /** Human-readable description of the entry. */
  description: string;
  /** One or more realms where this entry is applicable. */
  realm: string[];
  /** One or more frequency tags associated with the entry. */
  frequency: string[];
  /** One or more variable names referenced by this entry. */
  variable: string[];
  /** Optional YAML configuration payload attached to the entry (if any). */
  yaml?: string;
  /**
   * Precomputed searchable strings created from list fields. These make
   * client-side global search faster and simpler.
   */
  searchableModel?: string;
  searchableRealm?: string;
  searchableFrequency?: string;
  searchableVariable?: string;
}

/**
 * Cached representation of an ESM datastore loaded from a parquet file.
 * The store keeps one cache entry per datastore name so components can
 * reuse previously-loaded data without re-downloading or re-parsing.
 */
export interface DatastoreCache {
  /** Raw transformed rows for use in tables and filters. */
  data: any[];
  /** Number of records in `data`. */
  totalRecords: number;
  /** Column names available for display in tables. */
  columns: string[];
  /** Precomputed filter options for each column (unique sorted values). */
  filterOptions: Record<string, string[]>;
  /** Whether this cache entry is currently loading. */
  loading: boolean;
  /** Any error message encountered while loading this datastore. */
  error: string | null;
  /** Timestamp when the datastore was last fetched. */
  lastFetched: Date;
  project?: string | null;
}

/**
 * URL to the metacatalog parquet file. Uses a CORS proxy in production
 * and a local API path in development.
 */
const METACAT_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://corsproxy.io/?https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog/metacatalog.parquet'
    : '/api/parquet/metacatalog.parquet';

/** DuckDB WASM bundles used by the client; selectBundle picks the best one. */
const DUCKDB_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
};


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

  /**
   * Download the parquet file from the configured endpoint and return it as a
   * Uint8Array.
   *
   * @throws {Error} when the HTTP request fails or returns a non-OK status.
   */
  async function fetchMetaCatFile(): Promise<Uint8Array> {
    return fetch(METACAT_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch parquet file: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => new Uint8Array(arrayBuffer));
  }

  /**
   * Initialize a DuckDB Async instance using the configured bundles and
   * a dedicated web worker. Returns `{ db, conn }` where `conn` is a
   * connected AsyncDuckDBConnection.
   */
  async function initializeDuckDB() {
    const bundle = DUCKDB_BUNDLES.mvp;
    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);

    await db.instantiate(bundle.mainModule);
    const conn = await db.connect();

    return { db, conn };
  }

  /**
   * Register the provided parquet bytes under a fixed filename and run
   * the normalization query. Returns an array of `CatalogRow` items.
   *
   * @param db - DuckDB Async instance
   * @param conn - Active connection associated with `db`
   * @param uint8Array - Contents of the parquet file
   */
  async function queryMetaCatalogPq(
    db: duckdb.AsyncDuckDB,
    conn: duckdb.AsyncDuckDBConnection,
    uint8Array: Uint8Array,
  ): Promise<CatalogRow[]> {
    // Register the parquet file
    await db.registerFileBuffer('metacatalog.parquet', uint8Array);

    // Query with explicit array handling
    const queryResult = await conn.query("select * from read_parquet('metacatalog.parquet')");

    // Get raw data for inspection
    const rawData = queryResult.toArray();

    // Convert proxies to plain objects for better debugging
    const cleanRawSample = rawData.slice(0, 3).map((row: any) => {
      const cleanRow: any = {};
      for (const key in row) {
        const value = row[key];
        cleanRow[key] = {
          value: value,
          type: typeof value,
          isArray: Array.isArray(value),
          constructor: value?.constructor?.name,
          // If it's a Vector or similar, try to convert to array
          asArray: value?.toArray ? value.toArray() : value,
        };
      }
      return cleanRow;
    });

    // Store clean sample for debugging
    rawDataSample.value = cleanRawSample;
    console.log('🔍 Clean raw data sample (check store.rawDataSample):', cleanRawSample);

    // Transform to our interface with proper array handling
    const transformedData = rawData.map((row: any) => {
      const processListField = (value: any): string[] => {
        if (value === null || value === undefined) return [];

        // Handle DuckDB Vector objects
        if (value && typeof value.toArray === 'function') {
          return value
            .toArray()
            .filter((v: any) => v !== null && v !== undefined)
            .map(String);
        }

        if (Array.isArray(value)) return value.filter((v) => v !== null && v !== undefined).map(String);

        if (typeof value === 'string') {
          // Handle potential JSON strings or comma-separated values
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
          } catch {
            // If not JSON, treat as single value
            return [value];
          }
        }
        return [String(value)];
      };

      return {
        name: row.name || '',
        model: processListField(row.model),
        description: row.description || '',
        realm: processListField(row.realm),
        frequency: processListField(row.frequency),
        variable: processListField(row.variable),
        yaml: row.yaml || '', // Add YAML field
        // Add searchable versions for better search
        searchableModel: processListField(row.model).join(', '),
        searchableRealm: processListField(row.realm).join(', '),
        searchableFrequency: processListField(row.frequency).join(', '),
        searchableVariable: processListField(row.variable).join(', '),
      };
    });

    console.log('✅ Transformed data sample:', transformedData.slice(0, 2));
    return transformedData;
  }

  /**
   * Read a generic ESM datastore parquet and normalize each column to
   * either a scalar or an array of strings. This function dynamically
   * inspects the parquet schema and builds a query that coercively
   * converts columns into VARCHAR[] when possible.
   *
   * @param db - DuckDB Async instance
   * @param conn - Active connection associated with `db`
   * @param uint8Array - Bytes of the datastore parquet
   * @param datastoreName - Logical name used to register the buffer
   */
  async function queryEsmDatastore(
    conn: duckdb.AsyncDuckDBConnection,
    fileName: string,
  ): Promise<any[]> {
    // NOTE: the parquet file buffer must be registered by the caller.
    // First, inspect the schema to understand the columns
    const schemaResult = await conn.query(
      `DESCRIBE SELECT * FROM read_parquet('${fileName}') LIMIT 1`
    );

    const schemaData = schemaResult.toArray();
    console.log('📊 ESM Datastore schema:', schemaData);
    // Get all column names from the schema
    const columns = schemaData
      .map((row: any) => row.column_name)
      .filter((col: string) => col !== 'filename' && col !== 'path');
    console.log('📋 Available columns:', columns);

    // Read the parquet as raw rows and normalize in JavaScript
    const queryResult = await conn.query(`SELECT * FROM read_parquet('${fileName}')`);
    const rawData = queryResult.toArray();

    // Transform the data with generic array handling
    const transformedData = rawData.map((row: any) => {
      const processField = (value: any): any => {
        if (value === null || value === undefined) return null;

        // Handle DuckDB Vector objects for arrays
        if (value && typeof value.toArray === 'function') {
          const arrayValue = value.toArray().filter((v: any) => v !== null && v !== undefined);
          return arrayValue.length > 1 ? arrayValue.map(String) : arrayValue[0] ? String(arrayValue[0]) : null;
        }

        // Handle regular arrays
        if (Array.isArray(value)) {
          const filteredArray = value.filter((v) => v !== null && v !== undefined);
          return filteredArray.length > 1
            ? filteredArray.map(String)
            : filteredArray[0]
              ? String(filteredArray[0])
              : null;
        }

        // Handle string values
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              return parsed.length > 1 ? parsed.map(String) : parsed[0] ? String(parsed[0]) : null;
            }
            return String(parsed);
          } catch {
            return String(value);
          }
        }

        return value;
      };

      const transformedRow: any = {};
      columns.forEach((column) => {
        transformedRow[column] = processField(row[column]);
      });

      return transformedRow;
    });

    console.log('✅ ESM Datastore transformed data sample:', transformedData.slice(0, 2));
    console.log('📊 Total records:', transformedData.length);

    return transformedData;
  }

  /**
   * Read a generic ESM datastore parquet file and get the project from the first
   * row's path column.
   *    
   * @param db - DuckDB Async instance
   * @param conn - Active connection associated with `db`
   * @param uint8Array - Bytes of the datastore parquet
   * @param datastoreName - Logical name used to register the buffer
   */
  async function getEsmDatastoreProject(
    conn: duckdb.AsyncDuckDBConnection,
    fileName: string,
  ): Promise<string | null> {
    // NOTE: the parquet file buffer must be registered by the caller.
    // Query for a single row and return the first matched project (or null)
    return conn
      .query(`SELECT path FROM read_parquet('${fileName}') LIMIT 1`)
      .then((table) => table.toArray())
      .then((rows: any[]) => {
        const row = rows[0];
        if (!row) return null;
        const pathValue = row['path'];
        if (!pathValue) return null;
        const match = String(pathValue).match(/\/g\/data\/([^\/]+)\//);
        return match?.[1] ?? null;
      });
  }

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
      data.value = await queryMetaCatalogPq(db, conn, uint8Array);
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

  // Helper functions for datastore management
  /**
   * Build a map of column -> unique sorted option values for use in
   * MultiSelect filters. Values are stringified and empty values are
   * ignored.
   *
   * @param data - array of rows (objects) to scan for unique values
   */
  function generateFilterOptions(data: any[]): Record<string, string[]> {
    const options: Record<string, Set<string>> = {};

    data.forEach((row) => {
      for (const [column, value] of Object.entries(row)) {
        if (!options[column]) {
          options[column] = new Set();
        }

        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item != null && String(item).trim()) {
              options[column]?.add(String(item));
            }
          });
        } else if (value != null && String(value).trim()) {
          options[column]?.add(String(value));
        }
      }
    });

    // Convert Sets to sorted arrays
    const result: Record<string, string[]> = {};
    for (const [column, optionSet] of Object.entries(options)) {
      result[column] = Array.from(optionSet).sort();
    }

    return result;
  }

  function setupColumns(dataColumns: string[]): string[] {
    // Filter out the index column from display but keep it for data-key
    return dataColumns.filter((col) => col !== '__index_level_0__');
  }

  // Datastore management functions
  /**
   * Load or return a cached ESM datastore. If the datastore is not cached
   * the function will fetch the parquet file, parse it via DuckDB and
   * populate the cache entry for later reuse.
   *
   * @param datastoreName - logical name used to locate the parquet file
   */
  async function loadDatastore(datastoreName: string): Promise<DatastoreCache> {
    // Check if already cached and not loading
    const cached = datastoreCache.value[datastoreName];
    if (cached && cached.data.length > 0 && !cached.loading) {
      console.log(`✅ Using cached data for ${datastoreName}`);
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
      console.log(`🚀 Loading datastore: ${datastoreName}`);

      // Construct the parquet file URL for this specific datastore
      const datastoreUrl =
        process.env.NODE_ENV === 'production'
          ? `https://corsproxy.io/?https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog/source/${datastoreName}.parquet`
          : `/api/parquet/source/${datastoreName}.parquet`;

      // Fetch parquet file and initialize DuckDB concurrently
      const [response, dbConnection] = await Promise.all([fetch(datastoreUrl), initializeDuckDB()]);

      if (!response.ok) {
        throw new Error(`Failed to fetch datastore parquet file: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log(`📦 Downloaded ${uint8Array.length} bytes for ${datastoreName}`);

      db = dbConnection.db;
      conn = dbConnection.conn;

      // Register the parquet bytes once (transfers the ArrayBuffer to the worker).
      const fileName = `${datastoreName}.parquet`;
      await db.registerFileBuffer(fileName, uint8Array);

      // Query the ESM datastore data and project concurrently (functions
      // now accept `conn` + `fileName` and must NOT re-register the bytes).
      const [datastoreData, project] = await Promise.all([
        queryEsmDatastore(conn, fileName),
        getEsmDatastoreProject(conn, fileName),
      ]);
      const columns = Object.keys(datastoreData[0] || {});
      const displayColumns = setupColumns(columns);
      const filterOptions = generateFilterOptions(datastoreData);

      // Also extract project from the datastore (first row path)

      // Update cache with loaded data
      datastoreCache.value[datastoreName] = {
        data: datastoreData,
        totalRecords: datastoreData.length,
        columns: displayColumns,
        filterOptions,
        loading: false,
        error: null,
        project,
        lastFetched: new Date(),
      };

      console.log(`✅ Loaded ${datastoreData.length} records for ${datastoreName}`);
      return datastoreCache.value[datastoreName];
    } catch (err) {
      console.error('❌ Error loading datastore:', err);
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
    generateFilterOptions,
    setupColumns,
  };
});
