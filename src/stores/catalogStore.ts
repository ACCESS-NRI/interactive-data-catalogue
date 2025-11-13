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

const PARQUET_URL = '/api/parquet/metacatalog.parquet'

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

  async function queryParquetData(db: duckdb.AsyncDuckDB, conn: duckdb.AsyncDuckDBConnection, uint8Array: Uint8Array): Promise<CatalogRow[]> {
    // Register the parquet file
    await db.registerFileBuffer('metacatalog.parquet', uint8Array)
    
    // First, let's inspect the schema
    const schemaResult = await conn.query(`
      DESCRIBE SELECT * FROM read_parquet('metacatalog.parquet') LIMIT 1
    `)
    console.log('📊 Parquet schema:', schemaResult.toArray())
    
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

  // Actions
  async function fetchCatalogData() {
    loading.value = true
    error.value = null
    
    let db: duckdb.AsyncDuckDB | null = null
    let conn: duckdb.AsyncDuckDBConnection | null = null
    
    try {
      console.log('🚀 Fetching catalog data...')
      
      // Fetch parquet file
      const uint8Array = await fetchParquetFile()
      console.log(`📦 Downloaded ${uint8Array.length} bytes`)
      
      // Initialize DuckDB
      const dbConnection = await initializeDuckDB()
      db = dbConnection.db
      conn = dbConnection.conn
      
      // Query and transform data
      data.value = await queryParquetData(db, conn, uint8Array)
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

  return {
    // State
    data,
    loading,
    error,
    rawDataSample,
    
    // Getters
    catalogCount,
    hasData,
    isLoading,
    hasError,
    
    // Actions
    fetchCatalogData,
    clearData
  }
})