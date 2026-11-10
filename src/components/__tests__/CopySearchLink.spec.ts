import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import CopySearchLink from '../CopySearchLink.vue';

afterEach(() => vi.restoreAllMocks());

describe('search links', () => {
  it('copies the complete search URL and clears its confirmation when filters change', async () => {
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const href = 'https://example.org/#/cmip?project=CMIP7&nci=true&access=true&variable_id_filter=tas';
    const wrapper = mount(CopySearchLink, { props: { href } });
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(write).toHaveBeenCalledWith(href);
    expect(wrapper.text()).toContain('Link copied');
    await wrapper.setProps({ href: href.replace('tas', 'tos') });
    expect(wrapper.text()).toContain('Copy link to search');
    wrapper.unmount();
  });

  it('allows retry after a clipboard failure and ignores completion for a previous search', async () => {
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Denied'));
    const wrapper = mount(CopySearchLink, { props: { href: 'https://example.org/#/cmip' } });
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role=alert]').text()).toContain('address bar');
    let finish!: () => void;
    write.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await wrapper.get('button').trigger('click');
    await wrapper.setProps({ href: 'https://example.org/#/cmip?variable_id_filter=tas' });
    finish();
    await flushPromises();
    expect(wrapper.text()).toBe('Copy link to search');
    write.mockResolvedValueOnce(undefined);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Link copied');
    wrapper.unmount();
  });
});
