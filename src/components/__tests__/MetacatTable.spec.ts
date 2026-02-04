import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MetacatTable from '../MetacatTable.vue';
import { useCatalogStore } from '../../stores/lazyCatalogStore';
import PrimeVue from 'primevue/config';

describe('MetacatTable', () => {
  let wrapper: VueWrapper<any>;
  let pinia: ReturnType<typeof createPinia>;
  let catalogStore: ReturnType<typeof useCatalogStore>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    catalogStore = useCatalogStore();

    // Mock the fetchCatalogData method to prevent actual API calls
    vi.spyOn(catalogStore, 'fetchCatalogData').mockImplementation(() => Promise.resolve());
  });

  // Helper to create wrapper with global config
  const createWrapper = () => {
    return mount(MetacatTable, {
      global: {
        plugins: [pinia, PrimeVue],
        stubs: {
          DataTable: true,
          Column: true,
          InputText: true,
          Button: true,
          MultiSelect: true,
          Dialog: true,
          MetacatHeader: true,
          MetacatRowDetailModal: true,
        },
      },
    });
  };

  // Test that the component triggers data fetch on mount
  it('fetches catalog data on mount', () => {
    wrapper = createWrapper();
    expect(catalogStore.fetchCatalogData).toHaveBeenCalled();
  });

  // Test that the loading state is displayed when data is being fetched
  it('displays loading state when loading', () => {
    catalogStore.loading = true;
    wrapper = createWrapper();

    expect(wrapper.text()).toContain('Loading catalog data...');
  });

  // Test that the error state is displayed when there is an error
  it('displays error state when there is an error', () => {
    catalogStore.loading = false;
    catalogStore.error = 'Failed to load data';
    wrapper = createWrapper();

    expect(wrapper.text()).toContain('Error loading catalog:');
    expect(wrapper.text()).toContain('Failed to load data');
  });

  // Test that the retry button triggers fetchCatalogData
  it('retries fetching data when retry button is clicked', async () => {
    catalogStore.loading = false;
    catalogStore.error = 'Failed to load data';
    wrapper = createWrapper();

    vi.clearAllMocks();

    const retryButton = wrapper.find('button');
    await retryButton.trigger('click');

    expect(catalogStore.fetchCatalogData).toHaveBeenCalled();
  });

  // Test that the data table is displayed when data is available
  it('displays data table when data is available', () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [
      {
        name: 'test-catalog',
        model: ['model1'],
        description: 'Test description',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
      },
    ];
    wrapper = createWrapper();

    expect(wrapper.findComponent({ name: 'DataTable' }).exists()).toBe(true);
  });

  // Test that the empty state is displayed when data array is empty
  it('displays no data state when data is empty', () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [];
    wrapper = createWrapper();

    expect(wrapper.text()).toContain('No catalog data available');
  });

  // Test that global search filters data correctly
  it('filters data based on global search', async () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [
      {
        name: 'test-catalog-1',
        model: ['model1'],
        description: 'First test entry',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
        searchableRealm: 'atmos',
      },
      {
        name: 'test-catalog-2',
        model: ['model2'],
        description: 'Second test entry',
        realm: ['ocean'],
        frequency: ['1day'],
        variable: ['sst'],
        searchableRealm: 'ocean',
      },
    ];
    wrapper = createWrapper();

    // Initially should show all data
    expect(wrapper.vm.filteredData.length).toBe(2);

    // Set global search value
    wrapper.vm.globalSearchValue = 'ocean';
    await wrapper.vm.$nextTick();

    // Should filter to only matching entries
    expect(wrapper.vm.filteredData.length).toBe(1);
    expect(wrapper.vm.filteredData[0].realm).toContain('ocean');
  });

  // Test that global search is case-insensitive
  it('performs case-insensitive global search', async () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [
      {
        name: 'TEST-CATALOG',
        model: ['model1'],
        description: 'Test Description',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['TAS'],
      },
    ];
    wrapper = createWrapper();

    wrapper.vm.globalSearchValue = 'test';
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.filteredData.length).toBe(1);
  });

  // Test that global search matches against multiple fields
  it('searches across multiple fields', async () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [
      {
        name: 'catalog-1',
        model: ['unique-model'],
        description: 'Test description',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
        searchableModel: 'unique-model',
      },
      {
        name: 'catalog-2',
        model: ['model2'],
        description: 'Different description',
        realm: ['ocean'],
        frequency: ['1day'],
        variable: ['sst'],
      },
    ];
    wrapper = createWrapper();

    // Search by model
    wrapper.vm.globalSearchValue = 'unique-model';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredData.length).toBe(1);
    expect(wrapper.vm.filteredData[0].name).toBe('catalog-1');

    // Search by description
    wrapper.vm.globalSearchValue = 'Different';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredData.length).toBe(1);
    expect(wrapper.vm.filteredData[0].name).toBe('catalog-2');
  });

  // Test that empty search shows all data
  it('shows all data when search is empty', async () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [
      {
        name: 'catalog-1',
        model: ['model1'],
        description: 'Test 1',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
      },
      {
        name: 'catalog-2',
        model: ['model2'],
        description: 'Test 2',
        realm: ['ocean'],
        frequency: ['1day'],
        variable: ['sst'],
      },
    ];
    wrapper = createWrapper();

    wrapper.vm.globalSearchValue = 'test';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredData.length).toBe(2);

    wrapper.vm.globalSearchValue = '';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredData.length).toBe(2);
  });

  // Test that isArrayField correctly identifies array fields
  it('identifies array fields correctly', () => {
    wrapper = createWrapper();

    expect(wrapper.vm.isArrayField('model')).toBe(true);
    expect(wrapper.vm.isArrayField('realm')).toBe(true);
    expect(wrapper.vm.isArrayField('frequency')).toBe(true);
    expect(wrapper.vm.isArrayField('variable')).toBe(true);
    expect(wrapper.vm.isArrayField('name')).toBe(false);
    expect(wrapper.vm.isArrayField('description')).toBe(false);
  });

  // Test that getArrayPreview returns correct preview for empty array
  it('returns "None" for empty array in getArrayPreview', () => {
    wrapper = createWrapper();

    expect(wrapper.vm.getArrayPreview([])).toBe('None');
  });

  // Test that getArrayPreview returns single value for single-item array
  it('returns single value for single-item array in getArrayPreview', () => {
    wrapper = createWrapper();

    expect(wrapper.vm.getArrayPreview(['item1'])).toBe('item1');
  });

  // Test that getArrayPreview returns preview with count for multi-item array
  it('returns preview with count for multi-item array in getArrayPreview', () => {
    wrapper = createWrapper();

    expect(wrapper.vm.getArrayPreview(['item1', 'item2', 'item3'])).toBe('item1 (+2 more)');
  });

  // Test that getArrayPreview handles string values
  it('handles string values in getArrayPreview', () => {
    wrapper = createWrapper();

    expect(wrapper.vm.getArrayPreview('single-string')).toBe('single-string');
    expect(wrapper.vm.getArrayPreview('')).toBe('');
  });

  // Test that openArrayModal sets modal state correctly
  it('opens array modal with correct data', () => {
    wrapper = createWrapper();

    const items = ['item1', 'item2', 'item3'];
    const title = 'Test Items';

    wrapper.vm.openArrayModal(items, title);

    expect(wrapper.vm.arrayModalVisible).toBe(true);
    expect(wrapper.vm.arrayModalTitle).toBe('Test Items');
    expect(wrapper.vm.arrayModalItems).toEqual(['item1', 'item2', 'item3']);
  });

  // Test that showRowDetail sets detail modal state correctly
  it('shows row detail modal with correct data', () => {
    wrapper = createWrapper();

    const rowData = {
      name: 'test-catalog',
      model: ['model1'],
      description: 'Test description',
    };

    wrapper.vm.showRowDetail(rowData);

    expect(wrapper.vm.detailModalVisible).toBe(true);
    expect(wrapper.vm.selectedRowData).toEqual(rowData);
  });

  // Test that hideRowDetail clears modal state
  it('hides row detail modal and clears selection', () => {
    wrapper = createWrapper();

    // First show the modal
    wrapper.vm.selectedRowData = { name: 'test' };
    wrapper.vm.detailModalVisible = true;

    // Then hide it
    wrapper.vm.hideRowDetail();

    expect(wrapper.vm.detailModalVisible).toBe(false);
    expect(wrapper.vm.selectedRowData).toBeNull();
  });

  // Test that all columns are selected by default
  it('selects all columns by default', () => {
    wrapper = createWrapper();

    expect(wrapper.vm.selectedColumns.length).toBe(wrapper.vm.columns.length);
    expect(wrapper.vm.selectedColumns).toEqual(wrapper.vm.columns);
  });

  // Test that onToggle updates selected columns correctly
  it('updates selected columns when toggled', () => {
    wrapper = createWrapper();

    const firstColumn = wrapper.vm.columns[0];
    const secondColumn = wrapper.vm.columns[1];

    // Toggle to only select first two columns
    wrapper.vm.onToggle([firstColumn, secondColumn]);

    expect(wrapper.vm.selectedColumns.length).toBe(2);
    expect(wrapper.vm.selectedColumns).toContain(firstColumn);
    expect(wrapper.vm.selectedColumns).toContain(secondColumn);
  });

  // Test that onToggle handles empty selection
  it('handles empty column selection', () => {
    wrapper = createWrapper();

    wrapper.vm.onToggle([]);

    expect(wrapper.vm.selectedColumns.length).toBe(0);
  });

  // Test that MetacatHeader component is rendered
  it('renders MetacatHeader component', () => {
    wrapper = createWrapper();

    expect(wrapper.findComponent({ name: 'MetacatHeader' }).exists()).toBe(true);
  });

  // Test that MetacatRowDetailModal receives correct props
  it('passes correct props to MetacatRowDetailModal', async () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [
      {
        name: 'test',
        model: ['model1'],
        description: 'Test',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
      },
    ];
    wrapper = createWrapper();

    const rowData = { name: 'test-catalog', description: 'test' };
    wrapper.vm.showRowDetail(rowData);
    await wrapper.vm.$nextTick();

    const modal = wrapper.findComponent({ name: 'MetacatRowDetailModal' });
    expect(modal.props('visible')).toBe(true);
    expect(modal.props('rowData')).toEqual(rowData);
  });

  // Test that the component handles data with missing searchable fields
  it('handles data with missing searchable fields gracefully', async () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [
      {
        name: 'catalog-without-searchable',
        model: ['model1'],
        description: 'Test',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
        // Missing searchableModel, searchableRealm, etc.
      },
    ];
    wrapper = createWrapper();

    wrapper.vm.globalSearchValue = 'catalog';
    await wrapper.vm.$nextTick();

    // Should still find the entry by name
    expect(wrapper.vm.filteredData.length).toBe(1);
  });
});
