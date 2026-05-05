import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { useQuickStartCode } from '../useQuickStartCode';

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() }),
}));

vi.mock('../usePosthog', () => ({ capture: vi.fn() }));

const makeRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Home', component: { template: '<div />' } },
      { path: '/datastore/:name', name: 'DatastoreDetail', component: { template: '<div />' } },
      { path: '/personal-datastore', name: 'PersonalDatastore', component: { template: '<div />' } },
    ],
  });

describe('useQuickStartCode', () => {
  let router: ReturnType<typeof makeRouter>;
  let clipboardSpy: MockInstance<(data: string) => Promise<void>>;

  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    router = makeRouter();
    clipboardSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  const mountWithSource = (source: 'builtin' | 'personal') => {
    const composableRef: { current: ReturnType<typeof useQuickStartCode> | null } = { current: null };

    const TestComponent = defineComponent({
      setup() {
        composableRef.current = useQuickStartCode(
          ref('test-ds'),
          ref({ variable: ['tas'] }),
          ref({ variable: ['tas', 'pr'] }),
          ref(5),
          ref(source),
        );
        return () => h('div');
      },
    });

    const wrapper = mount(TestComponent, {
      global: { plugins: [createPinia(), router] },
    });

    return { wrapper, composable: composableRef };
  };

  describe('copySearchLink', () => {
    it('resolves to the PersonalDatastore route when source is personal', async () => {
      await router.push('/personal-datastore');
      await router.isReady();

      const { composable, wrapper } = mountWithSource('personal');
      await wrapper.vm.$nextTick();

      await composable.current!.copySearchLink();

      expect(clipboardSpy).toHaveBeenCalledOnce();
      const writtenUrl: string = clipboardSpy.mock.calls[0]![0] as string;
      expect(writtenUrl).toContain('/personal-datastore');
    });

    it('resolves to the DatastoreDetail route when source is builtin', async () => {
      await router.push('/datastore/test-ds');
      await router.isReady();

      const { composable, wrapper } = mountWithSource('builtin');
      await wrapper.vm.$nextTick();

      await composable.current!.copySearchLink();

      expect(clipboardSpy).toHaveBeenCalledOnce();
      const writtenUrl: string = clipboardSpy.mock.calls[0]![0] as string;
      expect(writtenUrl).toContain('/datastore/test-ds');
    });
  });
});
