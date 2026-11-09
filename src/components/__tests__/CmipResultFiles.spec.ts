import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import CmipResultFiles from '../CmipResultFiles.vue';
import CopyPath from '../CopyPath.vue';
import { fetchCmipFilePaths, type CmipFilePage } from '../../services/cmipFiles';

vi.mock('../../services/cmipFiles', () => ({ fetchCmipFilePaths: vi.fn() }));

describe('CMIP inline file paths', () => {
  let wrapper: VueWrapper;
  const fetchPaths = vi.mocked(fetchCmipFilePaths);
  const record = { source_id: 'ACCESS-CM2', time_range: '200001-200912', version: 'v20200101' };
  const render = () => {
    wrapper = mount(CmipResultFiles, {
      props: {
        datastoreName: 'cmip6_fs38',
        filters: { variable_id: ['tas'] },
        record,
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
    expect(fetchPaths).toHaveBeenCalledWith('cmip6_fs38', { variable_id: ['tas'] }, record, 0, 10);
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
    expect(fetchPaths).toHaveBeenLastCalledWith('cmip6_fs38', { variable_id: ['tas'] }, record, 10, 10);
    expect(button('Next files').attributes('disabled')).toBeDefined();
    await wrapper.setProps({ record: { ...record, version: 'v20260101' } });
    await flushPromises();
    expect(fetchPaths).toHaveBeenLastCalledWith(
      'cmip6_fs38',
      { variable_id: ['tas'] },
      { ...record, version: 'v20260101' },
      0,
      10,
    );
  });

  it('discards a delayed response from an earlier selection', async () => {
    let resolve!: (page: CmipFilePage) => void;
    fetchPaths.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render();
    await wrapper.setProps({ filters: { variable_id: ['pr'] } });
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
    expect(wrapper.text()).toContain('No file paths were found for this result');
    expect(wrapper.find('[role=alert]').exists()).toBe(false);
  });
});
