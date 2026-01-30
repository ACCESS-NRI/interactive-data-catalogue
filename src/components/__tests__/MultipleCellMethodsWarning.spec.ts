import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MultipleCellMethodsWarning from '../MultipleCellMethodsWarning.vue';

describe('MultipleCellMethodsWarning', () => {
  // Helper to create wrapper
  const createWrapper = (props: any) => {
    return mount(MultipleCellMethodsWarning, {
      props,
    });
  };

  // Test that the component renders when visible is true
  it('renders warning when visible is true', () => {
    const wrapper = createWrapper({
      visible: true,
    });

    expect(wrapper.html()).toBeTruthy();
    expect(wrapper.text()).toContain('Multiple Cell Methods Detected:');
    expect(wrapper.text()).toContain('variable_cell_methods');
    expect(wrapper.text()).toContain('to_dask()');
  });

  // Test that the component does not render when visible is false
  it('does not render when visible is false', () => {
    const wrapper = createWrapper({
      visible: false,
    });

    expect(wrapper.find('.bg-orange-50').exists()).toBe(false);
  });

  // Test that warning icon is displayed
  it('displays warning icon', () => {
    const wrapper = createWrapper({
      visible: true,
    });

    const icon = wrapper.find('.pi-exclamation-triangle');
    expect(icon.exists()).toBe(true);
  });

  // Test that code elements are rendered for technical terms
  it('renders code elements for technical terms', () => {
    const wrapper = createWrapper({
      visible: true,
    });

    const codeElements = wrapper.findAll('code');
    expect(codeElements.length).toBeGreaterThanOrEqual(2);
    expect(codeElements.some((el) => el.text().includes('temporal_label'))).toBe(true);
    expect(codeElements.some((el) => el.text().includes('to_dask()'))).toBe(true);
  });

  // Test that the component has proper styling classes
  it('has proper warning styling classes', () => {
    const wrapper = createWrapper({
      visible: true,
    });

    const outerDiv = wrapper.find('div');
    expect(outerDiv.classes()).toContain('bg-orange-50');
    expect(outerDiv.classes()).toContain('border-orange-200');
  });
});
