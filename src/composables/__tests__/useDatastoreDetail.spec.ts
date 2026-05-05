import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { useDatastoreDetail } from '../useDatastoreDetail';
import { useCatalogStore, PERSONAL_DATASTORE_CACHE_KEY } from '../../stores/catalogStore';

vi.mock('../usePosthog', () => ({ capture: vi.fn() }));

const makeRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Home', component: { template: '<div />' } },
      {
        path: '/personal-datastore/:name',
        name: 'PersonalDatastoreDetail',
        component: { template: '<div />' },
      },
    ],
  });

const makeCache = (overrides = {}) => ({
  data: [{ variable: ['tas'] }],
  totalRecords: 1,
  columns: ['variable'],
  filterOptions: {},
  loading: false,
  error: null,
  project: null,
  lastFetched: new Date(),
  ...overrides,
});

describe('useDatastoreDetail', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;
  let store: ReturnType<typeof useCatalogStore>;
  let wrapper: VueWrapper<any> | null = null;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = makeRouter();
    store = useCatalogStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  const mountWithOptions = async (
    options: Partial<Parameters<typeof useDatastoreDetail>[0]> & { routePath?: string } = {},
  ) => {
    const { routePath = '/personal-datastore/my-ds', ...composableOptions } = options;

    await router.push(routePath);
    await router.isReady();

    const TestComponent = defineComponent({
      setup() {
        const result = useDatastoreDetail({
          loadingStrategy: 'eager',
          isCacheReady: (cache) => cache.data.length > 0,
          initializeFiltersFromUrl: vi.fn(),
          stopFilterWatcher: vi.fn(),
          ...composableOptions,
        });
        return () => h('div', result.datastoreName.value);
      },
    });

    return mount(TestComponent, { global: { plugins: [pinia, router] } });
  };

  describe('skipRouteWatch option', () => {
    it('does not throw when skipRouteWatch is true and the component unmounts', async () => {
      store.datastoreCache[PERSONAL_DATASTORE_CACHE_KEY] = makeCache();

      wrapper = await mountWithOptions({
        nameOverride: 'my-ds',
        cacheKeyOverride: PERSONAL_DATASTORE_CACHE_KEY,
        persistCacheOnUnmount: true,
        skipRouteWatch: true,
      });

      // Unmounting calls stopRouteWatcher() — which is the noop () => {}
      expect(() => wrapper!.unmount()).not.toThrow();
      wrapper = null;
    });

    it('does not reload when the route param changes with skipRouteWatch true', async () => {
      store.datastoreCache[PERSONAL_DATASTORE_CACHE_KEY] = makeCache();

      wrapper = await mountWithOptions({
        nameOverride: 'my-ds',
        cacheKeyOverride: PERSONAL_DATASTORE_CACHE_KEY,
        persistCacheOnUnmount: true,
        skipRouteWatch: true,
      });

      const loadSpy = vi.spyOn(store, 'loadDatastore');

      // Navigating to a different name should NOT trigger a reload
      await router.push('/personal-datastore/other-ds');
      await wrapper.vm.$nextTick();

      expect(loadSpy).not.toHaveBeenCalled();
    });
  });

  describe('persistCacheOnUnmount option', () => {
    it('clears the cache on unmount when persistCacheOnUnmount is false', async () => {
      const cacheName = 'test-datastore';
      store.datastoreCache[cacheName] = makeCache();

      wrapper = await mountWithOptions({
        nameOverride: cacheName,
        persistCacheOnUnmount: false,
        skipRouteWatch: true,
        routePath: '/',
      });

      wrapper.unmount();
      wrapper = null;

      expect(store.getDatastoreFromCache(cacheName)).toBeNull();
    });

    it('preserves the cache on unmount when persistCacheOnUnmount is true', async () => {
      store.datastoreCache[PERSONAL_DATASTORE_CACHE_KEY] = makeCache();

      wrapper = await mountWithOptions({
        nameOverride: 'my-ds',
        cacheKeyOverride: PERSONAL_DATASTORE_CACHE_KEY,
        persistCacheOnUnmount: true,
        skipRouteWatch: true,
      });

      wrapper.unmount();
      wrapper = null;

      expect(store.getDatastoreFromCache(PERSONAL_DATASTORE_CACHE_KEY)).not.toBeNull();
    });
  });

  describe('onCacheMissing option', () => {
    it('calls onCacheMissing when cacheKeyOverride is set but no cache entry exists', async () => {
      const onCacheMissing = vi.fn();

      wrapper = await mountWithOptions({
        nameOverride: 'my-ds',
        cacheKeyOverride: PERSONAL_DATASTORE_CACHE_KEY,
        persistCacheOnUnmount: true,
        skipRouteWatch: true,
        onCacheMissing,
      });

      await wrapper.vm.$nextTick();

      expect(onCacheMissing).toHaveBeenCalled();
    });

    it('does not call onCacheMissing when the cache is already populated', async () => {
      store.datastoreCache[PERSONAL_DATASTORE_CACHE_KEY] = makeCache();
      const onCacheMissing = vi.fn();

      wrapper = await mountWithOptions({
        nameOverride: 'my-ds',
        cacheKeyOverride: PERSONAL_DATASTORE_CACHE_KEY,
        persistCacheOnUnmount: true,
        skipRouteWatch: true,
        onCacheMissing,
      });

      await wrapper.vm.$nextTick();

      expect(onCacheMissing).not.toHaveBeenCalled();
    });
  });
});
