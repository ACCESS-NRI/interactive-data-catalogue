/** A single row from a datastore parquet file. Values may be strings, string arrays, or null. */
export interface DatastoreRow {
  [key: string]: string | string[] | null;
}

/** Precomputed filter option sets, keyed by column name. */
export type FilterOptions = Record<string, string[]>;

/** Project identifier associated with a datastore; null when no project is set. */
export type OptionalProject = string | null;

/**
 * Cached representation of an ESM datastore loaded from a parquet file.
 * The store keeps one cache entry per datastore name so components can
 * reuse previously-loaded data without re-downloading or re-parsing.
 */
export interface DatastoreCache {
  /** Raw transformed rows for use in tables and filters. */
  data: DatastoreRow[];
  /** Number of records in `data`. */
  totalRecords: number;
  /** Column names available for display in tables. */
  columns: string[];
  /** Precomputed filter options for each column (unique sorted values). */
  filterOptions: FilterOptions;
  /** Whether this cache entry is currently loading. */
  loading: boolean;
  /** Any error message encountered while loading this datastore. */
  error: string | null;
  /** Timestamp when the datastore was last fetched. */
  lastFetched: Date;
  project?: OptionalProject;
}
