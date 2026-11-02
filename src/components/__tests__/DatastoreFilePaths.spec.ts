import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import DatastoreFilePaths from '../DatastoreFilePaths.vue';
import { fetchDatastorePaths, fetchDatasetGrouping, type DatastorePathPage } from '../../services/datastorePaths';

vi.mock('../../services/datastorePaths', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/datastorePaths')>()),
  fetchDatastorePaths: vi.fn(),
  fetchDatasetGrouping: vi.fn().mockResolvedValue({ columns: ['file_id'], pathColumn: 'path' }),
}));

describe('DatastoreFilePaths', () => {
  let wrapper: VueWrapper;
  const fetchPaths = vi.mocked(fetchDatastorePaths);

  beforeEach(() => vi.resetAllMocks());
  afterEach(() => wrapper?.unmount());

  const mountPanel = (props = {}) => {
    wrapper = mount(DatastoreFilePaths, {
      props: { datastoreName: 'cmip7_australian', currentFilters: {}, ...props },
    });
    return wrapper;
  };
  const openPanel = async () => {
    wrapper.get('details').element.open = true;
    await wrapper.get('details').trigger('toggle');
    await flushPromises();
  };
  const button = (label: string) => wrapper.findAll('button').find((element) => element.text() === label)!;

  it('loads on expansion, displays complete paths, and copies them verbatim', async () => {
    const path = `/g/data/im55/${'long-directory/'.repeat(12)}`;
    fetchPaths.mockResolvedValue({ datasets: [{ id: 'ACCESS.tas', path, fileCount: 120 }], hasMore: false });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    mountPanel({ currentFilters: { variable_id: ['tas'] } });

    expect(wrapper.get('details').element.open).toBe(false);
    expect(fetchPaths).not.toHaveBeenCalled();
    await openPanel();

    expect(fetchPaths).toHaveBeenCalledWith('cmip7_australian', { variable_id: ['tas'] }, 0, 25);
    expect(wrapper.get('code').text()).toBe(path);
    expect(wrapper.text()).toContain('ACCESS.tas');
    expect(wrapper.text()).toContain('120 files');
    expect(wrapper.text()).toContain('Showing datasets 1–1');
    await button('Copy displayed paths').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(path);
    expect(wrapper.text()).toContain('Copied');
  });

  it('pages results and resets to the first page when filters change', async () => {
    fetchPaths.mockResolvedValue({ datasets: [{ id: 'first', path: '/g/data/first/', fileCount: 20 }], hasMore: true });
    mountPanel();
    await openPanel();
    await button('Next').trigger('click');
    await flushPromises();
    expect(fetchPaths).toHaveBeenLastCalledWith('cmip7_australian', {}, 25, 25);

    await wrapper.setProps({ currentFilters: { variable_id: ['pr'] } });
    await flushPromises();
    expect(fetchPaths).toHaveBeenLastCalledWith('cmip7_australian', { variable_id: ['pr'] }, 0, 25);
    expect(button('Previous').attributes('disabled')).toBeDefined();
  });

  it('does not show an old selection when its request finishes after the new selection', async () => {
    let resolveOld!: (page: DatastorePathPage) => void;
    fetchPaths.mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)));
    fetchPaths.mockResolvedValueOnce({ datasets: [{ id: 'pr', path: '/g/data/pr/', fileCount: 2 }], hasMore: false });
    mountPanel({ currentFilters: { variable_id: ['tas'] } });
    await openPanel();
    await wrapper.setProps({ currentFilters: { variable_id: ['pr'] } });
    await flushPromises();
    resolveOld({ datasets: [{ id: 'tas', path: '/g/data/tas/', fileCount: 2 }], hasMore: false });
    await flushPromises();

    expect(wrapper.get('code').text()).toBe('/g/data/pr/');
  });

  it('allows retrying a failed request and explains an empty selection', async () => {
    fetchPaths.mockRejectedValueOnce(new Error('Unable to read catalogue'));
    fetchPaths.mockResolvedValueOnce({ datasets: [], hasMore: false });
    mountPanel();
    await openPanel();
    expect(wrapper.get('[role="alert"]').text()).toContain('Unable to read catalogue');
    await button('Retry').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('No datasets match the current selection.');
  });

  it('uses filtered local rows without requesting public catalogue data', async () => {
    mountPanel({
      source: 'personal',
      rows: [
        { file_id: 'local', path: '/local/first.nc' },
        { file_id: 'local', path: ['/local/second.nc', '/local/third.nc'] },
      ],
    });
    await openPanel();
    expect(wrapper.get('code').text()).toBe('/local/');
    expect(wrapper.text()).toContain('3 files');
    expect(fetchPaths).not.toHaveBeenCalled();

    await wrapper.setProps({ rows: [{ file_id: 'local', path: '/local/third.nc' }] });
    await flushPromises();
    expect(wrapper.get('code').text()).toBe('/local/');
    expect(wrapper.text()).toContain('1 file');
  });

  it('uses Intake aggregation for cached builtin data, even when datasets share a folder', async () => {
    vi.mocked(fetchDatasetGrouping).mockResolvedValue({ columns: ['variable'], pathColumn: 'path' });
    mountPanel({
      rows: [
        { variable: 'tas', path: '/shared/tas_2000.nc' },
        { variable: 'tas', path: '/shared/tas_2001.nc' },
        { variable: 'pr', path: '/shared/pr_2000.nc' },
      ],
    });
    await openPanel();
    expect(fetchDatasetGrouping).toHaveBeenCalledWith('cmip7_australian');
    expect(wrapper.findAll('li')).toHaveLength(2);
    expect(wrapper.text()).toContain('2 files');
    expect(wrapper.text()).toContain('Showing datasets 1–2');
    expect(fetchPaths).not.toHaveBeenCalled();
  });

  it('explains when a local catalogue does not supply paths', async () => {
    mountPanel({ source: 'personal', rows: [{ filename: 'tas.nc', variable_id: 'tas' }] });
    await openPanel();
    expect(wrapper.text()).toContain('This catalogue does not provide file paths.');
    expect(wrapper.find('code').exists()).toBe(false);
    expect(fetchPaths).not.toHaveBeenCalled();
  });
});
