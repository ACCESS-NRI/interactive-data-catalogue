/** A table column descriptor used by PrimeVue DataTable column selection. */
export interface TableColumn {
  field: string;
  header: string;
}

/** PrimeVue DataTable page-change event payload. */
export interface PageEvent {
  page: number;
  first: number;
  rows: number;
  pageCount: number;
}
