import { ref } from 'vue';
import type { Ref } from 'vue';
import type { DatastoreCellValue } from '../types/datastore';

/**
 * Provides shared modal state for showing full datastore cell contents.
 *
 * This is used by both eager and lazy datastore tables so array-valued fields and long cell
 * content can open the same detail modal without duplicating state wiring.
 *
 * @returns Reactive modal visibility/title/items state plus a helper for opening the modal.
 */
export function useDatastoreEntryModal(): {
  showDataStoreEntryModal: Ref<boolean>;
  modalTitle: Ref<string>;
  modalItems: Ref<DatastoreCellValue[]>;
  openDatastoreEntryModal: (title: string, items: DatastoreCellValue | DatastoreCellValue[]) => void;
} {
  const showDataStoreEntryModal = ref(false);
  const modalTitle = ref('');
  const modalItems = ref<DatastoreCellValue[]>([]);

  /**
   * Opens the datastore-entry modal with a normalized list of items.
   *
   * @param title - Modal title to display.
   * @param items - One or more datastore cell values to show in the modal.
   */
  const openDatastoreEntryModal = (title: string, items: DatastoreCellValue | DatastoreCellValue[]) => {
    modalTitle.value = title || 'Details';
    modalItems.value = Array.isArray(items) ? items : [items];
    showDataStoreEntryModal.value = true;
  };

  return {
    showDataStoreEntryModal,
    modalTitle,
    modalItems,
    openDatastoreEntryModal,
  };
}
