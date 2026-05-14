import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import PersonalDatastore from '../PersonalDatastore.vue';
import { useCatalogStore } from '../../stores/catalogStore';

// Routes that mirror the real router
const routes = [
  { path: '/', name: 'Home', component: { template: '<div>Home</div>' } },
  { path: '/personal-datastore', name: 'PersonalDatastore', component: PersonalDatastore },
  {
    path: '/personal-datastore/:name',
    name: 'PersonalDatastoreDetail',
    component: PersonalDatastore,
  },
];

// Stubs shared across all mounts
const globalStubs = {
  EagerDatastoreDetail: { template: '<div data-testid="eager-datastore-detail" />' },
  Button: {
    template: '<button @click="$emit(\'click\')">{{ label }}</button>',
    props: ['label', 'icon', 'size', 'severity', 'outlined', 'disabled', 'loading'],
    emits: ['click'],
  },
  InputText: {
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue'],
    emits: ['update:modelValue'],
  },
};

describe('PersonalDatastore', () => {
  let wrapper: VueWrapper<any>;
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;
  let store: ReturnType<typeof useCatalogStore>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = createRouter({ history: createMemoryHistory(), routes });
    await router.push('/personal-datastore');
    await router.isReady();
    store = useCatalogStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
    vi.restoreAllMocks();
  });

  const mountComponent = () =>
    mount(PersonalDatastore, {
      global: { plugins: [pinia, router, PrimeVue], stubs: globalStubs },
    });

  // ── Upload page ─────────────────────────────────────────────────────────────

  describe('upload page (no :name route param)', () => {
    it('shows a breadcrumb link back to the catalog', () => {
      wrapper = mountComponent();
      expect(wrapper.text()).toContain('Catalog');
      expect(wrapper.text()).toContain('Personal Datastore');
    });

    it('shows the upload form when no datastore is loaded', () => {
      wrapper = mountComponent();
      expect(wrapper.text()).toContain('Upload Datastore CSV');
    });

    it('shows the "What is an intake-esm CSV?" info panel when no datastore is loaded', () => {
      wrapper = mountComponent();
      expect(wrapper.text()).toContain('What is an intake-esm CSV?');
    });

    it('hides the info panel and shows session banner when a datastore is loaded', async () => {
      store.personalDatastore = { name: 'my-ds', csvFileName: 'my.csv', loadedAt: new Date() };
      wrapper = mountComponent();
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('my-ds');
      expect(wrapper.text()).not.toContain('What is an intake-esm CSV?');
    });

    it('hides the upload form when a datastore is loaded and Replace is not open', async () => {
      store.personalDatastore = { name: 'my-ds', csvFileName: 'my.csv', loadedAt: new Date() };
      wrapper = mountComponent();
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).not.toContain('Upload Datastore CSV');
    });

    it('shows the Replace form when the Replace button is clicked', async () => {
      store.personalDatastore = { name: 'my-ds', csvFileName: 'my.csv', loadedAt: new Date() };
      wrapper = mountComponent();
      await wrapper.vm.$nextTick();

      // Click the Replace button (stub renders text label)
      const replaceBtn = wrapper.findAll('button').find((b) => b.text() === 'Replace');
      await replaceBtn?.trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('Replace Datastore');
    });

    it('calls clearPersonalDatastore and stays on the upload page when Clear is clicked', async () => {
      store.personalDatastore = { name: 'my-ds', csvFileName: 'my.csv', loadedAt: new Date() };
      const clearSpy = vi.spyOn(store, 'clearPersonalDatastore');
      wrapper = mountComponent();
      await wrapper.vm.$nextTick();

      const clearBtn = wrapper.findAll('button').find((b) => b.text() === 'Clear');
      await clearBtn?.trigger('click');

      expect(clearSpy).toHaveBeenCalled();
    });

    it('calls replacePersonalDatastore when a datastore is already loaded', async () => {
      store.personalDatastore = { name: 'old-ds', csvFileName: 'old.csv', loadedAt: new Date() };
      const replaceSpy = vi.spyOn(store, 'replacePersonalDatastore').mockResolvedValue(undefined);

      wrapper = mountComponent();
      await wrapper.vm.$nextTick();

      // Open the replace form
      const replaceBtn = wrapper.findAll('button').find((b) => b.text() === 'Replace');
      await replaceBtn?.trigger('click');
      await wrapper.vm.$nextTick();

      // Pick a file
      const fileInput = wrapper.find('input[type="file"]');
      const file = new File(['variable\ntas'], 'new.csv', { type: 'text/csv' });
      Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true });
      await fileInput.trigger('change');

      // Load
      const loadBtn = wrapper.findAll('button').find((b) => b.text() === 'Load Datastore');
      await loadBtn?.trigger('click');
      await flushPromises();

      expect(replaceSpy).toHaveBeenCalledWith(file, 'personal-datastore');
    });

    it('routes to PersonalDatastoreDetail after successful upload', async () => {
      const loadSpy = vi.spyOn(store, 'loadPersonalDatastoreCsv').mockResolvedValue(undefined);

      wrapper = mountComponent();

      // Simulate file selection
      const fileInput = wrapper.find('input[type="file"]');
      const file = new File(['variable\ntas'], 'my.csv', { type: 'text/csv' });
      Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true });
      await fileInput.trigger('change');

      // Simulate clicking Load Datastore
      const loadBtn = wrapper.findAll('button').find((b) => b.text() === 'Load Datastore');
      await loadBtn?.trigger('click');
      await flushPromises();

      expect(loadSpy).toHaveBeenCalledWith(file, 'personal-datastore');
      expect(router.currentRoute.value.name).toBe('PersonalDatastoreDetail');
      expect(router.currentRoute.value.params.name).toBe('personal-datastore');
    });

    it('displays an error message when upload fails', async () => {
      vi.spyOn(store, 'loadPersonalDatastoreCsv').mockRejectedValue(new Error('DuckDB parse error'));

      wrapper = mountComponent();

      const fileInput = wrapper.find('input[type="file"]');
      const file = new File(['bad'], 'my.csv', { type: 'text/csv' });
      Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true });
      await fileInput.trigger('change');

      const loadBtn = wrapper.findAll('button').find((b) => b.text() === 'Load Datastore');
      await loadBtn?.trigger('click');
      await flushPromises();

      expect(wrapper.text()).toContain('DuckDB parse error');
    });
  });

  // ── Detail page ─────────────────────────────────────────────────────────────

  describe('detail page (:name route param present)', () => {
    it('renders EagerDatastoreDetail when navigated to the detail route', async () => {
      store.personalDatastore = { name: 'my-ds', csvFileName: 'my.csv', loadedAt: new Date() };
      await router.push('/personal-datastore/my-ds');
      await router.isReady();

      wrapper = mountComponent();
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="eager-datastore-detail"]').exists()).toBe(true);
    });

    it('does not render the upload form on the detail route', async () => {
      store.personalDatastore = { name: 'my-ds', csvFileName: 'my.csv', loadedAt: new Date() };
      await router.push('/personal-datastore/my-ds');
      await router.isReady();

      wrapper = mountComponent();
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).not.toContain('Upload Datastore CSV');
    });
  });

  // ── Uncovered branches ────────────────────────────────────────────────────

  describe('slugify fallback', () => {
    it('falls back to "personal-datastore" when name slugifies to empty string', async () => {
      const loadSpy = vi.spyOn(store, 'loadPersonalDatastoreCsv').mockResolvedValue(undefined);

      wrapper = mountComponent();

      // Set a name that has no alphanumeric characters — InputText stub renders as <input> without type attr
      const input = wrapper.find('input:not([type="file"])');
      await input.setValue('---');

      const fileInput = wrapper.find('input[type="file"]');
      const file = new File(['variable\ntas'], 'my.csv', { type: 'text/csv' });
      Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true });
      await fileInput.trigger('change');

      const loadBtn = wrapper.findAll('button').find((b) => b.text() === 'Load Datastore');
      await loadBtn?.trigger('click');
      await flushPromises();

      expect(loadSpy).toHaveBeenCalled();
      // The route should use the fallback slug
      expect(router.currentRoute.value.params.name).toBe('personal-datastore');
    });
  });

  describe('loadedAtFormatted', () => {
    it('returns empty string when no datastore is loaded', () => {
      wrapper = mountComponent();
      // No personalDatastore set → loadedAtFormatted should return ''
      expect((wrapper.vm as any).loadedAtFormatted).toBe('');
    });

    it('returns formatted time when datastore has a loadedAt date', () => {
      store.personalDatastore = { name: 'ds', csvFileName: 'x.csv', loadedAt: new Date() };
      wrapper = mountComponent();
      // Should return a non-empty time string
      expect((wrapper.vm as any).loadedAtFormatted).not.toBe('');
    });
  });

  describe('handleFileChange edge cases', () => {
    it('sets selectedFile to null when files is null/empty', async () => {
      wrapper = mountComponent();
      const fileInput = wrapper.find('input[type="file"]');

      // Trigger change with no files
      Object.defineProperty(fileInput.element, 'files', { value: null, configurable: true });
      await fileInput.trigger('change');

      expect((wrapper.vm as any).selectedFile).toBeNull();
    });
  });

  describe('handleUpload early return', () => {
    it('does nothing when no file is selected', async () => {
      const loadSpy = vi.spyOn(store, 'loadPersonalDatastoreCsv').mockResolvedValue(undefined);
      wrapper = mountComponent();

      // Click Load without selecting a file
      const loadBtn = wrapper.findAll('button').find((b) => b.text() === 'Load Datastore');
      await loadBtn?.trigger('click');
      await flushPromises();

      expect(loadSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleUpload non-Error exception', () => {
    it('shows generic error message when thrown value is not an Error instance', async () => {
      vi.spyOn(store, 'loadPersonalDatastoreCsv').mockRejectedValue('string error');

      wrapper = mountComponent();

      const fileInput = wrapper.find('input[type="file"]');
      const file = new File(['bad'], 'my.csv', { type: 'text/csv' });
      Object.defineProperty(fileInput.element, 'files', { value: [file], configurable: true });
      await fileInput.trigger('change');

      const loadBtn = wrapper.findAll('button').find((b) => b.text() === 'Load Datastore');
      await loadBtn?.trigger('click');
      await flushPromises();

      expect(wrapper.text()).toContain('Failed to load datastore');
    });
  });

  describe('handleClear with route param', () => {
    it('navigates to PersonalDatastore when cleared from detail route', async () => {
      store.personalDatastore = { name: 'my-ds', csvFileName: 'my.csv', loadedAt: new Date() };
      await router.push('/personal-datastore/my-ds');
      await router.isReady();

      wrapper = mountComponent();
      await wrapper.vm.$nextTick();

      const clearSpy = vi.spyOn(store, 'clearPersonalDatastore');

      // Call handleClear directly — it should redirect to PersonalDatastore
      (wrapper.vm as any).handleClear();
      await flushPromises();

      expect(clearSpy).toHaveBeenCalled();
      expect(router.currentRoute.value.name).toBe('PersonalDatastore');
    });
  });
});
