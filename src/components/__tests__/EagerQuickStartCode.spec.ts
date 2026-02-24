import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import EagerQuickStartCode from '../eager/EagerQuickStartCode.vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { runQuickStartCodeSharedTests } from './shared/quickStartCodeSharedTests';

// Mock useToast
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn(),
  }),
}));

// Mock clipboard API
const writeTextMock = vi.fn(() => Promise.resolve());
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: writeTextMock },
  writable: true,
});

describe('EagerQuickStartCode', () => {
  let wrapper: VueWrapper<any>;
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/datastore/:name', name: 'DatastoreDetail', component: { template: '<div>Mock</div>' } }],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
  });

  const globalConfig = () => ({
    plugins: [pinia, router, PrimeVue, ToastService] as any[],
    stubs: {
      Toast: true,
      Button: true,
      ToggleSwitch: true,
      highlightjs: { template: '<pre><code>{{ code }}</code></pre>', props: ['code', 'language'] },
    },
  });

  // Translates normalised numDatasets → rawData for the Eager component's prop interface.
  const createWrapper = ({ numDatasets = 0, dynamicFilterOptions = {}, ...rest }: any) => {
    const rawData = Array.from({ length: numDatasets }, (_, i) => ({ file_id: `dataset${i + 1}` }));
    return mount(EagerQuickStartCode, {
      props: { dynamicFilterOptions, rawData, ...rest },
      global: globalConfig(),
    });
  };

  // Shared tests — cover all composable logic via the Eager component.
  runQuickStartCodeSharedTests(createWrapper, writeTextMock);

  it('handles rawData without file_id (rows are not counted as datasets)', () => {
    wrapper = mount(EagerQuickStartCode, {
      props: {
        datastoreName: 'test-datastore',
        currentFilters: {},
        rawData: [{ path: '/g/data/xp65/file1.nc' }, { path: '/g/data/xp65/file2.nc' }],
        dynamicFilterOptions: {},
      },
      global: globalConfig(),
    });
    // Rows without file_id should not contribute to numDatasets
    expect(wrapper.text()).toContain('Quick Start');
    expect(wrapper.text()).not.toContain('to_dataset_dict()');
  });
});
