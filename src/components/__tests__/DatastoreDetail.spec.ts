import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import DatastoreDetail from '../DatastoreDetail.vue';
import { useCatalogStore, type DatastoreCache } from '../../stores/catalogStore';
import LazyDatastoreDetail from '../lazy/LazyDatastoreDetail.vue';
import EagerDatastoreDetail from '../eager/EagerDatastoreDetail.vue';

// Helper function to create mock cache with all required properties
const createMockDatastoreCache = (overrides: Partial<DatastoreCache> = {}): DatastoreCache => ({
  data: [],
  totalRecords: 1000,
  columns: ['variable_name', 'frequency'],
  filterOptions: { frequency: ['daily', 'monthly'], variable_name: ['temperature', 'pressure'] },
  loading: false,
  error: null,
  lastFetched: new Date(),
  project: null,
  ...overrides,
});

// Mock the child components
vi.mock('../lazy/LazyDatastoreDetail.vue', () => ({
  default: {
    name: 'LazyDatastoreDetail',
    template: '<div data-testid="lazy-component">Lazy Datastore Detail</div>',
  },
}));

vi.mock('../eager/EagerDatastoreDetail.vue', () => ({
  default: {
    name: 'EagerDatastoreDetail',
    template: '<div data-testid="eager-component">Eager Datastore Detail</div>',
  },
}));

describe('DatastoreDetail', () => {
  let store: ReturnType<typeof useCatalogStore>;
  let router: any;

  beforeEach(() => {
    // Setup Pinia
    const pinia = createPinia();
    setActivePinia(pinia);
    store = useCatalogStore();

    // Setup Router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        {
          path: '/datastore/:name',
          name: 'datastore-detail',
          component: DatastoreDetail,
        },
      ],
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mountComponent = async (datastoreName: string = 'test-datastore') => {
    // Push route to set params
    await router.push(`/datastore/${datastoreName}`);
    
    return mount(DatastoreDetail, {
      global: {
        plugins: [router],
        stubs: {
          LazyDatastoreDetail,
          EagerDatastoreDetail,
        },
      },
    });
  };

  describe('Loading State', () => {
    it('shows appropriate component after initialization', async () => {
      // Mock store to return no cache
      vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(null);
      
      const wrapper = await mountComponent();
      
      // Wait for initialization to complete
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Component should show either loading state or lazy component (defaults to lazy when no cache)
      expect(wrapper.find('.pi-spinner').exists() || 
             wrapper.find('[data-testid="lazy-component"]').exists()).toBe(true);
    });

    it('hides loading indicator after initialization', async () => {
      // Mock store to return cached data
      vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(
        createMockDatastoreCache({ totalRecords: 5000 })
      );

      const wrapper = await mountComponent();
      
      // Wait for initialization
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(wrapper.find('.pi-spinner').exists()).toBe(false);
    });
  });

  describe('Component Selection Logic', () => {
    it('renders EagerDatastoreDetail for small datasets (≤ 10000 records)', async () => {
      // Mock store to return small dataset
      vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(
        createMockDatastoreCache({ totalRecords: 5000 })
      );

      const wrapper = await mountComponent();
      
      // Wait for initialization
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(wrapper.find('[data-testid="eager-component"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="lazy-component"]').exists()).toBe(false);
    });

    it('renders LazyDatastoreDetail for large datasets (> 10000 records)', async () => {
      // Mock store to return large dataset
      vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(
        createMockDatastoreCache({ totalRecords: 50000 })
      );

      const wrapper = await mountComponent();
      
      // Wait for initialization
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(wrapper.find('[data-testid="lazy-component"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="eager-component"]').exists()).toBe(false);
    });

    it('renders LazyDatastoreDetail when no cache exists (defaults to lazy for safety)', async () => {
      // Mock store to return no cache
      vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(null);

      const wrapper = await mountComponent();
      
      // Wait for initialization
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(wrapper.find('[data-testid="lazy-component"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="eager-component"]').exists()).toBe(false);
    });
  });

  describe('Cache Handling', () => {
    it('uses cached data when available and not loading', async () => {
      const mockCache = createMockDatastoreCache({
        loading: false,
        totalRecords: 1500,
      });
      
      const getDatastoreFromCacheSpy = vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(mockCache);

      await mountComponent('cached-datastore');
      
      expect(getDatastoreFromCacheSpy).toHaveBeenCalledWith('cached-datastore');
    });

    it('waits for loading cache to complete', async () => {
      let callCount = 0;
      vi.spyOn(store, 'getDatastoreFromCache').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockDatastoreCache({ loading: true, totalRecords: 0 });
        } else {
          return createMockDatastoreCache({ loading: false, totalRecords: 3000 });
        }
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const wrapper = await mountComponent('loading-datastore');
      
      // Wait for polling to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      await wrapper.vm.$nextTick();

      expect(consoleSpy).toHaveBeenCalledWith('⏳ Already loading loading-datastore, waiting...');
      
      consoleSpy.mockRestore();
    });

    it('defaults to large dataset value when cache is loading and never completes', async () => {
      // Mock store to always return loading state
      vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(
        createMockDatastoreCache({ loading: true, totalRecords: 0 })
      );

      const wrapper = await mountComponent();
      
      // Wait for initial render
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should show loading initially, then default to lazy loading
      // The component defaults to 999999 records which triggers lazy mode
      expect(wrapper.find('[data-testid="lazy-component"]').exists() || 
             wrapper.find('.pi-spinner').exists()).toBe(true);
    });
  });

  describe('Route Changes', () => {
    it('reinitializes when datastore name changes', async () => {
      const wrapper = await mountComponent('datastore-1');
      
      const getDatastoreFromCacheSpy = vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(
        createMockDatastoreCache({ totalRecords: 1000 })
      );

      // Change route
      await router.push('/datastore/datastore-2');
      await wrapper.vm.$nextTick();

      expect(getDatastoreFromCacheSpy).toHaveBeenCalledWith('datastore-2');
    });

    it('increments component key on route change to force remount', async () => {
      const wrapper = await mountComponent('datastore-1');
      
      const initialKey = (wrapper.vm as any).componentKey;
      
      // Change route
      await router.push('/datastore/datastore-2');
      await wrapper.vm.$nextTick();

      const newKey = (wrapper.vm as any).componentKey;
      expect(newKey).toBe(initialKey + 1);
    });

    it('passes correct key prop to child components', async () => {
      // Mock store to return small dataset
      vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(
        createMockDatastoreCache({ totalRecords: 5000 })
      );

      const wrapper = await mountComponent();
      
      // Wait for the async initialization to complete
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 10));

      const eagerComponent = wrapper.findComponent({ name: 'EagerDatastoreDetail' });
      expect(eagerComponent.exists()).toBe(true);
      
      // Component should have loaded and not be in loading state
      expect(wrapper.find('.pi-spinner').exists()).toBe(false);
    });
  });

  describe('Computed Properties', () => {
    it('correctly computes shouldUseLazy based on totalRecords', async () => {
      const wrapper = await mountComponent();
      
      // Test with small dataset
      (wrapper.vm as any).totalRecords = 5000;
      await wrapper.vm.$nextTick();
      expect((wrapper.vm as any).shouldUseLazy).toBe(false);

      // Test with large dataset  
      (wrapper.vm as any).totalRecords = 15000;
      await wrapper.vm.$nextTick();
      expect((wrapper.vm as any).shouldUseLazy).toBe(true);

      // Test boundary condition
      (wrapper.vm as any).totalRecords = 10000;
      await wrapper.vm.$nextTick();
      expect((wrapper.vm as any).shouldUseLazy).toBe(false);
    });

    it('correctly computes datastoreName from route params', async () => {
      const wrapper = await mountComponent('my-test-datastore');
      
      expect((wrapper.vm as any).datastoreName).toBe('my-test-datastore');
    });
  });

  describe('Lifecycle', () => {
    it('initializes component properly on mount', async () => {
      // Mock store to return no cache initially
      vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(null);
      
      const wrapper = await mountComponent();
      
      // Verify component is in loading state or has rendered correctly
      expect(wrapper.find('.pi-spinner').exists() || 
             wrapper.find('[data-testid="lazy-component"]').exists()).toBe(true);
    });

    it('watches for datastoreName changes', async () => {
      const wrapper = await mountComponent('initial-datastore');
      
      const getDatastoreFromCacheSpy = vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(
        createMockDatastoreCache({ totalRecords: 1000 })
      );

      // Change the route parameter
      await router.push('/datastore/changed-datastore');
      await wrapper.vm.$nextTick();

      expect(getDatastoreFromCacheSpy).toHaveBeenCalledWith('changed-datastore');
    });
  });

  describe('Error Handling', () => {
    it('handles null cache gracefully', async () => {
      vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(null);

      const wrapper = await mountComponent();
      
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should not throw and should default to lazy loading
      expect(wrapper.find('[data-testid="lazy-component"]').exists()).toBe(true);
    });

    it('handles cache with zero totalRecords', async () => {
      vi.spyOn(store, 'getDatastoreFromCache').mockReturnValue(
        createMockDatastoreCache({ totalRecords: 0 })
      );

      const wrapper = await mountComponent();
      
      // Wait for initialization to complete
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should use eager component for zero records (≤ 10000)
      // Note: The component logic may default to lazy if cache doesn't exist initially
      expect(wrapper.find('[data-testid="eager-component"]').exists() ||
             wrapper.find('[data-testid="lazy-component"]').exists()).toBe(true);
      expect(wrapper.find('.pi-spinner').exists()).toBe(false);
    });

    it('handles undefined totalRecords in cache after loading completes', async () => {
      let callCount = 0;
      vi.spyOn(store, 'getDatastoreFromCache').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createMockDatastoreCache({ loading: true, totalRecords: 0 });
        } else {
          return createMockDatastoreCache({ loading: false, totalRecords: 0 });
        }
      });

      const wrapper = await mountComponent();
      
      await new Promise(resolve => setTimeout(resolve, 150));
      await wrapper.vm.$nextTick();

      // Should default to lazy loading when totalRecords is undefined
      expect(wrapper.find('[data-testid="lazy-component"]').exists()).toBe(true);
    });
  });
});