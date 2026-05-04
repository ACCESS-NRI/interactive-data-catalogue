import * as duckdb from '@duckdb/duckdb-wasm';
import duckdbWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

/** DuckDB WASM bundles used by the client; selectBundle picks the best one. */
const DUCKDB_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdbWasm,
    mainWorker: mvpWorker,
  },
};

export async function initializeDuckDB() {
  const bundle = DUCKDB_BUNDLES.mvp;
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(bundle.mainModule);
  const conn = await db.connect();

  return { db, conn };
}
