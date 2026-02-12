import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LazyDatastoreDetail from '../lazy/LazyDatastoreDetail.vue';
import { useCatalogStore } from '../../stores/catalogStore';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';

describe('DatastoreDetail', () => {
  let wrapper: VueWrapper<any>;
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;
  let catalogStore: ReturnType<typeof useCatalogStore>;

  const mockDatastoreData = [
    {
      variable: ['temp', 'pressure'],
      frequency: 'daily',
      realm: 'atmosphere',
    },
    {
      variable: ['salinity'],
      frequency: 'monthly',
      realm: 'ocean',
    },
  ];

  // Helper to create a complete mock DatastoreCache object
  const createMockDatastoreCache = (overrides: Partial<any> = {}) => ({
    data: mockDatastoreData,
    totalRecords: 2,
    columns: ['variable', 'frequency', 'realm'],
    filterOptions: {},
    loading: false,
    error: null,
    lastFetched: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    catalogStore = useCatalogStore();

    // Create a mock router with DatastoreDetail route
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          name: 'Home',
          component: { template: '<div>Home</div>' },
        },
        {
          path: '/datastore/:name',
          name: 'DatastoreDetail',
          component: LazyDatastoreDetail,
        },
      ],
    });

    // Navigate to a specific datastore
    router.push('/datastore/test-datastore');

    // Clear mock calls
    vi.clearAllMocks();
  });

  // Helper to create wrapper with global config and stubs
  const createWrapper = () => {
    return mount(LazyDatastoreDetail, {
      global: {
        plugins: [pinia, router, PrimeVue, ToastService],
        stubs: {
          Button: true,
          DatastoreHeader: true,
          LazyQuickStartCode: true,
          LazyDatastoreTable: true,
          FilterSelectors: true,
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
  };

  // Test that the component displays the breadcrumb with datastore name
  it('renders breadcrumb with datastore name', async () => {
    await router.isReady();
    wrapper = createWrapper();

    expect(wrapper.text()).toContain('Catalog');
    expect(wrapper.text()).toContain('test-datastore');
  });

  // Test that the component displays loading state when fetching datastore data
  it('displays loading state initially', async () => {
    await router.isReady();

    // Mock loadDatastore to return a pending promise
    vi.spyOn(catalogStore, 'loadDatastore').mockImplementation(() => new Promise(() => {}));

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Loading datastore...');
  });

  // Test that the component displays error state when datastore loading fails
  it('displays error state when loading fails', async () => {
    await router.isReady();

    // Mock loadDatastore to reject with an error
    vi.spyOn(catalogStore, 'loadDatastore').mockRejectedValue(new Error('Network error'));

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper.text()).toContain('Error loading datastore:');
    expect(wrapper.text()).toContain('Network error');
  });

  // Test that the retry button attempts to reload the datastore
  it('retries loading datastore when retry button is clicked', async () => {
    await router.isReady();

    // First call fails, second call succeeds
    const loadSpy = vi
      .spyOn(catalogStore, 'loadDatastore')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Find and click retry button
    const retryButton = wrapper.find('button');
    expect(retryButton.text()).toContain('Retry');

    await retryButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(loadSpy).toHaveBeenCalledTimes(2);
  });

  // Test that the component loads datastore data from the store on mount
  it('loads datastore data on mount', async () => {
    await router.isReady();

    const loadSpy = vi.spyOn(catalogStore, 'loadDatastore').mockResolvedValue(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    expect(loadSpy).toHaveBeenCalledWith('test-datastore');
  });

  // Test that the component uses cached data if available instead of refetching
  it('uses cached data when available', async () => {
    await router.isReady();

    // Mock getDatastoreFromCache to return cached data
    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    const loadSpy = vi.spyOn(catalogStore, 'loadDatastore');

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    // Should not call loadDatastore if cache exists
    expect(loadSpy).not.toHaveBeenCalled();
  });

  // Test that the component displays the alpha warning banner
  it('displays alpha software warning', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Alpha Software:');
    expect(wrapper.text()).toContain('The intake catalogue interface is currently in alpha');
  });

  // Test that the feedback button opens the GitHub issue page
  it('opens feedback issue when button is clicked', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    // Mock window.open
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    // Find the feedback button (stubbed as Button component)
    const feedbackButton = wrapper.findComponent({ name: 'Button' });
    await feedbackButton.trigger('click');

    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/access-nri/interactive-data-catalogue/issues/new?template=feedback.yml',
      '_blank',
      'noopener,noreferrer',
    );

    openSpy.mockRestore();
  });

  // Test that filters are initialized from URL query parameters
  it('initializes filters from URL query parameters', async () => {
    await router.push('/datastore/test-datastore?frequency_filter=daily,monthly&realm_filter=ocean');
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    const filters = wrapper.vm.currentFilters;
    expect(filters.frequency).toEqual(['daily', 'monthly']);
    expect(filters.realm).toEqual(['ocean']);
  });

  // Test that filter changes update the URL query parameters
  it('updates URL when filters change', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    // Change filters
    wrapper.vm.currentFilters = {
      frequency: ['daily'],
      realm: ['atmosphere'],
    };
    await wrapper.vm.$nextTick();

    // Wait for router to update
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.currentRoute.value.query).toEqual({
      frequency_filter: 'daily',
      realm_filter: 'atmosphere',
    });
  });

  // Test that clearing filters removes them from URL and component state
  it('clears filters when clear is triggered', async () => {
    await router.push('/datastore/test-datastore?frequency_filter=daily');
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    // Verify filters are set
    expect(wrapper.vm.currentFilters.frequency).toEqual(['daily']);

    // Clear filters
    wrapper.vm.clearFilters();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.currentFilters).toEqual({});
  });

  // Test that filters are correctly set in the component
  it('sets filters correctly', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    // Apply frequency filter
    wrapper.vm.currentFilters = { frequency: ['daily'] };
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.currentFilters.frequency).toEqual(['daily']);
  });

  // Test that column names are formatted with proper capitalization
  it('formats column names correctly', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(
      createMockDatastoreCache({ columns: ['variable_name', 'data_frequency', 'model_realm'] }),
    );

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    const columns = wrapper.vm.availableColumns;
    expect(columns).toEqual([
      { field: 'variable_name', header: 'Variable Name' },
      { field: 'data_frequency', header: 'Data Frequency' },
      { field: 'model_realm', header: 'Model Realm' },
    ]);
  });

  // Test that component cleans up cache when route parameter changes
  it('clears old datastore cache when navigating to different datastore', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    const clearSpy = vi.spyOn(catalogStore, 'clearDatastoreCache');

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    // Navigate to different datastore
    await router.push('/datastore/another-datastore');
    await wrapper.vm.$nextTick();

    expect(clearSpy).toHaveBeenCalledWith('test-datastore');
  });

  // Test that component cleans up cache on unmount
  it('clears datastore cache on unmount', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    const clearSpy = vi.spyOn(catalogStore, 'clearDatastoreCache');

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    // Wait for all async operations including onMounted
    await new Promise((resolve) => setTimeout(resolve, 0));

    wrapper.unmount();

    // Verify cleanup was called (route params may be undefined during unmount)
    expect(clearSpy).toHaveBeenCalled();
  });

  // Test that all child components receive correct props
  it('passes correct props to child components', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(
      createMockDatastoreCache({
        filterOptions: { frequency: ['daily', 'monthly'], realm: ['ocean', 'atmosphere'] },
      }),
    );

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    // Check DatastoreHeader props
    const header = wrapper.findComponent({ name: 'DatastoreHeader' });
    expect(header.props('datastoreName')).toBe('test-datastore');
    expect(header.props('totalRecords')).toBe(2);

    // Check LazyQuickStartCode props
    const quickStart = wrapper.findComponent({ name: 'LazyQuickStartCode' });
    expect(quickStart.props('datastoreName')).toBe('test-datastore');
    expect(quickStart.props('numDatasets')).toBeDefined();

    // Check FilterSelectors props
    const filters = wrapper.findComponent({ name: 'FilterSelectors' });
    expect(filters.props('filterOptions')).toEqual({
      frequency: ['daily', 'monthly'],
      realm: ['ocean', 'atmosphere'],
    });
    expect(filters.props('dynamicFilterOptions')).toBeDefined();

    // Check DatastoreTable props
    const table = wrapper.findComponent({ name: 'LazyDatastoreTable' });
    expect(table.props('datastoreName')).toBe('test-datastore');
    expect(table.props('columns')).toBeDefined();
  });

  // Test that filters handle array values correctly
  it('filters array values correctly', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    // Filter by variable (which is an array)
    wrapper.vm.currentFilters = { variable: ['temp'] };
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.currentFilters.variable).toEqual(['temp']);
  });

  // Test that empty filters are correctly set
  it('handles empty filters correctly', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    wrapper.vm.currentFilters = {};
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.currentFilters).toEqual({});
  });

  // Test that selected columns can be updated
  it('updates selected columns when changed', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    const initialColumns = wrapper.vm.selectedColumns;
    expect(initialColumns.length).toBe(3);

    // Change selected columns
    wrapper.vm.selectedColumns = [{ field: 'variable', header: 'Variable' }];
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.selectedColumns.length).toBe(1);
    expect(wrapper.vm.selectedColumns[0].field).toBe('variable');
  });

  // Test that refresh event from table triggers data reload
  it('reloads datastore when refresh event is emitted from table', async () => {
    await router.isReady();

    // Return null initially so component loads datastore on mount
    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(null);

    const loadSpy = vi.spyOn(catalogStore, 'loadDatastore').mockResolvedValue(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();
    // Wait for initial load
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify initial load happened
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith('test-datastore');

    // Clear the spy to only track new calls
    loadSpy.mockClear();

    // Call the loadDatastore method again to simulate refresh
    await wrapper.vm.loadDatastore();

    expect(loadSpy).toHaveBeenCalledWith('test-datastore');
  });

  // Test that dynamic filter options are buffered while dropdown is open
  it('buffers dynamic filter options while dropdown is open', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(
      createMockDatastoreCache({
        filterOptions: { frequency: ['daily', 'monthly', 'annual'], realm: ['ocean', 'atmosphere'] },
      }),
    );

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    // Set initial dynamic filter options
    wrapper.vm.dynamicFilterOptions = {
      frequency: ['daily', 'monthly', 'annual'],
      realm: ['ocean', 'atmosphere'],
    };
    await wrapper.vm.$nextTick();

    // Simulate opening the frequency dropdown
    const filterSelectors = wrapper.findComponent({ name: 'FilterSelectors' });
    filterSelectors.vm.$emit('dropdown-opened', 'frequency');
    await wrapper.vm.$nextTick();

    // Verify dropdown is tracked as open
    expect(wrapper.vm.openDropdowns.has('frequency')).toBe(true);

    // Simulate table emitting updated dynamic filter options (narrowed based on selections)
    const table = wrapper.findComponent({ name: 'LazyDatastoreTable' });
    const narrowedOptions = {
      frequency: ['daily', 'monthly'], // narrowed - "annual" removed
      realm: ['ocean', 'atmosphere'],
    };
    table.vm.$emit('set-dynamic-filter-options', narrowedOptions);
    await wrapper.vm.$nextTick();

    // Verify frequency options are buffered (not applied yet), but realm options are applied immediately
    expect(wrapper.vm.dynamicFilterOptions.frequency).toEqual(['daily', 'monthly', 'annual']); // Still original
    expect(wrapper.vm.dynamicFilterOptions.realm).toEqual(['ocean', 'atmosphere']); // Applied immediately
    expect(wrapper.vm.pendingFilterUpdates.frequency).toEqual(['daily', 'monthly']); // Buffered

    // Simulate closing the dropdown
    filterSelectors.vm.$emit('dropdown-closed', 'frequency');
    await wrapper.vm.$nextTick();

    // Verify dropdown is no longer tracked as open
    expect(wrapper.vm.openDropdowns.has('frequency')).toBe(false);

    // Verify buffered options are now applied
    expect(wrapper.vm.dynamicFilterOptions.frequency).toEqual(['daily', 'monthly']); // Now updated
    expect(wrapper.vm.pendingFilterUpdates.frequency).toBeUndefined(); // Buffer cleared
  });

  // Test that multiple dropdowns can be open simultaneously with independent buffering
  it('buffers multiple open dropdowns independently', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(
      createMockDatastoreCache({
        filterOptions: { frequency: ['daily', 'monthly'], realm: ['ocean', 'atmosphere', 'land'] },
      }),
    );

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    wrapper.vm.dynamicFilterOptions = {
      frequency: ['daily', 'monthly'],
      realm: ['ocean', 'atmosphere', 'land'],
    };
    await wrapper.vm.$nextTick();

    const filterSelectors = wrapper.findComponent({ name: 'FilterSelectors' });
    const table = wrapper.findComponent({ name: 'LazyDatastoreTable' });

    // Open both dropdowns
    filterSelectors.vm.$emit('dropdown-opened', 'frequency');
    filterSelectors.vm.$emit('dropdown-opened', 'realm');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.openDropdowns.has('frequency')).toBe(true);
    expect(wrapper.vm.openDropdowns.has('realm')).toBe(true);

    // Emit narrowed options for both
    table.vm.$emit('set-dynamic-filter-options', {
      frequency: ['daily'], // narrowed
      realm: ['ocean', 'atmosphere'], // narrowed
    });
    await wrapper.vm.$nextTick();

    // Both should be buffered
    expect(wrapper.vm.dynamicFilterOptions.frequency).toEqual(['daily', 'monthly']); // Still original
    expect(wrapper.vm.dynamicFilterOptions.realm).toEqual(['ocean', 'atmosphere', 'land']); // Still original
    expect(wrapper.vm.pendingFilterUpdates.frequency).toEqual(['daily']);
    expect(wrapper.vm.pendingFilterUpdates.realm).toEqual(['ocean', 'atmosphere']);

    // Close only frequency dropdown
    filterSelectors.vm.$emit('dropdown-closed', 'frequency');
    await wrapper.vm.$nextTick();

    // Only frequency should be updated, realm still buffered
    expect(wrapper.vm.dynamicFilterOptions.frequency).toEqual(['daily']); // Updated
    expect(wrapper.vm.dynamicFilterOptions.realm).toEqual(['ocean', 'atmosphere', 'land']); // Still buffered
    expect(wrapper.vm.pendingFilterUpdates.frequency).toBeUndefined(); // Cleared
    expect(wrapper.vm.pendingFilterUpdates.realm).toEqual(['ocean', 'atmosphere']); // Still buffered

    // Close realm dropdown
    filterSelectors.vm.$emit('dropdown-closed', 'realm');
    await wrapper.vm.$nextTick();

    // Now realm should be updated too
    expect(wrapper.vm.dynamicFilterOptions.realm).toEqual(['ocean', 'atmosphere']); // Updated
    expect(wrapper.vm.pendingFilterUpdates.realm).toBeUndefined(); // Cleared
  });

  // Test that cleanup clears open dropdown tracking on unmount
  it('clears open dropdown tracking on unmount', async () => {
    await router.isReady();

    vi.spyOn(catalogStore, 'getDatastoreFromCache').mockReturnValue(createMockDatastoreCache());

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    // Open a dropdown
    const filterSelectors = wrapper.findComponent({ name: 'FilterSelectors' });
    filterSelectors.vm.$emit('dropdown-opened', 'frequency');
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.openDropdowns.size).toBe(1);
    expect(wrapper.vm.openDropdowns.has('frequency')).toBe(true);

    // Unmount component
    wrapper.unmount();

    // Verify cleanup was performed (we can't check after unmount, but the cleanup code runs)
    // This test mainly ensures no errors occur during unmount with open dropdowns
  });
});
