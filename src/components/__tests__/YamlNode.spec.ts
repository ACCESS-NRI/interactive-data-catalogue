import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import YamlNode from '../YamlNode.vue';

describe('YamlNode', () => {
  // Test that primitive values (strings, numbers) are rendered as code elements
  it('renders primitive string value', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: 'test-value',
      },
    });

    const code = wrapper.find('code');
    expect(code.exists()).toBe(true);
    expect(code.text()).toBe('test-value');
  });

  // Test that number values are converted to strings and rendered
  it('renders primitive number value', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: 42,
      },
    });

    const code = wrapper.find('code');
    expect(code.exists()).toBe(true);
    expect(code.text()).toBe('42');
  });

  // Test that boolean values are converted to strings and rendered
  it('renders primitive boolean value', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: true,
      },
    });

    const code = wrapper.find('code');
    expect(code.exists()).toBe(true);
    expect(code.text()).toBe('true');
  });

  // Test that object keys are rendered as expandable buttons
  it('renders object with keys', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: {
          key1: 'value1',
          key2: 'value2',
        },
      },
    });

    expect(wrapper.text()).toContain('key1');
    expect(wrapper.text()).toContain('key2');
    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBe(2);
  });

  // Test that object values are initially hidden until toggled
  it('hides object values by default', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: {
          key1: 'value1',
        },
      },
    });

    // The nested value should be in the DOM but hidden
    const nestedDivs = wrapper.findAll('div[class="pl-2"]');
    expect(nestedDivs.length).toBeGreaterThan(0);
  });

  // Test that clicking a key toggles visibility of its value
  it('toggles object value visibility when clicked', async () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: {
          key1: 'value1',
        },
      },
    });

    const button = wrapper.find('button');
    
    // Initially closed (chevron-right)
    expect(wrapper.find('.pi-chevron-right').exists()).toBe(true);
    
    // Click to open
    await button.trigger('click');
    await wrapper.vm.$nextTick();
    
    // Now open (chevron-down)
    expect(wrapper.find('.pi-chevron-down').exists()).toBe(true);
    
    // Click to close
    await button.trigger('click');
    await wrapper.vm.$nextTick();
    
    // Back to closed (chevron-right)
    expect(wrapper.find('.pi-chevron-right').exists()).toBe(true);
  });

  // Test that arrays are rendered with indexed items
  it('renders array with indexed items', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: ['item1', 'item2', 'item3'],
      },
    });

    expect(wrapper.text()).toContain('- [0]');
    expect(wrapper.text()).toContain('- [1]');
    expect(wrapper.text()).toContain('- [2]');
    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBe(3);
  });

  // Test that array items are initially hidden until toggled
  it('hides array items by default', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: ['item1', 'item2'],
      },
    });

    // The nested items should be in the DOM but hidden
    const nestedDivs = wrapper.findAll('div[class="pl-2"]');
    expect(nestedDivs.length).toBe(2);
    // Initially closed, as indicated by chevron-right icons
    expect(wrapper.findAll('.pi-chevron-right').length).toBe(2);
  });

  // Test that clicking an array index toggles visibility of that item
  it('toggles array item visibility when clicked', async () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: ['item1'],
      },
    });

    const button = wrapper.find('button');
    
    // Initially closed
    expect(wrapper.find('.pi-chevron-right').exists()).toBe(true);
    expect(wrapper.find('.pi-chevron-down').exists()).toBe(false);
    
    // Click to open
    await button.trigger('click');
    await wrapper.vm.$nextTick();
    
    // Now open
    expect(wrapper.find('.pi-chevron-down').exists()).toBe(true);
    expect(wrapper.find('.pi-chevron-right').exists()).toBe(false);
  });

  // Test that nested objects are rendered recursively
  it('renders nested objects recursively', async () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: {
          parent: {
            child: 'nested-value',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('parent');
    
    // Open the parent
    const parentButton = wrapper.find('button');
    await parentButton.trigger('click');
    await wrapper.vm.$nextTick();
    
    // Now we should see the child key
    expect(wrapper.text()).toContain('child');
    
    // Open the child
    const buttons = wrapper.findAll('button');
    await buttons[1]!.trigger('click');
    await wrapper.vm.$nextTick();
    
    // Now we should see the nested value
    expect(wrapper.text()).toContain('nested-value');
  });

  // Test that nested arrays are rendered recursively
  it('renders nested arrays recursively', async () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: [['nested-item']],
      },
    });

    expect(wrapper.text()).toContain('- [0]');
    
    // Open the first array item
    const firstButton = wrapper.find('button');
    await firstButton.trigger('click');
    await wrapper.vm.$nextTick();
    
    // Now we should see the nested array index
    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBe(2);
    expect(wrapper.text()).toContain('- [0]'); // appears twice now
  });

  // Test that mixed nested structures (objects in arrays, arrays in objects) work correctly
  it('renders mixed nested structures', async () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: {
          arrayKey: ['value1', { nestedKey: 'nestedValue' }],
        },
      },
    });

    expect(wrapper.text()).toContain('arrayKey');
    
    // Open arrayKey
    const buttons = wrapper.findAll('button');
    await buttons[0]!.trigger('click');
    await wrapper.vm.$nextTick();
    
    // Should see array indices
    expect(wrapper.text()).toContain('- [0]');
    expect(wrapper.text()).toContain('- [1]');
  });

  // Test that null values are handled and rendered as strings
  it('renders null value', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: null,
      },
    });

    const code = wrapper.find('code');
    expect(code.exists()).toBe(true);
    expect(code.text()).toBe('null');
  });

  // Test that undefined values are handled and rendered as strings
  it('renders undefined value', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: undefined,
      },
    });

    const code = wrapper.find('code');
    expect(code.exists()).toBe(true);
    expect(code.text()).toBe('undefined');
  });

  // Test that empty objects are rendered with no keys
  it('renders empty object', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: {},
      },
    });

    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBe(0);
  });

  // Test that empty arrays are rendered with no items
  it('renders empty array', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: [],
      },
    });

    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBe(0);
  });

  // Test that deeply nested structures (3+ levels) are handled correctly
  it('renders deeply nested structures', async () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: {
          level1: {
            level2: {
              level3: 'deep-value',
            },
          },
        },
      },
    });

    expect(wrapper.text()).toContain('level1');
    
    // Open level1
    let buttons = wrapper.findAll('button');
    await buttons[0]!.trigger('click');
    await wrapper.vm.$nextTick();
    
    expect(wrapper.text()).toContain('level2');
    
    // Open level2
    buttons = wrapper.findAll('button');
    await buttons[1]!.trigger('click');
    await wrapper.vm.$nextTick();
    
    expect(wrapper.text()).toContain('level3');
    
    // Open level3
    buttons = wrapper.findAll('button');
    await buttons[2]!.trigger('click');
    await wrapper.vm.$nextTick();
    
    expect(wrapper.text()).toContain('deep-value');
  });

  // Test that chevron icons change correctly based on toggle state
  it('displays correct chevron icon based on open state', async () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: { key: 'value' },
      },
    });

    // Initially closed - should show chevron-right
    expect(wrapper.find('.pi-chevron-right').exists()).toBe(true);
    expect(wrapper.find('.pi-chevron-down').exists()).toBe(false);

    // Click to open
    await wrapper.find('button').trigger('click');
    await wrapper.vm.$nextTick();

    // Now open - should show chevron-down
    expect(wrapper.find('.pi-chevron-right').exists()).toBe(false);
    expect(wrapper.find('.pi-chevron-down').exists()).toBe(true);
  });

  // Test that multiple keys can be toggled independently
  it('toggles multiple object keys independently', async () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: {
          key1: 'value1',
          key2: 'value2',
        },
      },
    });

    const buttons = wrapper.findAll('button');

    expect(wrapper.findAll('.pi-chevron-down').length).toBe(0);
    
    // Open first key
    await buttons[0]!.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.pi-chevron-down').length).toBe(1);
    
    // First should be open, second closed
    const chevronDowns = wrapper.findAll('.pi-chevron-down');
    const chevronRights = wrapper.findAll('.pi-chevron-right');
    expect(chevronDowns.length).toBe(1);
    expect(chevronRights.length).toBe(1);
    
    // Open second key
    await buttons[1]!.trigger('click');
    await wrapper.vm.$nextTick();
    
    // Both should be open
    expect(wrapper.findAll('.pi-chevron-down').length).toBe(2);
  });

  // Test that font-mono class is applied to key and value displays
  it('applies font-mono styling to keys and values', () => {
    const wrapper = mount(YamlNode, {
      props: {
        data: {
          key: 'value',
        },
      },
    });

    const monoElements = wrapper.findAll('.font-mono');
    expect(monoElements.length).toBeGreaterThan(0);
  });
});
