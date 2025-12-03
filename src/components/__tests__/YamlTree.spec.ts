import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import YamlTree from '../YamlTree.vue';
import YamlNode from '../YamlNode.vue';

describe('YamlTree', () => {
  it('renders without data', () => {
    const wrapper = mount(YamlTree, {
      props: { data: null },
    });

    expect(wrapper.text()).toContain('No data to display');
  });

  it('renders with data', () => {
    const testData = { key: 'value' };
    const wrapper = mount(YamlTree, {
      props: { data: testData },
      global: {
        components: { YamlNode },
      },
    });

    expect(wrapper.findComponent(YamlNode).exists()).toBe(true);
    expect(wrapper.text()).not.toContain('No data to display');
  });

  it('applies correct CSS class', () => {
    const wrapper = mount(YamlTree, {
      props: { data: { test: 'data' } },
      global: {
        components: { YamlNode },
      },
    });

    expect(wrapper.find('.yaml-tree').exists()).toBe(true);
  });
});
