import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import PersonalDatastore from '../PersonalDatastore.vue';
import { useCatalogStore } from '../../stores/catalogStore';

describe('PersonalDatastore', () => {
  let wrapper: VueWrapper<any>;
  let router: ReturnType<typeof createRouter>;
  let store: ReturnType<typeof useCatalogStore>;
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    store = useCatalogStore();
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'Home', component: { template: '<div>Home</div>' } },
        { path: '/personal-datastore', name: 'PersonalDatastore', component: PersonalDatastore },
      ],
    });
    await router.push('/personal-datastore');
    await router.isReady();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
  });

  const createWrapper = () =>
    mount(PersonalDatastore, {
      global: {
        plugins: [pinia, router, PrimeVue],
        stubs: {
          Button: true,
          EagerDatastoreDetail: true,
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

  it('shows upload state when no personal datastore is loaded', () => {
    wrapper = createWrapper();

    expect(wrapper.text()).toContain('Explore my personal datastore');
    expect(wrapper.find('input[type="file"]').exists()).toBe(true);
  });

  it('renders eager detail state after a personal datastore is registered', async () => {
    store.registerPersonalDatastoreRows(
      [{ variable: 'tas', file_id: 'dataset-a' }],
      ['variable', 'file_id'],
      'mine.csv',
    );

    wrapper = createWrapper();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Personal datastore:');
    expect(wrapper.text()).toContain('mine.csv');
    const detail = wrapper.findComponent({ name: 'EagerDatastoreDetail' });
    expect(detail.exists()).toBe(true);
    expect(detail.props('datastoreName')).toBe('mine');
    expect(detail.props('source')).toBe('personal');
  });

  it('clears the personal datastore from detail state', async () => {
    store.registerPersonalDatastoreRows([{ variable: 'tas' }], ['variable'], 'mine.csv');
    wrapper = createWrapper();

    wrapper.vm.clearPersonalDatastore();
    await wrapper.vm.$nextTick();

    expect(store.personalDatastore).toBeNull();
    expect(wrapper.text()).toContain('Explore my personal datastore');
  });
});
