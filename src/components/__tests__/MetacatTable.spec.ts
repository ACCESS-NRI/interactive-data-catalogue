import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MetacatTable from '../MetacatTable.vue';
import { useCatalogStore } from '../../stores/catalogStore';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';

// Mock useToast to avoid actual toast service calls in tests
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn(),
  }),
}));

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
        plugins: [pinia, PrimeVue, ToastService],
        stubs: {
          DataTable: true,
          Column: true,
          InputText: true,
          Button: true,
          MultiSelect: true,
          Dialog: true,
          Toast: true,
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

    expect(wrapper.text()).toContain('Loading catalogue data...');
  });

  // Test that the error state is displayed when there is an error
  it('displays error state when there is an error', () => {
    catalogStore.loading = false;
    catalogStore.error = 'Failed to load data';
    wrapper = createWrapper();

    expect(wrapper.text()).toContain('Error loading catalogue:');
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

    expect(wrapper.text()).toContain('No catalogue data available');
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

  // ---------------------------------------------------------------------------
  // FilterSelectors integration
  // ---------------------------------------------------------------------------

  // Test that currentFilters initialises to an empty object
  it('initialises currentFilters as empty object', () => {
    wrapper = createWrapper();

    expect(wrapper.vm.currentFilters).toEqual({});
  });

  // Test that clearFilters resets currentFilters to an empty object
  it('clearFilters resets currentFilters to empty object', async () => {
    wrapper = createWrapper();

    wrapper.vm.currentFilters = { realm: ['atmos'], frequency: ['1mon'] };
    await wrapper.vm.$nextTick();

    wrapper.vm.clearFilters();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.currentFilters).toEqual({});
  });

  // Test that filterOptions derives unique sorted values from catalogStore.data
  it('computes filterOptions with unique sorted values per filterable field', () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [
      {
        name: 'catalog-1',
        model: ['modelB', 'modelA'],
        description: 'Test 1',
        realm: ['ocean'],
        frequency: ['1day'],
        variable: ['sst'],
      },
      {
        name: 'catalog-2',
        model: ['modelA', 'modelC'],
        description: 'Test 2',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
      },
    ];
    wrapper = createWrapper();

    const opts = wrapper.vm.filterOptions;

    // All unique model values, sorted
    expect(opts.model).toEqual(['modelA', 'modelB', 'modelC']);
    // All unique realm values, sorted
    expect(opts.realm).toEqual(['atmos', 'ocean']);
    // All unique frequency values, sorted
    expect(opts.frequency).toEqual(['1day', '1mon']);
    // All unique variable values, sorted
    expect(opts.variable).toEqual(['sst', 'tas']);
  });

  // Test that filterOptions handles entries with empty arrays gracefully
  it('filterOptions handles empty arrays in data rows', () => {
    catalogStore.data = [
      {
        name: 'catalog-1',
        model: [],
        description: 'Test',
        realm: ['atmos'],
        frequency: [],
        variable: ['tas'],
      },
    ];
    wrapper = createWrapper();

    const opts = wrapper.vm.filterOptions;
    expect(opts.model).toEqual([]);
    expect(opts.frequency).toEqual([]);
    expect(opts.realm).toEqual(['atmos']);
  });

  // Test that dynamicFilterOptions returns all options when no filters are active
  it('dynamicFilterOptions returns all options when no filters are active', () => {
    catalogStore.data = [
      {
        name: 'catalog-1',
        model: ['modelA'],
        description: 'Test',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
      },
      {
        name: 'catalog-2',
        model: ['modelB'],
        description: 'Test 2',
        realm: ['ocean'],
        frequency: ['1day'],
        variable: ['sst'],
      },
    ];
    wrapper = createWrapper();

    const dynamic = wrapper.vm.dynamicFilterOptions;

    expect(dynamic.model).toEqual(['modelA', 'modelB']);
    expect(dynamic.realm).toEqual(['atmos', 'ocean']);
  });

  // Test that dynamicFilterOptions restricts options based on active cross-column filters
  it('dynamicFilterOptions restricts options based on currently active filters', async () => {
    catalogStore.data = [
      {
        name: 'catalog-1',
        model: ['modelA'],
        description: 'Test',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
      },
      {
        name: 'catalog-2',
        model: ['modelB'],
        description: 'Test 2',
        realm: ['ocean'],
        frequency: ['1day'],
        variable: ['sst'],
      },
    ];
    wrapper = createWrapper();

    // Activate a realm filter — only 'atmos' rows remain for other columns
    wrapper.vm.currentFilters = { realm: ['atmos'] };
    await wrapper.vm.$nextTick();

    const dynamic = wrapper.vm.dynamicFilterOptions;

    // realm itself still shows both values (cross-column: doesn't filter by itself)
    expect(dynamic.realm).toEqual(['atmos', 'ocean']);
    // model should only show options present in atmos rows
    expect(dynamic.model).toEqual(['modelA']);
    expect(dynamic.model).not.toContain('modelB');
    // frequency and variable should also be restricted
    expect(dynamic.frequency).toEqual(['1mon']);
    expect(dynamic.variable).toEqual(['tas']);
  });

  // Test that filteredData applies column filters correctly
  it('filters data based on currentFilters', async () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [
      {
        name: 'catalog-1',
        model: ['modelA'],
        description: 'Test',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
      },
      {
        name: 'catalog-2',
        model: ['modelB'],
        description: 'Test 2',
        realm: ['ocean'],
        frequency: ['1day'],
        variable: ['sst'],
      },
    ];
    wrapper = createWrapper();

    expect(wrapper.vm.filteredData.length).toBe(2);

    wrapper.vm.currentFilters = { realm: ['ocean'] };
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.filteredData.length).toBe(1);
    expect(wrapper.vm.filteredData[0].name).toBe('catalog-2');
  });

  // Test that filteredData applies multiple column filters (AND logic)
  it('applies multiple column filters with AND logic', async () => {
    catalogStore.data = [
      {
        name: 'catalog-1',
        model: ['modelA'],
        description: 'Test',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
      },
      {
        name: 'catalog-2',
        model: ['modelA'],
        description: 'Test 2',
        realm: ['ocean'],
        frequency: ['1day'],
        variable: ['sst'],
      },
      {
        name: 'catalog-3',
        model: ['modelB'],
        description: 'Test 3',
        realm: ['atmos'],
        frequency: ['1day'],
        variable: ['pr'],
      },
    ];
    wrapper = createWrapper();

    // Filter on modelA AND 1day — only catalog-2 matches both
    wrapper.vm.currentFilters = { model: ['modelA'], frequency: ['1day'] };
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.filteredData.length).toBe(1);
    expect(wrapper.vm.filteredData[0].name).toBe('catalog-2');
  });

  // Test that filteredData combines global search and column filters
  it('combines global search and column filters', async () => {
    catalogStore.data = [
      {
        name: 'alpha-catalog',
        model: ['modelA'],
        description: 'Alpha entry',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
      },
      {
        name: 'beta-catalog',
        model: ['modelA'],
        description: 'Beta entry',
        realm: ['ocean'],
        frequency: ['1mon'],
        variable: ['sst'],
      },
      {
        name: 'gamma-catalog',
        model: ['modelB'],
        description: 'Gamma entry',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['pr'],
      },
    ];
    wrapper = createWrapper();

    // Global search narrows to 'alpha' and 'gamma' (both contain 'a' but let's use 'alpha')
    wrapper.vm.globalSearchValue = 'alpha';
    wrapper.vm.currentFilters = { realm: ['atmos'] };
    await wrapper.vm.$nextTick();

    // Only 'alpha-catalog' matches both filters
    expect(wrapper.vm.filteredData.length).toBe(1);
    expect(wrapper.vm.filteredData[0].name).toBe('alpha-catalog');
  });

  // Test that filteredData returns all data when both search and filters are cleared
  it('returns all data when currentFilters is cleared', async () => {
    catalogStore.data = [
      {
        name: 'catalog-1',
        model: ['modelA'],
        description: 'Test',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
      },
      {
        name: 'catalog-2',
        model: ['modelB'],
        description: 'Test 2',
        realm: ['ocean'],
        frequency: ['1day'],
        variable: ['sst'],
      },
    ];
    wrapper = createWrapper();

    wrapper.vm.currentFilters = { realm: ['atmos'] };
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredData.length).toBe(1);

    wrapper.vm.clearFilters();
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filteredData.length).toBe(2);
  });

  // Test that FilterSelectors is rendered when data is available
  it('renders FilterSelectors when data is available', () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [
      {
        name: 'catalog-1',
        model: ['modelA'],
        description: 'Test',
        realm: ['atmos'],
        frequency: ['1mon'],
        variable: ['tas'],
      },
    ];
    wrapper = createWrapper();

    expect(wrapper.findComponent({ name: 'FilterSelectors' }).exists()).toBe(true);
  });

  // Test that FilterSelectors is NOT rendered when data is empty
  it('does not render FilterSelectors when data is empty', () => {
    catalogStore.loading = false;
    catalogStore.error = null;
    catalogStore.data = [];
    wrapper = createWrapper();

    expect(wrapper.findComponent({ name: 'FilterSelectors' }).exists()).toBe(false);
  });

  // Test that FilterSelectors is NOT rendered during loading
  it('does not render FilterSelectors while loading', () => {
    catalogStore.loading = true;
    catalogStore.data = [];
    wrapper = createWrapper();

    expect(wrapper.findComponent({ name: 'FilterSelectors' }).exists()).toBe(false);
  });
});
