import { initializeDuckDB } from './duckdbClient';

/**
 * Parses an intake-esm CSV file using DuckDB WASM's `read_csv_auto`.
 *
 * Returns the raw rows and the list of column names found in the file.
 * The caller is responsible for normalizing the rows into typed DatastoreRow
 * objects (see `normalizeDatastoreRows` in parquetTransforms).
 *
 * @throws {Error} When the file is not a CSV, is empty, or DuckDB cannot parse it.
 */
export async function parseCsvFile(file: File): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error('Personal datastore uploads must be CSV files');
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('The selected file is empty');
  }

  const { db, conn } = await initializeDuckDB();

  try {
    const fileName = 'personal-datastore.csv';
    await db.registerFileBuffer(fileName, new Uint8Array(arrayBuffer));

    const schemaResult = await conn.query(`DESCRIBE SELECT * FROM read_csv_auto('${fileName}') LIMIT 1`);
    const columns = (schemaResult.toArray() as Array<{ column_name: string }>)
      .map((row) => row.column_name)
      .filter((col) => col !== 'filename');

    const queryResult = await conn.query(`SELECT * FROM read_csv_auto('${fileName}')`);
    const rows = queryResult.toArray() as Record<string, unknown>[];

    return { rows, columns };
  } finally {
    await conn.close();
    await db.terminate();
  }
}
