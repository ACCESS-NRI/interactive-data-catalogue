import { ref, onMounted } from 'vue'
import * as duckdb from '@duckdb/duckdb-wasm'
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

interface CatalogRow {
  name: string
  model: string[]
  description: string
  realm: string[]
  frequency: string[]
  variable: string[]
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
  
  // Query with explicit array handling - cast everything to VARCHAR[]
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
      END as variable
    FROM read_parquet('metacatalog.parquet')
    LIMIT 10
  `)
  
  // Transform to our interface with proper array handling
  return queryResult.toArray().map((row: any) => {
    const processListField = (value: any): string[] => {
      if (value === null || value === undefined) return []
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
    }  return {
      name: row.name || '',
      model: processListField(row.model),
      description: row.description || '',
      realm: processListField(row.realm),
      frequency: processListField(row.frequency),
      variable: processListField(row.variable)
    }
  })
}

export function useCatalogData() {
  const data = ref<CatalogRow[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchCatalogData = async () => {
    loading.value = true
    error.value = null
    
    let db: duckdb.AsyncDuckDB | null = null
    let conn: duckdb.AsyncDuckDBConnection | null = null
    
    try {
      console.log('Fetching catalog data...')
      
      // Fetch parquet file and initialize DuckDB concurrently
      const [uint8Array, dbConnection] = await Promise.all([
        fetchParquetFile(),
        initializeDuckDB()
      ])
      
      console.log(`Downloaded ${uint8Array.length} bytes`)
      db = dbConnection.db
      conn = dbConnection.conn
      
      // Query and transform data
      data.value = await queryParquetData(db, conn, uint8Array)
      console.log(`Loaded ${data.value.length} catalog entries`)
      
    } catch (err) {
      console.error('Error loading catalog data:', err)
      error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    } finally {
      // Cleanup
      if (conn) await conn.close()
      if (db) await db.terminate()
      loading.value = false
    }
  }

  onMounted(() => {
    fetchCatalogData()
  })

  return {
    data,
    loading,
    error,
    refetch: fetchCatalogData
  }
}