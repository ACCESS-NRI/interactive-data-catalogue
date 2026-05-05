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

  describe('confirmCopyLongUrl', () => {
    it('writes to clipboard and hides the dialog on success', async () => {
      const { composable, wrapper } = mountWithSource('builtin');
      await wrapper.vm.$nextTick();

      const url = 'https://example.com/very-long-url';
      await composable.current!.confirmCopyLongUrl(url);

      expect(clipboardSpy).toHaveBeenCalledWith(url);
      expect(composable.current!.showLongUrlDialog.value).toBe(false);
    });

    it('logs error when clipboard write fails in confirmCopyLongUrl', async () => {
      clipboardSpy.mockRejectedValueOnce(new Error('clipboard denied'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { composable, wrapper } = mountWithSource('builtin');
      await wrapper.vm.$nextTick();

      await composable.current!.confirmCopyLongUrl('https://example.com/url');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy long link:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('copyCodeToClipboard', () => {
    it('logs error when clipboard write fails', async () => {
      clipboardSpy.mockRejectedValueOnce(new Error('clipboard denied'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { composable, wrapper } = mountWithSource('builtin');
      await wrapper.vm.$nextTick();

      await composable.current!.copyCodeToClipboard();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('copySearchLink', () => {
    it('logs error when clipboard write fails', async () => {
      clipboardSpy.mockRejectedValueOnce(new Error('clipboard denied'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await router.push('/datastore/test-ds');
      await router.isReady();

      const { composable, wrapper } = mountWithSource('builtin');
      await wrapper.vm.$nextTick();

      await composable.current!.copySearchLink();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('shows long URL dialog when URL exceeds limit', async () => {
      // Use a very long filter value to push the URL over 2083 chars
      const longFilter = 'a'.repeat(2100);
      const pinia = createPinia();
      setActivePinia(pinia);
      const composableRef: { current: ReturnType<typeof useQuickStartCode> | null } = { current: null };

      const TestComponent = defineComponent({
        setup() {
          composableRef.current = useQuickStartCode(
            ref('test-ds'),
            ref({ variable: [longFilter] }),
            ref({ variable: [longFilter] }),
            ref(5),
            ref('builtin'),
          );
          return () => h('div');
        },
      });

      await router.push('/datastore/test-ds');
      await router.isReady();
      mount(TestComponent, { global: { plugins: [pinia, router] } });
      await composableRef.current!.copySearchLink();

      expect(composableRef.current!.showLongUrlDialog.value).toBe(true);
    });
  });

  describe('copyCodeAndOpenARESession', () => {
    it('logs error when clipboard write fails in ARE session copy', async () => {
      clipboardSpy.mockRejectedValueOnce(new Error('clipboard denied'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(window, 'open').mockReturnValue(null);

      const { composable, wrapper } = mountWithSource('builtin');
      await wrapper.vm.$nextTick();

      await composable.current!.copyCodeAndOpenARESession();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('cancelCopyLongUrl', () => {
    it('resets the long URL dialog state', async () => {
      const { composable, wrapper } = mountWithSource('builtin');
      await wrapper.vm.$nextTick();

      composable.current!.pendingLongUrl.value = 'https://example.com/long';
      composable.current!.showLongUrlDialog.value = true;

      composable.current!.cancelCopyLongUrl();

      expect(composable.current!.showLongUrlDialog.value).toBe(false);
      expect(composable.current!.pendingLongUrl.value).toBe('');
    });
  });
});
