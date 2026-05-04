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
