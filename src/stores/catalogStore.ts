import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as duckdb from '@duckdb/duckdb-wasm'
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

export interface CatalogRow {
  name: string
  model: string[]
  description: string
  realm: string[]
  frequency: string[]
  variable: string[]
  yaml?: string  // Optional YAML configuration
  // Searchable fields for better search experience
  searchableModel?: string
  searchableRealm?: string
  searchableFrequency?: string
  searchableVariable?: string
}

export interface DatastoreCache {
  data: any[]
  totalRecords: number
  columns: string[]
  filterOptions: Record<string, string[]>
  loading: boolean
  error: string | null
  lastFetched: Date
}

const PARQUET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://corsproxy.io/?https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog/metacatalog.parquet'
  : '/api/parquet/metacatalog.parquet'

// DuckDB bundle configuration
const DUCKDB_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
}

export const useCatalogStore = defineStore('catalog', () => {
  // State
  const data = ref<CatalogRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const rawDataSample = ref<any[]>([]) // For debugging - store clean sample
  
  // Datastore cache state
  const datastoreCache = ref<Record<string, DatastoreCache>>({})
  
  // Getters
  const catalogCount = computed(() => data.value.length)
  const hasData = computed(() => data.value.length > 0)
  const isLoading = computed(() => loading.value)
  const hasError = computed(() => error.value !== null)
  
  // Helper functions
  async function fetchParquetFile(): Promise<Uint8Array> {
    const response = await fetch(PARQUET_URL)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch parquet file: ${response.status}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  }

  async function initializeDuckDB() {
    const bundle = await duckdb.selectBundle(DUCKDB_BUNDLES)
    const worker = new Worker(bundle.mainWorker!)
    const logger = new duckdb.ConsoleLogger()
    const db = new duckdb.AsyncDuckDB(logger, worker)
    
    await db.instantiate(bundle.mainModule)
    const conn = await db.connect()
    
    return { db, conn }
  }

  async function queryMetaCatalogPq(db: duckdb.AsyncDuckDB, conn: duckdb.AsyncDuckDBConnection, uint8Array: Uint8Array): Promise<CatalogRow[]> {
    // Register the parquet file
    await db.registerFileBuffer('metacatalog.parquet', uint8Array)
    
    // Query with explicit array handling
    const queryResult = await conn.query(`
      SELECT 
        name,
        CASE 
          WHEN typeof(model) LIKE '%[]%' THEN model::VARCHAR[]
          WHEN model IS NOT NULL THEN [model::VARCHAR]
          ELSE []::VARCHAR[]
        END as model,
        description,
        CASE 
          WHEN typeof(realm) LIKE '%[]%' THEN realm::VARCHAR[]
          WHEN realm IS NOT NULL THEN [realm::VARCHAR]
          ELSE []::VARCHAR[]
        END as realm,
        CASE 
          WHEN typeof(frequency) LIKE '%[]%' THEN frequency::VARCHAR[]
          WHEN frequency IS NOT NULL THEN [frequency::VARCHAR]
          ELSE []::VARCHAR[]
        END as frequency,
        CASE 
          WHEN typeof(variable) LIKE '%[]%' THEN variable::VARCHAR[]
          WHEN variable IS NOT NULL THEN [variable::VARCHAR]
          ELSE []::VARCHAR[]
        END as variable,
        yaml
      FROM read_parquet('metacatalog.parquet')
    `)
    
    // Get raw data for inspection
    const rawData = queryResult.toArray()
    
    // Convert proxies to plain objects for better debugging
    const cleanRawSample = rawData.slice(0, 3).map((row: any) => {
      const cleanRow: any = {}
      for (const key in row) {
        const value = row[key]
        cleanRow[key] = {
          value: value,
          type: typeof value,
          isArray: Array.isArray(value),
          constructor: value?.constructor?.name,
          // If it's a Vector or similar, try to convert to array
          asArray: value?.toArray ? value.toArray() : value
        }
      }
      return cleanRow
    })
    
    // Store clean sample for debugging
    rawDataSample.value = cleanRawSample
    console.log('🔍 Clean raw data sample (check store.rawDataSample):', cleanRawSample)
    
    // Transform to our interface with proper array handling
    const transformedData = rawData.map((row: any) => {
      const processListField = (value: any): string[] => {
        if (value === null || value === undefined) return []
        
        // Handle DuckDB Vector objects
        if (value && typeof value.toArray === 'function') {
          return value.toArray().filter((v: any) => v !== null && v !== undefined).map(String)
        }
        
        if (Array.isArray(value)) return value.filter(v => v !== null && v !== undefined).map(String)
        
        if (typeof value === 'string') {
          // Handle potential JSON strings or comma-separated values
          try {
            const parsed = JSON.parse(value)
            return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)]
          } catch {
            // If not JSON, treat as single value
            return [value]
          }
        }
        return [String(value)]
      }

      return {
        name: row.name || '',
        model: processListField(row.model),
        description: row.description || '',
        realm: processListField(row.realm),
        frequency: processListField(row.frequency),
        variable: processListField(row.variable),
        yaml: row.yaml || '',  // Add YAML field
        // Add searchable versions for better search
        searchableModel: processListField(row.model).join(', '),
        searchableRealm: processListField(row.realm).join(', '),
        searchableFrequency: processListField(row.frequency).join(', '),
        searchableVariable: processListField(row.variable).join(', ')
      }
    })

    console.log('✅ Transformed data sample:', transformedData.slice(0, 2))
    return transformedData
  }

  async function queryEsmDatastore(db: duckdb.AsyncDuckDB, conn: duckdb.AsyncDuckDBConnection, uint8Array: Uint8Array, datastoreName: string): Promise<any[]> {
    // Register the parquet file with a dynamic name
    const fileName = `${datastoreName}.parquet`
    await db.registerFileBuffer(fileName, uint8Array)
    
    // First, inspect the schema to understand the columns
    const schemaResult = await conn.query(`
      DESCRIBE SELECT * FROM read_parquet('${fileName}') LIMIT 1
    `)
    
    const schemaData = schemaResult.toArray()
    console.log('📊 ESM Datastore schema:', schemaData)
    
    // Get all column names from the schema
    const columns = schemaData.map((row: any) => row.column_name)
    console.log('📋 Available columns:', columns)
    
    // Build dynamic query - handle arrays for all columns dynamically
    const selectClauses = columns.map(column => {
      return `
        CASE 
          WHEN typeof(${column}) LIKE '%[]%' THEN ${column}::VARCHAR[]
          WHEN ${column} IS NOT NULL THEN [${column}::VARCHAR]
          ELSE []::VARCHAR[]
        END as ${column}`
    }).join(',')
    
    const dynamicQuery = `
      SELECT ${selectClauses}
      FROM read_parquet('${fileName}')
    `
    
    console.log('🔍 Dynamic query:', dynamicQuery)
    
    // Execute the query
    const queryResult = await conn.query(dynamicQuery)
    const rawData = queryResult.toArray()
    
    // Transform the data with generic array handling
    const transformedData = rawData.map((row: any) => {
      const processField = (value: any): any => {
        if (value === null || value === undefined) return null
        
        // Handle DuckDB Vector objects for arrays
        if (value && typeof value.toArray === 'function') {
          const arrayValue = value.toArray().filter((v: any) => v !== null && v !== undefined)
          return arrayValue.length > 1 ? arrayValue.map(String) : (arrayValue[0] ? String(arrayValue[0]) : null)
        }
        
        // Handle regular arrays
        if (Array.isArray(value)) {
          const filteredArray = value.filter(v => v !== null && v !== undefined)
          return filteredArray.length > 1 ? filteredArray.map(String) : (filteredArray[0] ? String(filteredArray[0]) : null)
        }
        
        // Handle string values
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed)) {
              return parsed.length > 1 ? parsed.map(String) : (parsed[0] ? String(parsed[0]) : null)
            }
            return String(parsed)
          } catch {
            return String(value)
          }
        }
        
        return value
      }

      const transformedRow: any = {}
      columns.forEach(column => {
        transformedRow[column] = processField(row[column])
      })
      
      return transformedRow
    })

    console.log('✅ ESM Datastore transformed data sample:', transformedData.slice(0, 2))
    console.log('📊 Total records:', transformedData.length)
    
    return transformedData
  }

  // Actions
  async function fetchCatalogData() {
    // If we already have data and no error, don't fetch again
    if (data.value.length > 0 && !error.value) {
      console.log('✅ Using cached metacatalog data')
      return
    }
    
    loading.value = true
    error.value = null
    
    let db: duckdb.AsyncDuckDB | null = null
    let conn: duckdb.AsyncDuckDBConnection | null = null
    
    try {
      console.log('🚀 Fetching catalog data...')
      
      // Fetch parquet file and initialize DuckDB concurrently
      const [uint8Array, dbConnection] = await Promise.all([
        fetchParquetFile(),
        initializeDuckDB()
      ])
      
      console.log(`📦 Downloaded ${uint8Array.length} bytes`)
      db = dbConnection.db
      conn = dbConnection.conn
      
      // Query and transform data
      data.value = await queryMetaCatalogPq(db, conn, uint8Array)
      console.log(`📚 Loaded ${data.value.length} catalog entries`)
      
    } catch (err) {
      console.error('❌ Error loading catalog data:', err)
      error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    } finally {
      // Cleanup
      if (conn) await conn.close()
      if (db) await db.terminate()
      loading.value = false
    }
  }

  function clearData() {
    data.value = []
    rawDataSample.value = []
    error.value = null
  }

  // Helper functions for datastore management
  function generateFilterOptions(data: any[]): Record<string, string[]> {
    const options: Record<string, Set<string>> = {}
    
    data.forEach(row => {
      for (const [column, value] of Object.entries(row)) {
        if (!options[column]) {
          options[column] = new Set()
        }
        
        if (Array.isArray(value)) {
          value.forEach(item => {
            if (item != null && String(item).trim()) {
              options[column]?.add(String(item))
            }
          })
        } else if (value != null && String(value).trim()) {
          options[column]?.add(String(value))
        }
      }
    })
    
    // Convert Sets to sorted arrays
    const result: Record<string, string[]> = {}
    for (const [column, optionSet] of Object.entries(options)) {
      result[column] = Array.from(optionSet).sort()
    }
    
    return result
  }

  function setupColumns(dataColumns: string[]): string[] {
    // Filter out the index column from display but keep it for data-key
    return dataColumns.filter(col => col !== '__index_level_0__')
  }

  // Datastore management functions
  async function loadDatastore(datastoreName: string): Promise<DatastoreCache> {
    // Check if already cached and not loading
    const cached = datastoreCache.value[datastoreName]
    if (cached && cached.data.length > 0 && !cached.loading) {
      console.log(`✅ Using cached data for ${datastoreName}`)
      return cached
    }

    // If currently loading, wait for it to complete
    if (cached?.loading) {
      console.log(`⏳ Already loading ${datastoreName}, waiting...`)
      // Poll until loading is complete
      while (datastoreCache.value[datastoreName]?.loading) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return datastoreCache.value[datastoreName] || createEmptyCache()
    }

    // Initialize cache entry
    datastoreCache.value[datastoreName] = {
      data: [],
      totalRecords: 0,
      columns: [],
      filterOptions: {},
      loading: true,
      error: null,
      lastFetched: new Date()
    }

    let db: duckdb.AsyncDuckDB | null = null
    let conn: duckdb.AsyncDuckDBConnection | null = null

    try {
      console.log(`🚀 Loading datastore: ${datastoreName}`)

      // Construct the parquet file URL for this specific datastore
      const parquetUrl = process.env.NODE_ENV === 'production'
        ? `https://corsproxy.io/?https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog/source/${datastoreName}.parquet`
        : `/api/parquet/source/${datastoreName}.parquet`

      // Fetch parquet file and initialize DuckDB concurrently
      const [response, dbConnection] = await Promise.all([
        fetch(parquetUrl),
        initializeDuckDB()
      ])

      if (!response.ok) {
        throw new Error(`Failed to fetch datastore parquet file: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      console.log(`📦 Downloaded ${uint8Array.length} bytes for ${datastoreName}`)

      db = dbConnection.db
      conn = dbConnection.conn

      // Query the ESM datastore data
      const datastoreData = await queryEsmDatastore(db, conn, uint8Array, datastoreName)
      const columns = Object.keys(datastoreData[0] || {})
      const displayColumns = setupColumns(columns)
      const filterOptions = generateFilterOptions(datastoreData)

      // Update cache with loaded data
      datastoreCache.value[datastoreName] = {
        data: datastoreData,
        totalRecords: datastoreData.length,
        columns: displayColumns,
        filterOptions,
        loading: false,
        error: null,
        lastFetched: new Date()
      }

      console.log(`✅ Loaded ${datastoreData.length} records for ${datastoreName}`)
      return datastoreCache.value[datastoreName]

    } catch (err) {
      console.error('❌ Error loading datastore:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load datastore'
      
      datastoreCache.value[datastoreName] = {
        data: [],
        totalRecords: 0,
        columns: [],
        filterOptions: {},
        loading: false,
        error: errorMessage,
        lastFetched: new Date()
      }
      
      throw err
    } finally {
      // Cleanup DuckDB resources
      if (conn) await conn.close()
      if (db) await db.terminate()
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
      lastFetched: new Date()
    }
  }

  function getDatastoreFromCache(datastoreName: string): DatastoreCache | null {
    return datastoreCache.value[datastoreName] || null
  }

  function isDatastoreLoading(datastoreName: string): boolean {
    return datastoreCache.value[datastoreName]?.loading || false
  }

  function clearDatastoreCache(datastoreName?: string) {
    if (datastoreName) {
      delete datastoreCache.value[datastoreName]
      console.log(`🗑️ Cleared cache for datastore: ${datastoreName}`)
    } else {
      datastoreCache.value = {}
      console.log('🗑️ Cleared all datastore cache')
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
    fetchParquetFile,
    initializeDuckDB,
    queryEsmDatastore,
    generateFilterOptions,
    setupColumns
  }
})