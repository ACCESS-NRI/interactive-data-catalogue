import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

type OptionalProject = string | null;
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
  project?: OptionalProject;
}

interface DatastoreRow {
  [key: string]: string | string[] | null;
}

type FilterOptions = Record<string, string[]>;

export const trackingServicesBaseUrl =
  process.env.NODE_ENV === 'production'
    ? 'https://reporting-dev.access-nri-store.cloud.edu.au/'
    : 'http://127.0.0.1:8000/';
const METACAT_URL =
  'https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog/metacatalog.parquet';

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

    // Read the parquet as raw rows and normalize in JavaScript
    const queryResult = await conn.query("SELECT * FROM read_parquet('metacatalog.parquet')");

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
   * Get just the record count for an ESM datastore without loading the full data
   *
   * @param datastoreName - The name of the datastore
   * @returns Promise<number> - The total number of records
   */
  async function getEsmDatastoreRecordCount(datastoreName: string): Promise<number> {
    const endpoint = `${trackingServicesBaseUrl}intake/table/datastore-content/${datastoreName}`;

    const transformedData = await fetch(endpoint).then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      return response.json();
    });

    return transformedData.length;
  }

  /**
   * Read an esm datastore from the `datastore-content` endpoint, and get a JS
   * array containing the data
   *
   * @param datastoreName - The name of the datastore, passed to the tracking
   * services server as part of the url, eg. `.../intake/table/datastore-content/WOA23`
   */
  async function queryEsmDatastore(datastoreName: string): Promise<DatastoreRow[]> {
    const endpoint = `${trackingServicesBaseUrl}intake/table/datastore-content/${datastoreName}`;

    const transformedData = await fetch(endpoint).then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      return response.json();
    });

    console.log('✅ ESM Datastore transformed data sample:', transformedData.slice(0, 2));
    console.log('📊 Total records:', transformedData.length);

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
  async function loadEsmDatastore(conn: duckdb.AsyncDuckDBConnection, fileName: string): Promise<any[]> {
    // NOTE: the parquet file buffer must be registered by the caller.
    // First, inspect the schema to understand the columns
    const schemaResult = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${fileName}') LIMIT 1`);

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

    // Transform the data using the same normalization used by
    // `queryMetaCatalogPq`: always produce an array of strings for
    // each column (empty array for null/undefined).
    const transformedData = rawData.map((row: any) => {
      const processGenericField = (value: any): string[] => {
        if (value === null || value === undefined) return [];

        // DuckDB Vector-like objects (expose toArray)
        if (value && typeof value.toArray === 'function') {
          return value
            .toArray()
            .filter((v: any) => v !== null && v !== undefined)
            .map(String);
        }

        // Regular arrays
        if (Array.isArray(value)) {
          return value.filter((v) => v !== null && v !== undefined).map(String);
        }

        // Strings may be JSON arrays or scalars
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
          } catch {
            return [value];
          }
        }

        // Fallback: stringify single value
        return [String(value)];
      };

      const transformedRow: any = {};
      columns.forEach((column) => {
        const arr = processGenericField(row[column]);
        transformedRow[column] = arr.length === 0 ? null : arr.length === 1 ? arr[0] : arr;
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
  async function getEsmDatastoreProject(datastoreName: string): Promise<OptionalProject> {
    const endpoint = `${trackingServicesBaseUrl}intake/table/datastore-project/${datastoreName}`;
    return fetch(endpoint)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then((response) => response.project);
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

  /**
   * The sidecar file metadata contains the total number of rows in the datastore.
   * This function just grabs that
   *
   * @param conn - Active DuckDB connection
   * @param sidecarFname - Name of the registered sidecar parquet file
   * @returns Record mapping column names to their unique sorted values
   */
  async function getEsmDatastoreSize(conn: duckdb.AsyncDuckDBConnection, sidecarFname: string): Promise<number> {
    try {
      // Query the sidecar file - it has one row with arrays of unique values
      const queryResult = await conn.query(` SELECT key, value FROM parquet_kv_metadata('${sidecarFname}') `);

      const decoder = new TextDecoder('utf-8');

      const metadata: Record<string, string> = Object.fromEntries(
        queryResult.toArray().map((r) => [
          decoder.decode(r.key), // Uint8Array -> string
          decoder.decode(r.value),
        ]),
      );

      if (metadata.num_records) {
        return parseInt(metadata.num_records, 10);
      } else {
        throw new Error('num_records not found in parquet metadata');
      }
    } catch (err) {
      console.error('Could not load esm-datastore size: setting over threshold to enable SSR', err);
      // Return empty filter options on error
      return 1000000;
    }
  }

  /** Reset catalog-related state held by the store. */
  function clearData() {
    data.value = [];
    rawDataSample.value = [];
    error.value = null;
  }

  /**
   * Query a sidecar parquet file containing unique values per column.
   * The sidecar file has one row where each column is a list of unique values.
   *
   * @param conn - Active DuckDB connection
   * @param sidecarFname - Name of the registered sidecar parquet file
   * @returns Record mapping column names to their unique sorted values
   */
  async function getFilterOptions(conn: duckdb.AsyncDuckDBConnection, sidecarFname: string): Promise<FilterOptions> {
    try {
      // Query the sidecar file - it has one row with arrays of unique values
      const queryResult = await conn.query(` SELECT * FROM read_parquet('${sidecarFname}') `);
      const rows = queryResult.toArray();

      if (rows.length !== 1) {
        console.error('⚠️ Sidecar file does not contain exactly one row');
        return {};
      }

      const row = rows[0];
      const filterOptions: FilterOptions = {};
      // Process each column in the sidecar row
      for (const [column, value] of Object.entries(row)) {
        // Ignore columns users probably won't want to see.
        if (column === 'path' || column === 'filename') {
          continue;
        }
        // graciously handle (ignore) errors...
        if (value === null || value === undefined) {
          filterOptions[column] = [];
          continue;
        }

        // Only handle DuckDB Vector objects - this is what we expect to get
        if (value && typeof (value as any).toArray === 'function') {
          const arr = (value as any)
            .toArray()
            .filter((v: any) => v !== null && v !== undefined && String(v).trim())
            .map(String);
          filterOptions[column] = arr.sort();
        }
      }

      console.log('✅ Loaded filter options from sidecar file:', Object.keys(filterOptions).length, 'columns');
      return filterOptions;
    } catch (err) {
      console.error('❌ Error loading filter options from sidecar:', err);
      // Return empty filter options on error
      return {};
    }
  }

  function setupColumns(dataColumns: string[]): string[] {
    // Filter out the index column from display but keep it for data-key
    return dataColumns.filter((col) => col !== '__index_level_0__');
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

      // Construct URL for the sidecar file containing unique values
      const datastoreUrl = `https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog/source/${datastoreName}.parquet`;
      const sidecarUrl = datastoreUrl.replace('.parquet', '_uniqs.parquet');

      // Fetch sidecar file and initialize DuckDB concurrently
      const [sidecarArrayBuffer, dbConnection] = await Promise.all([
        fetch(sidecarUrl, { method: 'GET' }).then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch sidecar parquet file: ${response.status}`);
          }
          return response.arrayBuffer();
        }),
        initializeDuckDB(),
      ]);

      db = dbConnection.db;
      conn = dbConnection.conn;

      // Register the sidecar file with DuckDB
      const sidecarUint8Array = new Uint8Array(sidecarArrayBuffer);
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

      if (numRecords > 10_000) {
        console.log("⚠️ Datastore exceeds 10,000 records - skipping data load for cache");
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
        const response  = await fetch(datastoreUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch datastore parquet file: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        const uint8Array = new Uint8Array(arrayBuffer);
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
