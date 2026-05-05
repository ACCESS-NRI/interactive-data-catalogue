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
});
