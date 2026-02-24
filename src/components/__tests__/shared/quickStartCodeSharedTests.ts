import { it, expect, vi } from 'vitest';
import type { VueWrapper } from '@vue/test-utils';
import { useCatalogStore } from '../../../stores/catalogStore';

/**
 * Normalised props used by the shared test suite.
 *
 * Both Eager and Lazy wrappers translate these into their component-specific
 * props (Eager converts `numDatasets` → synthetic `rawData`; Lazy passes it
 * directly).
 */
export interface SharedWrapperProps {
  datastoreName?: string;
  currentFilters?: Record<string, string[]>;
  numDatasets?: number;
  dynamicFilterOptions?: Record<string, string[]>;
}

type CreateWrapperFn = (props: SharedWrapperProps) => VueWrapper<any>;

/**
 * Shared test suite for QuickStartCode components.
 *
 * Call this inside the `describe` block of each component spec, passing in
 * a component-specific `createWrapper` factory and the `writeTextMock` ref
 * so clipboard assertions work correctly.
 *
 * @param createWrapper - Factory that returns a mounted component wrapper.
 * @param writeTextMock - The `vi.fn()` used to mock `navigator.clipboard.writeText`.
 */
export function runQuickStartCodeSharedTests(createWrapper: CreateWrapperFn, writeTextMock: ReturnType<typeof vi.fn>) {
  let wrapper: VueWrapper<any>;

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders with minimal props', () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 0 });
    expect(wrapper.text()).toContain('Quick Start');
  });

  // -------------------------------------------------------------------------
  // Code generation — datastore name
  // -------------------------------------------------------------------------

  it('generates code with datastore name', () => {
    wrapper = createWrapper({ datastoreName: 'my-datastore', currentFilters: {}, numDatasets: 0 });
    expect(wrapper.text()).toContain('intake.cat.access_nri["my-datastore"]');
  });

  // -------------------------------------------------------------------------
  // Code generation — filters
  // -------------------------------------------------------------------------

  it('generates code with single filter value', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: { project: ['xp65'] },
      numDatasets: 0,
    });
    expect(wrapper.text()).toContain("datastore.search(project='xp65')");
  });

  it('generates code with multiple filter values', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: { variable: ['tas', 'pr', 'huss'] },
      numDatasets: 0,
    });
    expect(wrapper.text()).toContain('datastore.search(variable=["tas","pr","huss"])');
  });

  it('generates code with multiple different filters', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: { project: ['xp65'], variable: ['tas'], frequency: ['1mon'] },
      numDatasets: 0,
    });
    const text = wrapper.text();
    expect(text).toContain("datastore.search(project='xp65')");
    expect(text).toContain("datastore.search(variable='tas')");
    expect(text).toContain("datastore.search(frequency='1mon')");
  });

  // intake-esm requires `variable` to be applied last for correct filtering.
  it('applies variable filter last regardless of insertion order', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: { variable: ['tas'], project: ['xp65'], frequency: ['1mon'] },
      numDatasets: 0,
    });
    const text = wrapper.text();
    const projectIdx = text.indexOf("datastore.search(project='xp65')");
    const frequencyIdx = text.indexOf("datastore.search(frequency='1mon')");
    const variableIdx = text.indexOf("datastore.search(variable='tas')");
    expect(variableIdx).toBeGreaterThan(projectIdx);
    expect(variableIdx).toBeGreaterThan(frequencyIdx);
  });

  // -------------------------------------------------------------------------
  // Filter message
  // -------------------------------------------------------------------------

  it('shows filter message when filters are active', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: { project: ['xp65'] },
      numDatasets: 0,
    });
    expect(wrapper.text()).toContain('with current filters');
  });

  it('does not show filter message when no filters', () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 0 });
    expect(wrapper.text()).not.toContain('with current filters');
  });

  // -------------------------------------------------------------------------
  // xarray / ESM mode
  // -------------------------------------------------------------------------

  it('generates to_dask() code for single dataset in xarray mode', () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 1 });
    expect(wrapper.text()).toContain('dataset = datastore.to_dask()');
  });

  it('generates to_dataset_dict() code for multiple datasets in xarray mode', () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 3 });
    const text = wrapper.text();
    expect(text).toContain('dataset_dict = datastore.to_dataset_dict()');
    expect(text).toContain('Search contains 3 datasets');
  });

  it('does not generate xarray code when toggle is off', async () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 1 });
    const toggleSwitch = wrapper.findComponent({ name: 'ToggleSwitch' });
    await toggleSwitch.vm.$emit('update:modelValue', false);
    const text = wrapper.text();
    expect(text).not.toContain('to_dask()');
    expect(text).not.toContain('to_dataset_dict()');
  });

  it('toggles between xarray and ESM mode', async () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 1 });
    expect(wrapper.text()).toContain('to_dask()');
    const toggleSwitch = wrapper.findComponent({ name: 'ToggleSwitch' });
    await toggleSwitch.vm.$emit('update:modelValue', false);
    expect(wrapper.text()).not.toContain('to_dask()');
    await toggleSwitch.vm.$emit('update:modelValue', true);
    expect(wrapper.text()).toContain('to_dask()');
  });

  // -------------------------------------------------------------------------
  // Clipboard: copy code
  // -------------------------------------------------------------------------

  it('copies code to clipboard when copy button clicked', async () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 0 });
    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(0);
    await buttons[0]!.vm.$emit('click');
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('intake.cat.access_nri["test-datastore"]'));
  });

  it('copies code to clipboard when copy-and-open button clicked', async () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 0 });
    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(2);
    await buttons[2]!.vm.$emit('click');
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('intake.cat.access_nri["test-datastore"]'));
  });

  it('opens the ARE dashboard after copying code', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 0 });
    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(2);
    await buttons[2]!.vm.$emit('click');
    await new Promise((resolve) => setTimeout(resolve, 750));
    expect(openSpy).toHaveBeenCalledWith('https://are.nci.org.au/pun/sys/dashboard', '_blank');
    openSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Clipboard: copy search link
  // -------------------------------------------------------------------------

  it('generates and copies search link with filters', async () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: { project: ['xp65'], variable: ['tas', 'pr'] },
      numDatasets: 0,
    });
    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(1);
    await buttons[1]!.vm.$emit('click');
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('project_filter=xp65'));
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('variable_filter=tas,pr'));
  });

  it('generates and copies search link without filters', async () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 0 });
    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(1);
    await buttons[1]!.vm.$emit('click');
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringMatching(/\/datastore\/test-datastore$/));
  });

  // -------------------------------------------------------------------------
  // Required projects
  // -------------------------------------------------------------------------

  it('displays xp65 as required project by default', () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 0 });
    const warningComponent = wrapper.findComponent({ name: 'RequiredProjectsWarning' });
    expect(warningComponent.props('projects')).toContain('xp65');
  });

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
        project: 'tm70',
      },
    };
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 0 });
    const warningComponent = wrapper.findComponent({ name: 'RequiredProjectsWarning' });
    const projects = warningComponent.props('projects');
    expect(projects).toContain('xp65');
    expect(projects).toContain('tm70');
  });

  // -------------------------------------------------------------------------
  // Long-URL dialog
  // -------------------------------------------------------------------------

  const makeLongFilters = (): Record<string, string[]> => {
    const filters: Record<string, string[]> = {};
    for (let i = 0; i < 100; i++) {
      filters[`column${i}`] = Array.from({ length: 50 }, (_, j) => `very-long-value-${i}-${j}`);
    }
    return filters;
  };

  it('shows long URL dialog for very long URLs', async () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: makeLongFilters(), numDatasets: 0 });
    const buttons = wrapper.findAllComponents({ name: 'Button' });
    expect(buttons.length).toBeGreaterThan(1);
    await buttons[1]!.vm.$emit('click');
    const dialog = wrapper.findComponent({ name: 'LongUrlConfirmDialog' });
    expect(dialog.props('visible')).toBe(true);
  });

  it('copies long URL after confirmation', async () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: makeLongFilters(), numDatasets: 0 });
    const buttons = wrapper.findAllComponents({ name: 'Button' });
    await buttons[1]!.vm.$emit('click');
    const dialog = wrapper.findComponent({ name: 'LongUrlConfirmDialog' });
    const testUrl = 'http://test.com/very/long/url';
    await dialog.vm.$emit('confirm', testUrl);
    expect(writeTextMock).toHaveBeenCalledWith(testUrl);
  });

  it('does not copy when long URL dialog is canceled', async () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: makeLongFilters(), numDatasets: 0 });
    const buttons = wrapper.findAllComponents({ name: 'Button' });
    await buttons[1]!.vm.$emit('click');
    vi.clearAllMocks();
    const dialog = wrapper.findComponent({ name: 'LongUrlConfirmDialog' });
    await dialog.vm.$emit('cancel');
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // MultipleCellMethodsWarning
  // -------------------------------------------------------------------------

  it('shows cell methods warning when single dataset with multiple temporal labels', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
      dynamicFilterOptions: {
        variable_cell_methods: ['time: mean', 'time: point', 'area: mean'],
        temporal_label: ['mean', 'point', 'mean'],
      },
    });
    expect(wrapper.text()).toContain('Multiple Cell Methods Detected');
  });

  it('does not show cell methods warning with single temporal label option', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
      dynamicFilterOptions: { variable_cell_methods: ['time: mean'] },
    });
    expect(wrapper.text()).not.toContain('Multiple Cell Methods Detected');
  });

  it('does not show cell methods warning with multiple datasets', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 2,
      dynamicFilterOptions: { variable_cell_methods: ['time: mean', 'time: point'] },
    });
    expect(wrapper.text()).not.toContain('Multiple Cell Methods Detected');
  });

  it('does not show cell methods warning in ESM mode', async () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
      dynamicFilterOptions: { variable_cell_methods: ['time: mean', 'time: point'] },
    });
    const toggleSwitch = wrapper.findComponent({ name: 'ToggleSwitch' });
    await toggleSwitch.vm.$emit('update:modelValue', false);
    expect(wrapper.text()).not.toContain('Multiple Cell Methods Detected');
  });

  it('does not show cell methods warning without filterOptions', () => {
    wrapper = createWrapper({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
      dynamicFilterOptions: {},
    });
    expect(wrapper.text()).not.toContain('Multiple Cell Methods Detected');
  });

  // -------------------------------------------------------------------------
  // Graceful degradation
  // -------------------------------------------------------------------------

  it('handles zero datasets gracefully', () => {
    wrapper = createWrapper({ datastoreName: 'test-datastore', currentFilters: {}, numDatasets: 0 });
    expect(wrapper.text()).toContain('Quick Start');
    expect(wrapper.text()).toContain('intake.cat.access_nri["test-datastore"]');
  });
}
