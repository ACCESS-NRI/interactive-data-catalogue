import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import EagerDatastoreTable from '../eager/EagerDatastoreTable.vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import MultiSelect from 'primevue/multiselect';
import DatastoreEntryModal from '../DatastoreEntryModal.vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';

describe('DatastoreTable', () => {
  const mockColumns = [
    { field: 'variable', header: 'Variable' },
    { field: 'frequency', header: 'Frequency' },
    { field: 'realm', header: 'Realm' },
  ];

  const mockData = [
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
  ];

  // Helper to create wrapper with PrimeVue components
  const createWrapper = (props: any = {}) => {
    return mount(EagerDatastoreTable, {
      props: {
        filteredData: mockData,
        tableLoading: false,
        selectedColumns: mockColumns,
        availableColumns: mockColumns,
        columns: ['variable', 'frequency', 'realm'],
        datastoreName: 'test-datastore',
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
        },
      },
    });
  };

  // Helper to show the table by clicking the show button
  const showTable = async (wrapper: any) => {
    const showButton = wrapper.findAllComponents(Button)[0];
    await showButton.trigger('click');
  };

  // Test that the datastore name is displayed in the header
  it('renders datastore name in header', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('test-datastore Data');
  });

  // Test that the record count is displayed with proper locale formatting
  it('renders record count with locale formatting', () => {
    const wrapper = createWrapper({ filteredData: mockData });
    expect(wrapper.text()).toContain('2 Data Files');
  });

  // Test that the component shows the loading state when tableLoading is true
  it('passes loading state to DataTable', async () => {
    const wrapper = createWrapper({ tableLoading: true });
    await showTable(wrapper);
    const dataTable = wrapper.findComponent(DataTable);
    expect(dataTable.exists()).toBe(true);
    expect(dataTable.props('loading')).toBe(true);
  });

  // Test that the refresh button emits the refresh event when clicked
  it('emits refresh event when refresh button is clicked', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    const buttons = wrapper.findAllComponents(Button);
    const refreshButton = buttons[1]; // Second button is the refresh button

    if (!refreshButton) {
      throw new Error('Refresh button not found');
    }

    await refreshButton.trigger('click');

    expect(wrapper.emitted('refresh')).toBeTruthy();
    expect(wrapper.emitted('refresh')).toHaveLength(1);
  });

  // Test that column toggle emits update event with selected columns
  it('emits update:selectedColumns when columns are toggled', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    const multiSelect = wrapper.findComponent(MultiSelect);

    const newColumns = [{ field: 'variable', header: 'Variable' }];
    await multiSelect.vm.$emit('update:model-value', newColumns);

    expect(wrapper.emitted('update:selectedColumns')).toBeTruthy();
    expect(wrapper.emitted('update:selectedColumns')?.[0]).toEqual([newColumns]);
  });

  // Test that the DataTable receives correct pagination configuration
  it('configures DataTable with pagination props', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    const dataTable = wrapper.findComponent(DataTable);

    expect(dataTable.props('paginator')).toBe(true);
    expect(dataTable.props('rows')).toBe(25);
    expect(dataTable.props('rowsPerPageOptions')).toEqual([10, 25, 50, 100]);
  });

  // Test that DataTable receives the filtered data
  it('passes filteredData to DataTable', async () => {
    const wrapper = createWrapper({ filteredData: mockData });
    await showTable(wrapper);
    const dataTable = wrapper.findComponent(DataTable);

    expect(dataTable.props('value')).toEqual(mockData);
    expect(dataTable.props('totalRecords')).toBe(2);
  });

  // Test that DataTable is configured with correct table features
  it('configures DataTable with gridlines, sorting, and resizing', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    const dataTable = wrapper.findComponent(DataTable);

    expect(dataTable.props('showGridlines')).toBe(true);
    expect(dataTable.props('stripedRows')).toBe(true);
    expect(dataTable.props('removableSort')).toBe(true);
    expect(dataTable.props('resizableColumns')).toBe(true);
  });

  // Test that Column components are rendered for each selected column
  it('renders Column components for selected columns', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    const columns = wrapper.findAllComponents(Column);

    expect(columns.length).toBe(mockColumns.length);
  });

  // Test that each Column is configured with correct field and header
  it('configures columns with correct field and header props', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    const columns = wrapper.findAllComponents(Column);

    columns.forEach((column, index) => {
      expect(column.props('field')).toBe(mockColumns[index]?.field);
      expect(column.props('header')).toBe(mockColumns[index]?.header);
      expect(column.props('sortable')).toBe(true);
    });
  });

  // Test that the MultiSelect receives available and selected columns
  it('configures MultiSelect with column options', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    const multiSelect = wrapper.findComponent(MultiSelect);

    expect(multiSelect.props('modelValue')).toEqual(mockColumns);
    expect(multiSelect.props('options')).toEqual(mockColumns);
    expect(multiSelect.props('optionLabel')).toBe('header');
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

  // Test that the component handles empty filteredData gracefully
  it('handles empty filtered data', async () => {
    const wrapper = createWrapper({ filteredData: [] });
    await showTable(wrapper);
    const dataTable = wrapper.findComponent(DataTable);

    expect(dataTable.props('value')).toEqual([]);
    expect(dataTable.props('totalRecords')).toBe(0);
    expect(wrapper.text()).toContain('0 Data Files');
  });

  // Test that the component handles missing datastoreName
  it('handles missing datastore name', () => {
    const wrapper = createWrapper({ datastoreName: '' });
    // When datastoreName is empty, it should still render "Data" text
    const text = wrapper.text();
    expect(text.includes('Data') || text.includes('0 records')).toBe(true);
  });

  // Test that globalFilterFields is configured with column names
  it('configures global filter fields', async () => {
    const wrapper = createWrapper();
    await showTable(wrapper);
    const dataTable = wrapper.findComponent(DataTable);

    expect(dataTable.props('globalFilterFields')).toEqual(['variable', 'frequency', 'realm']);
  });

  // Test that variable_units field renders units with proper display limit
  it('renders variable_units with up to 2 units displayed', async () => {
    const columnsWithUnits = [{ field: 'variable_units', header: 'Variable Units' }];
    const wrapper = createWrapper({ selectedColumns: columnsWithUnits });
    await showTable(wrapper);

    const html = wrapper.html();
    expect(html).toContain('K');
    expect(html).toContain('Pa');
  });

  // Test that variable_units shows "+X more" link when there are more than 2 units
  it('shows "+X more" link for variable_units when more than 2 units exist', async () => {
    const columnsWithUnits = [{ field: 'variable_units', header: 'Variable Units' }];
    const wrapper = createWrapper({ selectedColumns: columnsWithUnits });
    await showTable(wrapper);

    const html = wrapper.html();
    expect(html).toContain('+1 more');
  });

  // Test that clicking "+X more" on variable_units opens the modal
  it('opens modal when clicking "+X more" on variable_units field', async () => {
    const columnsWithUnits = [{ field: 'variable_units', header: 'Variable Units' }];
    const wrapper = createWrapper({
      selectedColumns: columnsWithUnits,
      filteredData: [
        {
          __index_level_0__: 1,
          variable_units: ['K', 'Pa', 'kg/kg', 'W/m2'],
        },
      ],
    });
    await showTable(wrapper);

    // Find and click the "+X more" button
    const moreButton = wrapper.find('[role="button"]');
    expect(moreButton.exists()).toBe(true);

    await moreButton.trigger('click');

    expect(wrapper.vm.showDataStoreEntryModal).toBe(true);
    expect(wrapper.vm.modalTitle).toBe('Variable Units');
    expect(wrapper.vm.modalItems).toEqual(['K', 'Pa', 'kg/kg', 'W/m2']);
  });

  // Test that variable_units with 2 or fewer units doesn't show "+X more"
  it('does not show "+X more" for variable_units with 2 or fewer units', async () => {
    const columnsWithUnits = [{ field: 'variable_units', header: 'Variable Units' }];
    const dataWithFewUnits = [
      {
        __index_level_0__: 1,
        variable_units: ['K', 'Pa'],
      },
    ];
    const wrapper = createWrapper({
      selectedColumns: columnsWithUnits,
      filteredData: dataWithFewUnits,
    });
    await showTable(wrapper);

    const html = wrapper.html();
    expect(html).not.toContain('more');
  });
});
