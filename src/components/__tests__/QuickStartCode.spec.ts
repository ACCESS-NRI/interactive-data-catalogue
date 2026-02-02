import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import QuickStartCode from '../QuickStartCode.vue';
import { useCatalogStore } from '../../stores/catalogStore';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';

// Mock clipboard API
const writeTextMock = vi.fn(() => Promise.resolve());
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: writeTextMock,
  },
  writable: true,
});

describe('QuickStartCode', () => {
  let wrapper: VueWrapper<any>;
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);

    // Create a mock router
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/datastore/:name',
          name: 'DatastoreDetail',
          component: { template: '<div>Mock</div>' },
        },
      ],
    });

    // Clear mock calls
    vi.clearAllMocks();
  });

  // Helper to create wrapper with required props and global config
  const createWrapper = (props: any) => {
    return mount(QuickStartCode, {
      props: {
        dynamicFilterOptions: {},
        numDatasets: 1, // Default to 1 dataset
        ...props,
      },
      global: {
        plugins: [pinia, router, PrimeVue, ToastService],
        stubs: {
          Toast: true,
          Button: true,
          ToggleSwitch: true,
          highlightjs: {
            template: '<pre><code>{{ code }}</code></pre>',
            props: ['code', 'language'],
          },
        },
      },
    });
  };

  // Test that the component renders with minimal props
  it('renders with minimal props', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 0,
    });

    expect(wrapper.text()).toContain('Quick Start');
  });

  // Test that the generated code includes the datastore name
  it('generates code with datastore name', () => {
    wrapper = createWrapper({
      datastoreName: 'my-datastore',
      currentFilters: {},
      numDatasets: 0,
    });

    expect(wrapper.text()).toContain('intake.cat.access_nri["my-datastore"]');
  });

  // Test that the generated code includes search filters when active
  it('generates code with single filter value', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {
        project: ['xp65'],
      },
      numDatasets: 0,
    });

    expect(wrapper.text()).toContain("datastore.search(project='xp65')");
  });

  // Test that the generated code handles multiple values for a single filter
  it('generates code with multiple filter values', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {
        variable: ['tas', 'pr', 'huss'],
      },
      numDatasets: 0,
    });

    expect(wrapper.text()).toContain('datastore.search(variable=["tas","pr","huss"])');
  });

  // Test that the generated code includes multiple search filters
  it('generates code with multiple different filters', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {
        project: ['xp65'],
        variable: ['tas'],
        frequency: ['1mon'],
      },
      numDatasets: 0,
    });

    const text = wrapper.text();
    expect(text).toContain("datastore.search(project='xp65')");
    expect(text).toContain("datastore.search(variable='tas')");
    expect(text).toContain("datastore.search(frequency='1mon')");
  });

  // Test that the component displays message when filters are active
  it('shows filter message when filters are active', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {
        project: ['xp65'],
      },
      numDatasets: 0,
    });

    expect(wrapper.text()).toContain('with current filters');
  });

  // Test that the component does not show filter message when no filters
  it('does not show filter message when no filters', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 0,
    });

    expect(wrapper.text()).not.toContain('with current filters');
  });

  // Test that xarray mode generates to_dask() for single dataset
  it('generates to_dask() code for single dataset in xarray mode', async () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
    });

    // Component starts in xarray mode by default
    expect(wrapper.text()).toContain('dataset = datastore.to_dask()');
  });

  // Test that xarray mode generates to_dataset_dict() for multiple datasets
  it('generates to_dataset_dict() code for multiple datasets in xarray mode', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 3,
    });

    const text = wrapper.text();
    expect(text).toContain('dataset_dict = datastore.to_dataset_dict()');
    expect(text).toContain('Search contains 3 datasets');
  });

  // Test that ESM mode (non-xarray) does not include xarray conversion
  it('does not generate xarray code when toggle is off', async () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
    });

    // Find and toggle the switch to ESM mode (off)
    const toggleSwitch = wrapper.findComponent({ name: 'ToggleSwitch' });
    await toggleSwitch.vm.$emit('update:modelValue', false);

    const text = wrapper.text();
    expect(text).not.toContain('to_dask()');
    expect(text).not.toContain('to_dataset_dict()');
  });

  // Test that the copy code button triggers clipboard write
  it('copies code to clipboard when copy button clicked', async () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 0,
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(0);
    await buttons[0]!.vm.$emit('click');

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('intake.cat.access_nri["test-datastore"]'));
  });

  // Test that the copy code button triggers clipboard write
  it('copies code to clipboard when copy and open button clicked', async () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 0,
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(2);
    await buttons[2]!.vm.$emit('click');

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('intake.cat.access_nri["test-datastore"]'));
  });

  // Test that clicking a project badge opens the correct NCI join URL
  it('Correctly opens the NCI login page', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 0,
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(2);
    await buttons[2]!.vm.$emit('click');

    await new Promise((resolve) => setTimeout(resolve, 750)); // Wait slightly longer than the timeout

    expect(openSpy).toHaveBeenCalledWith('https://are.nci.org.au/pun/sys/dashboard', '_blank');

    openSpy.mockRestore();
  });

  // Test that the copy link button generates correct URL with filters
  it('generates and copies search link with filters', async () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {
        project: ['xp65'],
        variable: ['tas', 'pr'],
      },
      numDatasets: 0,
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(1);
    await buttons[1]!.vm.$emit('click');

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('project_filter=xp65'));
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('variable_filter=tas,pr'));
  });

  // Test that the copy link button generates URL without filters when none active
  it('generates and copies search link without filters', async () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 0,
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(1);
    await buttons[1]!.vm.$emit('click');

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringMatching(/\/datastore\/test-datastore$/));
  });

  // Test that required projects includes xp65 by default
  it('displays xp65 as required project by default', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 0,
    });

    const warningComponent = wrapper.findComponent({ name: 'RequiredProjectsWarning' });
    expect(warningComponent.props('projects')).toContain('xp65');
  });

  // Test that required projects includes projects from cached datastore
  it('displays cached project from datastore', () => {
    const store = useCatalogStore();
    store.datastoreCache = {
      'test-datastore': {
        data: [],
        totalRecords: 0,
        columns: [],
        filterOptions: {},
        loading: false,
        error: null,
        lastFetched: new Date(),
      },
    };

    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 0,
    });

    const warningComponent = wrapper.findComponent({ name: 'RequiredProjectsWarning' });
    const projects = warningComponent.props('projects');
    expect(projects).toContain('xp65');
    expect(projects).toContain('tm70');
  });

  // Test that the long URL dialog appears when URL exceeds threshold
  it('shows long URL dialog for very long URLs', async () => {
    // Create a very long filter to exceed URL length limit
    const longFilters: Record<string, string[]> = {};
    for (let i = 0; i < 100; i++) {
      longFilters[`column${i}`] = Array(50)
        .fill(0)
        .map((_, j) => `very-long-value-${i}-${j}`);
    }

    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: longFilters,
      numDatasets: 0,
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(1);
    await buttons[1]!.vm.$emit('click');

    // Should show dialog instead of immediately copying
    const dialog = wrapper.findComponent({ name: 'LongUrlConfirmDialog' });
    expect(dialog.props('visible')).toBe(true);
  });

  // Test that confirming long URL dialog copies the URL
  it('copies long URL after confirmation', async () => {
    // Create a very long filter to exceed URL length limit
    const longFilters: Record<string, string[]> = {};
    for (let i = 0; i < 100; i++) {
      longFilters[`column${i}`] = Array(50)
        .fill(0)
        .map((_, j) => `very-long-value-${i}-${j}`);
    }

    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: longFilters,
      numDatasets: 0,
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(1);
    await buttons[1]!.vm.$emit('click');

    const dialog = wrapper.findComponent({ name: 'LongUrlConfirmDialog' });
    const testUrl = 'http://test.com/very/long/url';
    await dialog.vm.$emit('confirm', testUrl);

    expect(writeTextMock).toHaveBeenCalledWith(testUrl);
  });

  // Test that canceling long URL dialog does not copy
  it('does not copy when long URL dialog is canceled', async () => {
    // Create a very long filter to exceed URL length limit
    const longFilters: Record<string, string[]> = {};
    for (let i = 0; i < 100; i++) {
      longFilters[`column${i}`] = Array(50)
        .fill(0)
        .map((_, j) => `very-long-value-${i}-${j}`);
    }

    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: longFilters,
      numDatasets: 0,
    });

    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(1);
    await buttons[1]!.vm.$emit('click');

    vi.clearAllMocks();

    const dialog = wrapper.findComponent({ name: 'LongUrlConfirmDialog' });
    await dialog.vm.$emit('cancel');

    expect(writeTextMock).not.toHaveBeenCalled();
  });

  // Test that toggle switch controls xarray/ESM mode
  it('toggles between xarray and ESM mode', async () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
    });

    // Should start in xarray mode
    expect(wrapper.text()).toContain('to_dask()');

    // Toggle to ESM mode
    const toggleSwitch = wrapper.findComponent({ name: 'ToggleSwitch' });
    await toggleSwitch.vm.$emit('update:modelValue', false);

    expect(wrapper.text()).not.toContain('to_dask()');

    // Toggle back to xarray mode
    await toggleSwitch.vm.$emit('update:modelValue', true);

    expect(wrapper.text()).toContain('to_dask()');
  });

  // Test that zero datasets doesn't break the component
  it('handles empty rawData gracefully', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 0,
    });

    expect(wrapper.text()).toContain('Quick Start');
    // Should generate basic code without xarray conversion
    expect(wrapper.text()).toContain('intake.cat.access_nri["test-datastore"]');
  });

  // Test that datasets are handled correctly
  it('handles rawData without file_id', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 2,
    });

    // Should still render without errors
    expect(wrapper.text()).toContain('Quick Start');
  });

  // Test that MultipleCellMethodsWarning appears when conditions are met
  it('shows cell methods warning when single dataset with multiple cell methods', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
      dynamicFilterOptions: {
        variable_cell_methods: ['time: mean', 'time: point', 'area: mean'],
      },
    });

    expect(wrapper.text()).toContain('Multiple Cell Methods Detected');
  });

  // Test that MultipleCellMethodsWarning does NOT appear with single cell method
  it('does not show cell methods warning with single cell method option', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
      dynamicFilterOptions: {
        variable_cell_methods: ['time: mean'],
      },
    });

    expect(wrapper.text()).not.toContain('Multiple Cell Methods Detected');
  });

  // Test that MultipleCellMethodsWarning does NOT appear with multiple datasets
  it('does not show cell methods warning with multiple datasets', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 2,
      dynamicFilterOptions: {
        variable_cell_methods: ['time: mean', 'time: point'],
      },
    });

    expect(wrapper.text()).not.toContain('Multiple Cell Methods Detected');
  });

  // Test that MultipleCellMethodsWarning does NOT appear in ESM mode
  it('does not show cell methods warning in ESM mode', async () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
      dynamicFilterOptions: {
        variable_cell_methods: ['time: mean', 'time: point'],
      },
    });

    // Toggle to ESM mode (off)
    const toggleSwitch = wrapper.findComponent({ name: 'ToggleSwitch' });
    await toggleSwitch.vm.$emit('update:modelValue', false);

    expect(wrapper.text()).not.toContain('Multiple Cell Methods Detected');
  });

  // Test that MultipleCellMethodsWarning does NOT appear without dynamicFilterOptions
  it('does not show cell methods warning without filterOptions', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
      dynamicFilterOptions: {},
    });

    expect(wrapper.text()).not.toContain('Multiple Cell Methods Detected');
  });
});
