import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import CopyPath from '../CopyPath.vue';

describe('CopyPath', () => {
  let wrapper: VueWrapper;
  const writeText = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  });
  afterEach(() => {
    wrapper?.unmount();
    vi.useRealTimers();
  });

  it.each(['file path', 'directory'] as const)('copies the complete %s and confirms success briefly', async (kind) => {
    const path = `/g/data/${'long-folder/'.repeat(20)}${kind === 'file path' ? 'tas.nc' : ''}`;
    wrapper = mount(CopyPath, { props: { path, kind } });
    expect(wrapper.get('code').text()).toBe(path);
    expect(wrapper.get('button').text()).toContain(`Copy ${kind}`);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(path);
    expect(wrapper.get('button').text()).toBe('Copied');
    expect(wrapper.get('[role=status]').text()).toContain('copied');
    await vi.advanceTimersByTimeAsync(2000);
    expect(wrapper.get('button').text()).toContain(`Copy ${kind}`);
  });

  it('keeps the path selectable and allows retry after clipboard failure', async () => {
    writeText.mockRejectedValueOnce(new Error('Denied'));
    wrapper = mount(CopyPath, { props: { path: '/g/data/tas.nc', kind: 'file path' } });
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role=alert]').text()).toContain('Select and copy');
    expect(wrapper.get('code').text()).toBe('/g/data/tas.nc');
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role=alert]').exists()).toBe(false);
    expect(wrapper.get('button').text()).toBe('Copied');
  });

  it('does not mark a new path copied when an earlier clipboard operation finishes', async () => {
    let resolve!: () => void;
    writeText.mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    wrapper = mount(CopyPath, { props: { path: '/g/data/old.nc', kind: 'file path' } });
    await wrapper.get('button').trigger('click');
    await wrapper.setProps({ path: '/g/data/new.nc' });
    resolve();
    await flushPromises();
    expect(wrapper.get('button').text()).toContain('Copy file path');
    expect(wrapper.get('[role=status]').text()).toBe('');
  });

  it('shows service links alongside a directory and removes them when the path changes to an unsupported project', async () => {
    const path = '/g/data/fs38/publications/CMIP6/CMIP/CSIRO/ACCESS-ESM1-5/historical/';
    wrapper = mount(CopyPath, { props: { path, kind: 'directory', compact: true } });
    expect(wrapper.get('code').text()).toBe(path);
    const links = wrapper.findAll('a');
    expect(links).toHaveLength(2);
    expect(links[0]!.attributes('href')).toBe(
      'https://esgf.nci.org.au/thredds/catalog/esgcet/master/CMIP6/CMIP/CSIRO/ACCESS-ESM1-5/historical/catalog.html',
    );
    for (const link of links) {
      expect(link.attributes('target')).toBe('_blank');
      expect(link.attributes('rel')).toBe('noopener noreferrer');
    }
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(path);
    await wrapper.setProps({ path: '/g/data/private/results/' });
    expect(wrapper.findAll('a')).toHaveLength(0);
  });
});
