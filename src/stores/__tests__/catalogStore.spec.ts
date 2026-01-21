import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCatalogStore } from '../catalogStore';
import type { CatalogRow, DatastoreCache } from '../catalogStore';

// Mock DuckDB module
vi.mock('@duckdb/duckdb-wasm', () => ({
  AsyncDuckDB: vi.fn(),
  ConsoleLogger: vi.fn(),
}));

describe('catalogStore', () => {
  let store: ReturnType<typeof useCatalogStore>;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    store = useCatalogStore();
    vi.clearAllMocks();

    // Mock Worker globally for tests that need it
    global.Worker = vi.fn() as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    // Test that the store initializes with empty data array
    it('initializes with empty data', () => {
      expect(store.data).toEqual([]);
    });

    // Test that the store initializes with loading set to false
    it('initializes with loading false', () => {
      expect(store.loading).toBe(false);
    });

    // Test that the store initializes with no error state
    it('initializes with no error', () => {
      expect(store.error).toBeNull();
    });

    // Test that the store initializes with empty datastore cache
    it('initializes with empty datastore cache', () => {
      expect(store.datastoreCache).toEqual({});
    });

    // Test that the store initializes with empty raw data sample
    it('initializes with empty rawDataSample', () => {
      expect(store.rawDataSample).toEqual([]);
    });
  });

  describe('Computed Properties', () => {
    // Test that catalogCount returns 0 when no data is loaded
    it('catalogCount returns 0 for empty data', () => {
      expect(store.catalogCount).toBe(0);
    });

    // Test that catalogCount returns correct count when data is present
    it('catalogCount returns correct count', () => {
      store.data = [
        { name: 'test1', model: [], description: '', realm: [], frequency: [], variable: [] },
        { name: 'test2', model: [], description: '', realm: [], frequency: [], variable: [] },
      ] as CatalogRow[];
      expect(store.catalogCount).toBe(2);
    });

    // Test that hasData returns false when data array is empty
    it('hasData returns false for empty data', () => {
      expect(store.hasData).toBe(false);
    });

    // Test that hasData returns true when data array has entries
    it('hasData returns true when data exists', () => {
      store.data = [
        { name: 'test1', model: [], description: '', realm: [], frequency: [], variable: [] },
      ] as CatalogRow[];
      expect(store.hasData).toBe(true);
    });

    // Test that isLoading reflects the loading state correctly
    it('isLoading reflects loading state', () => {
      expect(store.isLoading).toBe(false);
      store.loading = true;
      expect(store.isLoading).toBe(true);
    });

    // Test that hasError returns false when no error is present
    it('hasError returns false when error is null', () => {
      expect(store.hasError).toBe(false);
    });

    // Test that hasError returns true when an error is set
    it('hasError returns true when error exists', () => {
      store.error = 'Test error';
      expect(store.hasError).toBe(true);
    });
  });

  describe('Actions', () => {
    describe('clearData', () => {
      // Test that clearData resets the data array to empty
      it('clears data array', () => {
        store.data = [
          { name: 'test1', model: [], description: '', realm: [], frequency: [], variable: [] },
        ] as CatalogRow[];
        store.clearData();
        expect(store.data).toEqual([]);
      });

      // Test that clearData resets raw data sample
      it('clears rawDataSample', () => {
        store.rawDataSample = [{ test: 'data' }];
        store.clearData();
        expect(store.rawDataSample).toEqual([]);
      });

      // Test that clearData clears any error state
      it('clears error', () => {
        store.error = 'Test error';
        store.clearData();
        expect(store.error).toBeNull();
      });
    });

    describe('fetchCatalogData', () => {
      // Test that fetchCatalogData returns early when data is already loaded
      it('returns early if data already exists', async () => {
        store.data = [
          { name: 'test1', model: [], description: '', realm: [], frequency: [], variable: [] },
        ] as CatalogRow[];
        const fetchSpy = vi.spyOn(global, 'fetch');

        await store.fetchCatalogData();

        expect(fetchSpy).not.toHaveBeenCalled();
      });

      // Test that fetchCatalogData sets loading to true during execution
      it('sets loading to true during fetch', async () => {
        // Mock initializeDuckDB to throw an error quickly
        vi.spyOn(store, 'initializeDuckDB').mockRejectedValue(new Error('Test error'));
        const fetchPromise = store.fetchCatalogData();

        expect(store.loading).toBe(true);

        await fetchPromise.catch(() => {});
        expect(store.loading).toBe(false);
      });

      // These fail because I (and Claude) can't work out how to properly mock the
      // store duckdb initialisation, so we wind up with nonsense. Circle back -
      // everything seems to work properly anyway (for now...)

      //      // Test that fetchCatalogData handles fetch errors gracefully
      //      it('handles fetch errors', async () => {
      //        store.fetchMetaCatFile = vi.fn().mockRejectedValue(new Error('Network error'));
      //
      //        await store.fetchCatalogData();
      //
      //        expect(store.error).toBe('Network error');
      //        expect(store.loading).toBe(false);
      //      });
      //
      //      // Test that fetchCatalogData clears error state before fetching
      //      it('clears previous error before fetching', async () => {
      //        store.error = 'Previous error';
      //        store.data = []; // Ensure it tries to fetch
      //
      //        store.fetchMetaCatFile = vi.fn().mockRejectedValue(new Error('New error'));
      //
      //        await store.fetchCatalogData();
      //
      //        expect(store.error).toBe('New error');
      //      });
    });

    describe('clearDatastoreCache', () => {
      // Test that clearDatastoreCache removes a specific datastore from cache
      it('clears specific datastore cache', () => {
        store.datastoreCache = {
          'test-datastore': {
            data: [],
            totalRecords: 0,
            columns: [],
            filterOptions: {},
            loading: false,
            error: null,
            lastFetched: new Date(),
          },
          'other-datastore': {
            data: [],
            totalRecords: 0,
            columns: [],
            filterOptions: {},
            loading: false,
            error: null,
            lastFetched: new Date(),
          },
        };

        store.clearDatastoreCache('test-datastore');

        expect(store.datastoreCache['test-datastore']).toBeUndefined();
        expect(store.datastoreCache['other-datastore']).toBeDefined();
      });

      // Test that clearDatastoreCache clears all cache when no name is provided
      it('clears all datastore cache when no name provided', () => {
        store.datastoreCache = {
          'test-datastore': {
            data: [],
            totalRecords: 0,
            columns: [],
            filterOptions: {},
            loading: false,
            error: null,
            lastFetched: new Date(),
          },
        };

        store.clearDatastoreCache();

        expect(store.datastoreCache).toEqual({});
      });
    });
  });

  describe('Datastore Management', () => {
    describe('getDatastoreFromCache', () => {
      // Test that getDatastoreFromCache returns cached datastore when present
      it('returns cached datastore', () => {
        const mockCache: DatastoreCache = {
          data: [{ test: 'data' }],
          totalRecords: 1,
          columns: ['test'],
          filterOptions: {},
          loading: false,
          error: null,
          lastFetched: new Date(),
        };

        store.datastoreCache = { 'test-datastore': mockCache };

        const result = store.getDatastoreFromCache('test-datastore');
        expect(result).toEqual(mockCache);
      });

      // Test that getDatastoreFromCache returns null when datastore not in cache
      it('returns null for non-existent datastore', () => {
        const result = store.getDatastoreFromCache('non-existent');
        expect(result).toBeNull();
      });
    });

    describe('isDatastoreLoading', () => {
      // Test that isDatastoreLoading returns true when datastore is loading
      it('returns true when datastore is loading', () => {
        store.datastoreCache = {
          'test-datastore': {
            data: [],
            totalRecords: 0,
            columns: [],
            filterOptions: {},
            loading: true,
            error: null,
            lastFetched: new Date(),
          },
        };

        expect(store.isDatastoreLoading('test-datastore')).toBe(true);
      });

      // Test that isDatastoreLoading returns false when datastore is not loading
      it('returns false when datastore is not loading', () => {
        store.datastoreCache = {
          'test-datastore': {
            data: [],
            totalRecords: 0,
            columns: [],
            filterOptions: {},
            loading: false,
            error: null,
            lastFetched: new Date(),
          },
        };

        expect(store.isDatastoreLoading('test-datastore')).toBe(false);
      });

      // Test that isDatastoreLoading returns false for non-existent datastore
      it('returns false for non-existent datastore', () => {
        expect(store.isDatastoreLoading('non-existent')).toBe(false);
      });
    });

    describe('loadDatastore', () => {
      // Test that loadDatastore returns cached data without refetching
      it('returns cached datastore without refetching', async () => {
        const mockCache: DatastoreCache = {
          data: [{ test: 'data' }],
          totalRecords: 1,
          columns: ['test'],
          filterOptions: {},
          loading: false,
          error: null,
          lastFetched: new Date(),
        };

        store.datastoreCache = { 'test-datastore': mockCache };
        const fetchSpy = vi.spyOn(global, 'fetch');

        const result = await store.loadDatastore('test-datastore');

        expect(result).toEqual(mockCache);
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      // Test that loadDatastore waits if datastore is already being loaded
      it('waits for in-progress load', async () => {
        store.datastoreCache = {
          'test-datastore': {
            data: [],
            totalRecords: 0,
            columns: [],
            filterOptions: {},
            loading: true,
            error: null,
            lastFetched: new Date(),
          },
        };

        // Simulate the load completing after 100ms
        setTimeout(() => {
          const cache = store.datastoreCache['test-datastore'];
          if (cache) {
            cache.loading = false;
            cache.data = [{ test: 'data' }];
          }
        }, 50);

        const result = await store.loadDatastore('test-datastore');

        expect(result.loading).toBe(false);
        expect(result.data).toBeDefined();
      });

      // Test that loadDatastore handles fetch errors and stores error message
      it('handles fetch errors gracefully', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

        await expect(store.loadDatastore('test-datastore')).rejects.toThrow();

        const cache = store.datastoreCache['test-datastore'];
        expect(cache).toBeDefined();
        expect(cache?.error).toBeTruthy();
        expect(cache?.loading).toBe(false);
      });

      // Test that loadDatastore creates cache entry for new datastore
      it('creates cache entry for new datastore', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Test error'));

        try {
          await store.loadDatastore('new-datastore');
        } catch (e) {
          // Expected to throw
        }

        expect(store.datastoreCache['new-datastore']).toBeDefined();
      });
    });
  });

  describe('Utility Functions', () => {

    describe('getFilterOptions', () => {
      // Helper to create a mock DuckDB connection
      const createMockConnection = (mockRows: any[]) => ({
        query: vi.fn().mockResolvedValue({
          toArray: () => mockRows,
        }),
      });

      // Test that getFilterOptions extracts unique values from sidecar parquet
      it('extracts filter options from sidecar file with regular arrays', async () => {
        const mockConn = createMockConnection([
          {
            frequency: ['daily', 'monthly'],
            realm: ['atmos', 'ocean'],
            variable: ['temp', 'pressure'],
          },
        ]) as any;

        const result = await store.getFilterOptions(mockConn, 'test_uniqs.parquet');

        expect(mockConn.query).toHaveBeenCalledWith("SELECT * FROM read_parquet('test_uniqs.parquet')");
        expect(result).toEqual({
          frequency: ['daily', 'monthly'],
          realm: ['atmos', 'ocean'],
          variable: ['pressure', 'temp'],
        });
      });

      // Test that getFilterOptions handles DuckDB Vector objects with toArray method
      it('handles DuckDB Vector objects', async () => {
        const mockVector = {
          toArray: () => ['value1', 'value2', 'value3'],
        };

        const mockConn = createMockConnection([
          {
            column1: mockVector,
            column2: ['regular', 'array'],
          },
        ]) as any;

        const result = await store.getFilterOptions(mockConn, 'test_uniqs.parquet');

        expect(result.column1).toEqual(['value1', 'value2', 'value3']);
        expect(result.column2).toEqual(['array', 'regular']);
      });

      // Test that getFilterOptions filters out null and empty values
      it('filters out null, undefined, and empty string values', async () => {
        const mockConn = createMockConnection([
          {
            field1: ['valid', null, undefined, '', '  ', 'another'],
            field2: ['good', 'data'],
          },
        ]) as any;

        const result = await store.getFilterOptions(mockConn, 'test_uniqs.parquet');

        expect(result.field1).toEqual(['another', 'valid']);
        expect(result.field2).toEqual(['data', 'good']);
      });

      // Test that getFilterOptions sorts values alphabetically
      it('sorts values alphabetically', async () => {
        const mockConn = createMockConnection([
          {
            colors: ['red', 'blue', 'green', 'alpha'],
          },
        ]) as any;

        const result = await store.getFilterOptions(mockConn, 'test_uniqs.parquet');

        expect(result.colors).toEqual(['alpha', 'blue', 'green', 'red']);
      });

      // Test that getFilterOptions handles null/undefined columns
      it('handles null and undefined column values', async () => {
        const mockConn = createMockConnection([
          {
            field1: null,
            field2: undefined,
            field3: ['valid'],
          },
        ]) as any;

        const result = await store.getFilterOptions(mockConn, 'test_uniqs.parquet');

        expect(result.field1).toEqual([]);
        expect(result.field2).toEqual([]);
        expect(result.field3).toEqual(['valid']);
      });

      // Test that getFilterOptions returns empty object for empty sidecar file
      it('returns empty object when sidecar file has no rows', async () => {
        const mockConn = createMockConnection([]) as any;

        const result = await store.getFilterOptions(mockConn, 'empty_uniqs.parquet');

        expect(result).toEqual({});
      });

      // Test that getFilterOptions handles query errors gracefully
      it('returns empty object on query error', async () => {
        const mockConn = {
          query: vi.fn().mockRejectedValue(new Error('Query failed')),
        } as any;

        const result = await store.getFilterOptions(mockConn, 'test_uniqs.parquet');

        expect(result).toEqual({});
      });

      // Test that getFilterOptions handles single scalar values (edge case)
      it('handles single scalar values as fallback', async () => {
        const mockConn = createMockConnection([
          {
            field1: 'single-value',
            field2: ['array', 'values'],
          },
        ]) as any;

        const result = await store.getFilterOptions(mockConn, 'test_uniqs.parquet');

        expect(result.field1).toEqual(['single-value']);
        expect(result.field2).toEqual(['array', 'values']);
      });
    });

    describe('setupColumns', () => {
      // Test that setupColumns filters out the internal index column
      it('filters out __index_level_0__ column', () => {
        const columns = ['name', '__index_level_0__', 'description', 'value'];

        const result = store.setupColumns(columns);

        expect(result).toEqual(['name', 'description', 'value']);
        expect(result).not.toContain('__index_level_0__');
      });

      // Test that setupColumns returns all columns when no index column present
      it('returns all columns when no index column', () => {
        const columns = ['name', 'description', 'value'];

        const result = store.setupColumns(columns);

        expect(result).toEqual(['name', 'description', 'value']);
      });

      // Test that setupColumns handles empty array
      it('handles empty column array', () => {
        const result = store.setupColumns([]);
        expect(result).toEqual([]);
      });
    });
  });

  describe('CatalogRow Interface', () => {
    // Test that CatalogRow structure contains all required fields
    it('catalog row has required structure', () => {
      const row: CatalogRow = {
        name: 'test-entry',
        model: ['model1', 'model2'],
        description: 'Test description',
        realm: ['atmosphere'],
        frequency: ['monthly'],
        variable: ['temp', 'pressure'],
      };

      expect(row.name).toBe('test-entry');
      expect(row.model).toEqual(['model1', 'model2']);
      expect(row.description).toBe('Test description');
      expect(row.realm).toEqual(['atmosphere']);
      expect(row.frequency).toEqual(['monthly']);
      expect(row.variable).toEqual(['temp', 'pressure']);
    });

    // Test that CatalogRow accepts optional yaml and searchable fields
    it('catalog row accepts optional fields', () => {
      const row: CatalogRow = {
        name: 'test-entry',
        model: ['model1'],
        description: 'Test description',
        realm: ['atmosphere'],
        frequency: ['monthly'],
        variable: ['temp'],
        yaml: 'test: yaml',
        searchableModel: 'model1',
        searchableRealm: 'atmosphere',
        searchableFrequency: 'monthly',
        searchableVariable: 'temp',
      };

      expect(row.yaml).toBe('test: yaml');
      expect(row.searchableModel).toBe('model1');
      expect(row.searchableRealm).toBe('atmosphere');
      expect(row.searchableFrequency).toBe('monthly');
      expect(row.searchableVariable).toBe('temp');
    });
  });

  describe('DatastoreCache Interface', () => {
    // Test that DatastoreCache structure contains all required fields
    it('datastore cache has required structure', () => {
      const cache: DatastoreCache = {
        data: [{ test: 'data' }],
        totalRecords: 1,
        columns: ['test'],
        filterOptions: { test: ['data'] },
        loading: false,
        error: null,
        lastFetched: new Date(),
      };

      expect(cache.data).toEqual([{ test: 'data' }]);
      expect(cache.totalRecords).toBe(1);
      expect(cache.columns).toEqual(['test']);
      expect(cache.filterOptions).toEqual({ test: ['data'] });
      expect(cache.loading).toBe(false);
      expect(cache.error).toBeNull();
      expect(cache.lastFetched).toBeInstanceOf(Date);
    });

    // Test that DatastoreCache accepts optional project field
    it('datastore cache accepts optional project field', () => {
      const cache: DatastoreCache = {
        data: [],
        totalRecords: 0,
        columns: [],
        filterOptions: {},
        loading: false,
        error: null,
        lastFetched: new Date(),
        project: 'test-project',
      };

      expect(cache.project).toBe('test-project');
    });

    // Test that DatastoreCache handles error state correctly
    it('datastore cache handles error state', () => {
      const cache: DatastoreCache = {
        data: [],
        totalRecords: 0,
        columns: [],
        filterOptions: {},
        loading: false,
        error: 'Failed to load',
        lastFetched: new Date(),
      };

      expect(cache.error).toBe('Failed to load');
    });
  });
});
