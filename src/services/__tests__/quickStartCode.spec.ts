import { describe, expect, it } from 'vitest';
import {
  buildQuickStartCode,
  getRequiredProjects,
  hasActiveQuickStartFilters,
  shouldShowQuickStartCellMethodsWarning,
} from '../quickStartCode';

describe('quickStartCode', () => {
  it('detects when filters are active', () => {
    expect(hasActiveQuickStartFilters({})).toBe(false);
    expect(hasActiveQuickStartFilters({ project: ['xp65'] })).toBe(true);
  });

  it('builds base quick-start code with datastore name', () => {
    const code = buildQuickStartCode({
      datastoreName: 'my-datastore',
      currentFilters: {},
      numDatasets: 0,
      isXArrayMode: true,
    });

    expect(code).toContain('intake.cat.access_nri["my-datastore"]');
  });

  it('renders single and multi-value filters in the generated code', () => {
    const code = buildQuickStartCode({
      datastoreName: 'test-datastore',
      currentFilters: { project: ['xp65'], variable: ['tas', 'pr'] },
      numDatasets: 0,
      isXArrayMode: true,
    });

    expect(code).toContain("datastore.search(project='xp65')");
    expect(code).toContain('datastore.search(variable=["tas","pr"])');
  });

  it('always applies the variable filter last', () => {
    const code = buildQuickStartCode({
      datastoreName: 'test-datastore',
      currentFilters: { variable: ['tas'], project: ['xp65'], frequency: ['1mon'] },
      numDatasets: 0,
      isXArrayMode: true,
    });

    const projectIdx = code.indexOf("datastore.search(project='xp65')");
    const frequencyIdx = code.indexOf("datastore.search(frequency='1mon')");
    const variableIdx = code.indexOf("datastore.search(variable='tas')");

    expect(variableIdx).toBeGreaterThan(projectIdx);
    expect(variableIdx).toBeGreaterThan(frequencyIdx);
  });

  it('generates xarray dataset code for a single dataset', () => {
    const code = buildQuickStartCode({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
      isXArrayMode: true,
    });

    expect(code).toContain('dataset = datastore.to_dask()');
    expect(code).not.toContain('dataset_dict = datastore.to_dataset_dict()');
  });

  it('generates dataset_dict code for multiple datasets in xarray mode', () => {
    const code = buildQuickStartCode({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 3,
      isXArrayMode: true,
    });

    expect(code).toContain('Search contains 3 datasets');
    expect(code).toContain('dataset_dict = datastore.to_dataset_dict()');
  });

  it('omits xarray conversion code when xarray mode is disabled', () => {
    const code = buildQuickStartCode({
      datastoreName: 'test-datastore',
      currentFilters: {},
      numDatasets: 1,
      isXArrayMode: false,
    });

    expect(code).not.toContain('to_dask()');
    expect(code).not.toContain('to_dataset_dict()');
  });

  it('builds required projects from typed cache metadata', () => {
    expect(getRequiredProjects(null)).toEqual(['xp65']);
    expect(
      getRequiredProjects({
        data: [],
        totalRecords: 0,
        columns: [],
        filterOptions: {},
        loading: false,
        error: null,
        lastFetched: new Date(),
        project: 'tm70',
      }),
    ).toEqual(['tm70', 'xp65']);
  });

  it('shows cell methods warning only for single-dataset xarray searches with multiple temporal labels', () => {
    expect(
      shouldShowQuickStartCellMethodsWarning({
        currentFilters: {},
        dynamicFilterOptions: { temporal_label: ['mean', 'point'] },
        numDatasets: 1,
        isXArrayMode: true,
      }),
    ).toBe(true);

    expect(
      shouldShowQuickStartCellMethodsWarning({
        currentFilters: { temporal_label: ['mean'] },
        dynamicFilterOptions: { temporal_label: ['mean', 'point'] },
        numDatasets: 1,
        isXArrayMode: true,
      }),
    ).toBe(false);
  });

  it('uses intake.open_esm_datastore opening for personal source', () => {
    const code = buildQuickStartCode({
      datastoreName: 'my-datastore',
      currentFilters: {},
      numDatasets: 0,
      isXArrayMode: false,
      source: 'personal',
    });

    expect(code).toContain('intake.open_esm_datastore("path/to/your/datastore.json")');
    expect(code).not.toContain('intake.cat.access_nri');
  });

  it('includes iterableColumns in the personal datastore opening', () => {
    const code = buildQuickStartCode({
      datastoreName: 'my-datastore',
      currentFilters: {},
      numDatasets: 0,
      isXArrayMode: false,
      source: 'personal',
      iterableColumns: ['variable', 'realm'],
    });

    expect(code).toContain("columns_with_iterables=['variable', 'realm']");
  });

  it('omits columns_with_iterables when iterableColumns is empty for personal source', () => {
    const code = buildQuickStartCode({
      datastoreName: 'my-datastore',
      currentFilters: {},
      numDatasets: 0,
      isXArrayMode: false,
      source: 'personal',
      iterableColumns: [],
    });

    expect(code).not.toContain('columns_with_iterables');
  });
});
