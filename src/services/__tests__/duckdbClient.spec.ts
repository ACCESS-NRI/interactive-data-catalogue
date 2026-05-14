import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as duckdb from '@duckdb/duckdb-wasm';

// Mock the DuckDB WASM module
vi.mock('@duckdb/duckdb-wasm', () => ({
  AsyncDuckDB: vi.fn(),
  ConsoleLogger: vi.fn(),
}));

// Mock the wasm/worker URL imports
vi.mock('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url', () => ({ default: 'mock-wasm-url' }));
vi.mock('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url', () => ({ default: 'mock-worker-url' }));

describe('duckdbClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.Worker = vi.fn() as any;
  });

  it('initializes DuckDB and returns db and conn', async () => {
    const mockConn = { query: vi.fn() };
    const mockDb = {
      instantiate: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(mockConn),
    };

    vi.mocked(duckdb.ConsoleLogger).mockImplementation(() => ({}) as any);
    vi.mocked(duckdb.AsyncDuckDB).mockImplementation(() => mockDb as any);

    const { initializeDuckDB } = await import('../duckdbClient');
    const result = await initializeDuckDB();

    expect(result.db).toBe(mockDb);
    expect(result.conn).toBe(mockConn);
    expect(mockDb.instantiate).toHaveBeenCalledWith('mock-wasm-url');
    expect(mockDb.connect).toHaveBeenCalled();
  });
});
