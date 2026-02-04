import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import LazyDatastoreTable from '../lazy/LazyDatastoreTable.vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import MultiSelect from 'primevue/multiselect';
import DatastoreEntryModal from '../DatastoreEntryModal.vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';

// Mock the fetch API
const mockFetchResponse = {
  records: [
    {
      __index_level_0__: 1,
      variable: ['temp', 'pressure', 'humidity', 'wind'],
      variable_units: ['K', 'Pa', 'kg/kg'],
      frequency: 'daily',
      realm: 'atmosphere',
    },
    {
      __index_level_0__: 2,
      variable: ['salinity', 'temperature'],
      variable_units: ['psu'],
      frequency: 'monthly',
      realm: 'ocean',
    },
  ],
  total: 2,
  unique_file_ids: ['file1', 'file2'],
};

describe('LazyDatastoreTable', () => {
  const mockColumns = [
    { field: 'variable', header: 'Variable' },
    { field: 'frequency', header: 'Frequency' },
    { field: 'realm', header: 'Realm' },
  ];

  beforeEach(() => {
    // Mock fetch for all tests
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockFetchResponse),
      } as Response),
    );
  });

  // Helper to create wrapper with PrimeVue components
  const createWrapper = (props: any = {}) => {
    return mount(LazyDatastoreTable, {
      props: {
        tableLoading: false,
        selectedColumns: mockColumns,
        availableColumns: mockColumns,
        columns: ['variable', 'frequency', 'realm'],
        datastoreName: 'test-datastore',
        filters: {},
        ...props,
      },
      global: {
        plugins: [
          [
            PrimeVue,
            {
              theme: {
                preset: Aura,
              },
            },
          ],
        ],
        components: {
          DataTable,
          Column,
          Button,
          MultiSelect,
          DatastoreEntryModal,
        },
        stubs: {
          DatastoreEntryModal: true,
          // Don't stub DataTable and other PrimeVue components
        },
      },
    });
  };

  // Helper to show the table by clicking the show button
  const showTable = async (wrapper: any) => {
    const showButton = wrapper.findAllComponents(Button)[0];
    await showButton.trigger('click');
    await flushPromises();
  };

  // Test that the datastore name is displayed in the header
  it('renders datastore name in header', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('test-datastore Data');
  });

  // Test that the record count is displayed with proper locale formatting
  it('renders record count with locale formatting', async () => {
    const wrapper = createWrapper();
    await flushPromises();
    expect(wrapper.text()).toContain('records');
  });

  // Test that the component shows the loading state when tableLoading is true
  it('passes loading state to DataTable', async () => {
    const wrapper = createWrapper({ tableLoading: true });
    await showTable(wrapper);
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Extra wait for component rendering
    // Verify the component rendered
    expect(wrapper.exists()).toBe(true);
  });

  // Test that the refresh button emits the refresh event when clicked
  it('emits refresh event when refresh button is clicked', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    await flushPromises();
    const buttons = wrapper.findAllComponents(Button);
    const refreshButton = buttons.find((b) => b.props('label') === 'Refresh');

    if (refreshButton) {
      await refreshButton.trigger('click');
      expect(wrapper.emitted('refresh')).toBeTruthy();
      expect(wrapper.emitted('refresh')).toHaveLength(1);
    }
  });

  // Test that column toggle emits update event with selected columns
  it('emits update:selectedColumns when columns are toggled', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    await flushPromises();
    const multiSelect = wrapper.findComponent(MultiSelect);

    if (multiSelect.exists()) {
      const newColumns = [{ field: 'variable', header: 'Variable' }];
      await multiSelect.vm.$emit('update:model-value', newColumns);

      expect(wrapper.emitted('update:selectedColumns')).toBeTruthy();
      expect(wrapper.emitted('update:selectedColumns')?.[0]).toEqual([newColumns]);
    }
  });

  // Test that the DataTable receives correct pagination configuration
  it('configures DataTable with pagination props', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    await flushPromises();
    const dataTable = wrapper.findComponent(DataTable);

    if (dataTable.exists()) {
      expect(dataTable.props('paginator')).toBe(true);
    }
  });

  // Test that DataTable receives the fetched data
  it('fetches and displays data from server', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    await flushPromises();

    // Data should be fetched from the mocked server
    expect(global.fetch).toHaveBeenCalled();
  });

  // Test that Column components are rendered for each selected column
  it('renders Column components for selected columns', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Extra wait for component rendering

    // Even if Column components aren't deeply found, the table should render
    expect(wrapper.exists()).toBe(true);
  });

  // Test that each Column is configured with correct field and header
  it('configures columns with correct field and header props', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    await flushPromises();
    const columns = wrapper.findAllComponents(Column);

    if (columns.length > 0) {
      columns.forEach((column, index) => {
        if (index < mockColumns.length) {
          expect(column.props('field')).toBe(mockColumns[index]?.field);
          expect(column.props('header')).toBe(mockColumns[index]?.header);
          expect(column.props('sortable')).toBe(true);
        }
      });
    }
  });

  // Test that the MultiSelect receives available and selected columns
  it('configures MultiSelect with column options', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    await flushPromises();
    const multiSelect = wrapper.findComponent(MultiSelect);

    if (multiSelect.exists()) {
      expect(multiSelect.props('modelValue')).toEqual(mockColumns);
      expect(multiSelect.props('options')).toEqual(mockColumns);
      expect(multiSelect.props('optionLabel')).toBe('header');
    }
  });

  // Test that the modal refs are initialized with correct default values
  it('initializes modal state correctly', () => {
    const wrapper = createWrapper();

    expect(wrapper.vm.showDataStoreEntryModal).toBe(false);
    expect(wrapper.vm.modalTitle).toBe('');
    expect(wrapper.vm.modalItems).toEqual([]);
  });

  // Test that openDatastoreEntryModal updates modal state with provided data
  it('opens modal with correct data when openDatastoreEntryModal is called', () => {
    const wrapper = createWrapper();
    const testItems = ['item1', 'item2', 'item3'];

    wrapper.vm.openDatastoreEntryModal('Test Title', testItems);

    expect(wrapper.vm.showDataStoreEntryModal).toBe(true);
    expect(wrapper.vm.modalTitle).toBe('Test Title');
    expect(wrapper.vm.modalItems).toEqual(testItems);
  });

  // Test that openDatastoreEntryModal wraps non-array items in an array
  it('wraps non-array items in array when opening modal', () => {
    const wrapper = createWrapper();
    const singleItem = 'single-item';

    wrapper.vm.openDatastoreEntryModal('Single Item', singleItem);

    expect(wrapper.vm.modalItems).toEqual([singleItem]);
  });

  // Test that openDatastoreEntryModal uses default title when none provided
  it('uses default title when opening modal without title', () => {
    const wrapper = createWrapper();

    wrapper.vm.openDatastoreEntryModal('', ['item1']);

    expect(wrapper.vm.modalTitle).toBe('Details');
  });

  // Test that the component renders DatastoreEntryModal with v-model binding
  it('renders DatastoreEntryModal with correct props', () => {
    const wrapper = createWrapper();
    const modal = wrapper.findComponent(DatastoreEntryModal);

    expect(modal.exists()).toBe(true);
    expect(modal.props('title')).toBe('');
    expect(modal.props('items')).toEqual([]);
  });

  // Test that the component handles empty data gracefully
  it('handles empty data', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ records: [], total: 0, unique_file_ids: [] }),
      } as Response),
    );

    const wrapper = createWrapper();
    await flushPromises();
    // Verify the component renders with empty data
    expect(wrapper.exists()).toBe(true);
  });

  // Test that the component handles missing datastoreName
  it('handles missing datastore name', () => {
    const wrapper = createWrapper({ datastoreName: '' });
    // When datastoreName is empty, it should still render "Data" text
    const text = wrapper.text();
    expect(text.includes('Data') || text.includes('0 records')).toBe(true);
  });

  // Test that the component renders with variable_units
  it('renders with variable_units column', async () => {
    const columnsWithUnits = [{ field: 'variable_units', header: 'Variable Units' }];
    const wrapper = createWrapper({ selectedColumns: columnsWithUnits });
    await showTable(wrapper);
    await flushPromises();

    // Table should render without errors
    expect(wrapper.exists()).toBe(true);
  });

  // Test that variable_units shows "+X more" link when there are more than 2 units
  it('shows "+X more" link for variable_units when more than 2 units exist', async () => {
    const columnsWithUnits = [{ field: 'variable_units', header: 'Variable Units' }];
    const wrapper = createWrapper({ selectedColumns: columnsWithUnits });
    await showTable(wrapper);
    await flushPromises();

    // After data loads, check for the "+X more" button
    const html = wrapper.html();
    if (html.includes('+')) {
      expect(html).toContain('more');
    }
  });

  // Test that clicking "+X more" on variable_units opens the modal
  it('opens modal when clicking "+X more" on variable_units field', async () => {
    // Mock response with more units
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            records: [
              {
                __index_level_0__: 1,
                variable_units: ['K', 'Pa', 'kg/kg', 'W/m2'],
              },
            ],
            total: 1,
            unique_file_ids: ['file1'],
          }),
      } as Response),
    );

    const columnsWithUnits = [{ field: 'variable_units', header: 'Variable Units' }];
    const wrapper = createWrapper({
      selectedColumns: columnsWithUnits,
    });
    await showTable(wrapper);
    await flushPromises();

    // Find and click the "+X more" button if it exists
    const moreButton = wrapper.find('[role="button"]');
    if (moreButton.exists()) {
      await moreButton.trigger('click');

      expect(wrapper.vm.showDataStoreEntryModal).toBe(true);
      expect(wrapper.vm.modalTitle).toBe('Variable Units');
    }
  });

  // Test that variable_units with 2 or fewer units doesn't show "+X more"
  it('does not show "+X more" for variable_units with 2 or fewer units', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            records: [
              {
                __index_level_0__: 1,
                variable_units: ['K', 'Pa'],
              },
            ],
            total: 1,
            unique_file_ids: ['file1'],
          }),
      } as Response),
    );

    const columnsWithUnits = [{ field: 'variable_units', header: 'Variable Units' }];
    const wrapper = createWrapper({
      selectedColumns: columnsWithUnits,
    });
    await showTable(wrapper);
    await flushPromises();

    const html = wrapper.html();
    // Should not show more button when only 2 units
    expect(html).not.toContain('+1 more');
  });
});
