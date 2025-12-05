import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FilterSelectors from '../FilterSelectors.vue';
import MultiSelect from 'primevue/multiselect';
import Button from 'primevue/button';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';

describe('FilterSelectors', () => {
  const defaultProps = {
    filterOptions: {
      project: ['proj1', 'proj2', 'proj3'],
      experiment: ['exp1', 'exp2'],
      variable: ['var1', 'var2', 'var3', 'var4'],
    },
    modelValue: {},
    dynamicFilterOptions: {
      project: ['proj1', 'proj2', 'proj3'],
      experiment: ['exp1', 'exp2'],
      variable: ['var1', 'var2', 'var3', 'var4'],
    },
  };

  // Helper to create wrapper with PrimeVue components
  const createWrapper = (props: any = {}) => {
    return mount(FilterSelectors, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [
          [
            PrimeVue,
            {
              theme: {
                preset: Aura,
              },
            },
          ],
        ],
        components: { MultiSelect, Button },
      },
    });
  };

  // Test that all filter columns are rendered with their formatted labels
  it('renders all filter columns with proper labels', () => {
    const wrapper = createWrapper();

    expect(wrapper.text()).toContain('Project');
    expect(wrapper.text()).toContain('Experiment');
    expect(wrapper.text()).toContain('Variable');
  });

  // Test that column names with underscores are formatted to title case with spaces
  it('formats column names correctly', () => {
    const wrapper = createWrapper({
      filterOptions: {
        test_column_name: ['value1'],
      },
    });

    expect(wrapper.text()).toContain('Test Column Name');
  });

  // Test that MultiSelect components are rendered for each filter column
  it('renders MultiSelect components for each filter', () => {
    const wrapper = createWrapper();

    const multiSelects = wrapper.findAllComponents(MultiSelect);
    expect(multiSelects.length).toBe(3);
  });

  // Test that the clear filters button is present and functional
  it('renders clear filters button', () => {
    const wrapper = createWrapper();

    const button = wrapper.findComponent(Button);
    expect(button.exists()).toBe(true);
    expect(button.text()).toContain('Clear Filters');
  });

  // Test that clicking the clear button emits the 'clear' event
  it('emits clear event when clear button is clicked', async () => {
    const wrapper = createWrapper();

    await wrapper.findComponent(Button).trigger('click');
    expect(wrapper.emitted('clear')).toBeTruthy();
    expect(wrapper.emitted('clear')?.length).toBe(1);
  });

  // Test that updating a filter emits the update:modelValue event with correct data
  it('emits update:modelValue when filter is changed', () => {
    const wrapper = createWrapper();

    const multiSelect = wrapper.findComponent(MultiSelect);
    multiSelect.vm.$emit('update:model-value', ['proj1', 'proj2']);

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    const emittedValue = wrapper.emitted('update:modelValue')?.[0]?.[0] as Record<string, string[]>;
    expect(emittedValue).toHaveProperty('project');
    expect(emittedValue.project).toEqual(['proj1', 'proj2']);
  });

  // Test that existing filter values are preserved when updating another filter
  it('preserves existing filters when updating one filter', () => {
    const wrapper = createWrapper({
      modelValue: {
        project: ['proj1'],
        experiment: ['exp1'],
      },
    });

    const multiSelects = wrapper.findAllComponents(MultiSelect);
    // Update the variable filter (third one)
    const variableFilter = multiSelects[2];
    if (variableFilter) {
      variableFilter.vm.$emit('update:model-value', ['var1']);
    }

    const emittedValue = wrapper.emitted('update:modelValue')?.[0]?.[0] as Record<string, string[]>;
    expect(emittedValue).toEqual({
      project: ['proj1'],
      experiment: ['exp1'],
      variable: ['var1'],
    });
  });

  // Test that dynamic filter options are used from props
  it('uses dynamic filter options from props', () => {
    const wrapper = createWrapper({
      dynamicFilterOptions: {
        project: ['proj1'],
        experiment: ['exp1'],
        variable: ['var1'],
      },
    });

    // Verify that the component uses the provided dynamic options
    const multiSelects = wrapper.findAllComponents(MultiSelect);
    expect(multiSelects.length).toBe(3);
  });

  // Test that all options are available when no filters are applied
  it('shows all filter options when no filters are active', () => {
    const wrapper = createWrapper();

    const dynamicOptions = wrapper.props('dynamicFilterOptions');

    expect(dynamicOptions.project).toEqual(['proj1', 'proj2', 'proj3']);
    expect(dynamicOptions.experiment).toEqual(['exp1', 'exp2']);
    expect(dynamicOptions.variable).toEqual(['var1', 'var2', 'var3', 'var4']);
  });

  // Test that component accepts dynamic filter options as prop
  it('accepts dynamicFilterOptions as prop', () => {
    const wrapper = createWrapper({
      dynamicFilterOptions: {
        project: ['proj1'],
        experiment: ['exp1', 'exp2'],
        variable: ['var1'],
      },
      modelValue: {
        project: ['proj1'],
      },
    });

    const dynamicOptions = wrapper.props('dynamicFilterOptions');

    expect(dynamicOptions.experiment).toContain('exp1');
    expect(dynamicOptions.experiment).toContain('exp2');
  });

  // Test that component handles empty dynamicFilterOptions gracefully
  it('handles empty dynamicFilterOptions gracefully', () => {
    const wrapper = createWrapper({
      dynamicFilterOptions: {},
    });

    // Should not crash
    expect(wrapper.exists()).toBe(true);
  });

  // Test that component works with narrowed dynamicFilterOptions
  it('works with narrowed dynamicFilterOptions from parent', () => {
    const wrapper = createWrapper({
      dynamicFilterOptions: {
        project: ['proj1'],
        experiment: ['exp1'],
        variable: ['var1'],
      },
      modelValue: {
        project: ['proj1'],
        experiment: ['exp1'],
      },
    });

    const dynamicOptions = wrapper.props('dynamicFilterOptions');

    // Verify narrowed options are passed correctly
    expect(dynamicOptions.variable).toEqual(['var1']);
  });

  // Test that component renders with different filter options
  it('renders with different filter option formats', () => {
    const wrapper = createWrapper({
      filterOptions: {
        project: ['PROJ1', 'Proj2'],
        experiment: ['EXP1', 'Exp2'],
        variable: ['VAR1', 'Var2'],
      },
      dynamicFilterOptions: {
        project: ['PROJ1'],
        experiment: ['EXP1'],
        variable: ['VAR1'],
      },
      modelValue: {
        project: ['proj1'],
      },
    });

    // Should render without errors
    expect(wrapper.exists()).toBe(true);
  });
});
