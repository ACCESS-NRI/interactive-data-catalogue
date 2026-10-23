import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Cmip7EsmvalcoreQuickStart from '../Cmip7EsmvalcoreQuickStart.vue';

describe('Cmip7EsmvalcoreQuickStart', () => {
  it('updates its example and warning as filters change, and copies the current code', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const wrapper = mount(Cmip7EsmvalcoreQuickStart, {
      props: { currentFilters: { variable_id: ['tas'], product: ['model-output'] } },
      global: {
        stubs: {
          Button: { template: '<button @click="$emit(\'click\')">{{ label }}</button>', props: ['label'] },
          highlightjs: { template: '<pre>{{ code }}</pre>', props: ['code'] },
        },
      },
    });

    expect(wrapper.text()).toContain('Alternative quick start: ESMValCore');
    expect(wrapper.text()).toContain('short_name="tas"');
    expect(wrapper.text()).toContain('not included as ESMValCore facets: product');

    await wrapper.setProps({ currentFilters: { variable_id: ['pr'] } });
    expect(wrapper.text()).toContain('short_name="pr"');
    expect(wrapper.text()).not.toContain('not included as ESMValCore facets');

    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('short_name="pr"'));
    expect(wrapper.find('button').text()).toBe('Copied');
  });
});
