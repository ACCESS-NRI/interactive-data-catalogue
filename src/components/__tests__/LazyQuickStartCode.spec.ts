import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LazyQuickStartCode from '../lazy/LazyQuickStartCode.vue';
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

describe('LazyQuickStartCode', () => {
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

  // Passes numDatasets directly as a prop (no rawData translation needed).
  const createWrapper = ({ numDatasets = 1, dynamicFilterOptions = {}, ...rest }: any) => {
    return mount(LazyQuickStartCode, {
      props: { dynamicFilterOptions, numDatasets, ...rest },
      global: {
        plugins: [pinia, router, PrimeVue, ToastService] as any[],
        stubs: {
          Toast: true,
          Button: true,
          ToggleSwitch: true,
          highlightjs: { template: '<pre><code>{{ code }}</code></pre>', props: ['code', 'language'] },
        },
      },
    });
  };

  // Shared tests — cover all composable logic via the Lazy component.
  runQuickStartCodeSharedTests(createWrapper, writeTextMock);
});

