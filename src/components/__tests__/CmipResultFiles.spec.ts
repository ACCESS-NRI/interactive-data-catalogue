import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import CmipResultFiles from '../CmipResultFiles.vue';
import CopyPath from '../CopyPath.vue';
import type { CmipFilePage } from '../../services/cmipDatasets';

describe('CMIP inline file paths', () => {
  let wrapper: VueWrapper;
  const fetchPaths = vi.fn();
  const search = { files: fetchPaths, page: vi.fn(), dispose: vi.fn() };
  const key = 'CMIP6/CMIP/CSIRO/ACCESS-CM2/historical/r1i1p1f1/Amon/tas/gn/v20200101';
  const render = () => {
    wrapper = mount(CmipResultFiles, {
      props: {
        search,
        datasetKey: key,
      },
    });
  };
  const button = (label: string) => wrapper.findAll('button').find((element) => element.text() === label)!;
  beforeEach(() => {
    vi.resetAllMocks();
    fetchPaths.mockResolvedValue({ paths: ['/g/data/tas/2000.nc'], hasMore: false });
  });
  afterEach(() => wrapper?.unmount());

  it('distinguishes exact filenames from their containing directory', async () => {
    render();
    expect(wrapper.get('[role=status]').text()).toContain('Looking up');
    await flushPromises();
    expect(fetchPaths).toHaveBeenCalledWith(key, 0, 10);
    expect(wrapper.findAllComponents(CopyPath).map((component) => component.props())).toEqual([
      { path: '/g/data/tas/2000.nc', kind: 'file path' },
      { path: '/g/data/tas/', kind: 'directory' },
    ]);
    expect(wrapper.get('details').element.open).toBe(false);
    expect(wrapper.text()).toContain('may also contain files outside your filters');
  });

  it('pages filenames and returns to the first page for a different result', async () => {
    fetchPaths.mockResolvedValueOnce({ paths: ['/g/data/tas/first.nc'], hasMore: true });
    render();
    await flushPromises();
    expect(button('Previous files').attributes('disabled')).toBeDefined();
    await button('Next files').trigger('click');
    await flushPromises();
    expect(fetchPaths).toHaveBeenLastCalledWith(key, 10, 10);
    expect(button('Next files').attributes('disabled')).toBeDefined();
    await wrapper.setProps({ datasetKey: key.replace('v20200101', 'v20260101') });
    await flushPromises();
    expect(fetchPaths).toHaveBeenLastCalledWith(key.replace('v20200101', 'v20260101'), 0, 10);
  });

  it('discards a delayed response from an earlier selection', async () => {
    let resolve!: (page: CmipFilePage) => void;
    fetchPaths.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render();
    await wrapper.setProps({ datasetKey: key.replace('/tas/', '/pr/') });
    await flushPromises();
    resolve({ paths: ['/g/data/old.nc'], hasMore: true });
    await flushPromises();
    expect(wrapper.text()).not.toContain('/g/data/old.nc');
    expect(wrapper.text()).toContain('/g/data/tas/2000.nc');
    expect(wrapper.find('[aria-label="File path pages"]').exists()).toBe(false);
  });

  it('offers retry for a failed lookup and explains missing paths', async () => {
    fetchPaths.mockRejectedValueOnce(new Error('Catalogue unavailable'));
    fetchPaths.mockResolvedValueOnce({ paths: [], hasMore: false });
    render();
    await flushPromises();
    expect(wrapper.get('[role=alert]').text()).toContain('Catalogue unavailable');
    await button('Retry file paths').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('No file paths were found for this dataset');
    expect(wrapper.find('[role=alert]').exists()).toBe(false);
  });
});
