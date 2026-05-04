import { ref } from 'vue';
import type { Ref } from 'vue';
import type { DatastoreCellValue } from '../types/datastore';

export function useDatastoreEntryModal(): {
  showDataStoreEntryModal: Ref<boolean>;
  modalTitle: Ref<string>;
  modalItems: Ref<DatastoreCellValue[]>;
  openDatastoreEntryModal: (title: string, items: DatastoreCellValue | DatastoreCellValue[]) => void;
} {
  const showDataStoreEntryModal = ref(false);
  const modalTitle = ref('');
  const modalItems = ref<DatastoreCellValue[]>([]);

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
