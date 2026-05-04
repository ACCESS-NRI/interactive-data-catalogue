type OptionalProject = string | null;

type DatastoreScalar = string | number | boolean | null;

export type DatastoreCellValue = DatastoreScalar | DatastoreScalar[];

export interface DatastoreRow {
  [key: string]: DatastoreCellValue;
}

export type FilterMap = Record<string, string[]>;

export type FilterOptions = FilterMap;

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

export interface PagedDatastoreResponse {
  records: DatastoreRow[];
  total: number;
  unique_file_ids?: string[];
  dynamic_filter_options?: FilterOptions;
}
