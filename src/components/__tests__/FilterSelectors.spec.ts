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
    rawData: [
      { project: 'proj1', experiment: 'exp1', variable: 'var1' },
      { project: 'proj2', experiment: 'exp2', variable: 'var2' },
      { project: 'proj3', experiment: 'exp1', variable: 'var3' },
    ],
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

  // Test that dynamic filter options exclude values that would result in zero results
  it('computes dynamic filter options based on other active filters', () => {
    const wrapper = createWrapper({
      modelValue: {
        project: ['proj1'],
      },
    });

    // With project='proj1' selected, only exp1 should be available in experiment filter
    const vm = wrapper.vm as any;
    const dynamicOptions = vm.dynamicFilterOptions;

    expect(dynamicOptions.experiment).toEqual(['exp1']);
    expect(dynamicOptions.variable).toEqual(['var1']);
  });

  // Test that all options are available when no filters are applied
  it('shows all filter options when no filters are active', () => {
    const wrapper = createWrapper();

    const vm = wrapper.vm as any;
    const dynamicOptions = vm.dynamicFilterOptions;

    expect(dynamicOptions.project).toEqual(['proj1', 'proj2', 'proj3']);
    expect(dynamicOptions.experiment).toEqual(['exp1', 'exp2']);
    expect(dynamicOptions.variable).toEqual(['var1', 'var2', 'var3']);
  });

  // Test that filters work correctly with array cell values
  it('handles array values in data cells', () => {
    const wrapper = createWrapper({
      rawData: [
        { project: 'proj1', experiment: ['exp1', 'exp2'], variable: 'var1' },
        { project: 'proj2', experiment: ['exp2'], variable: 'var2' },
      ],
      modelValue: {
        project: ['proj1'],
      },
    });

    const vm = wrapper.vm as any;
    const dynamicOptions = vm.dynamicFilterOptions;

    // With proj1 selected, both exp1 and exp2 should be available
    expect(dynamicOptions.experiment).toContain('exp1');
    expect(dynamicOptions.experiment).toContain('exp2');
  });

  // Test that null and undefined values are handled gracefully
  it('handles null and undefined values in data', () => {
    const wrapper = createWrapper({
      rawData: [
        { project: 'proj1', experiment: null, variable: undefined },
        { project: 'proj2', experiment: 'exp2', variable: 'var2' },
      ],
    });

    const vm = wrapper.vm as any;
    const dynamicOptions = vm.dynamicFilterOptions;

    // Should not crash and should still compute valid options
    expect(dynamicOptions.project).toContain('proj1');
    expect(dynamicOptions.project).toContain('proj2');
  });

  // Test that multiple filters work together to narrow down options
  it('narrows down options correctly with multiple active filters', () => {
    const wrapper = createWrapper({
      rawData: [
        { project: 'proj1', experiment: 'exp1', variable: 'var1' },
        { project: 'proj1', experiment: 'exp2', variable: 'var2' },
        { project: 'proj2', experiment: 'exp1', variable: 'var3' },
      ],
      modelValue: {
        project: ['proj1'],
        experiment: ['exp1'],
      },
    });

    const vm = wrapper.vm as any;
    const dynamicOptions = vm.dynamicFilterOptions;

    // With proj1 AND exp1 selected, only var1 should be available
    expect(dynamicOptions.variable).toEqual(['var1']);
  });

  // Test that filter matching is case-insensitive
  it('performs case-insensitive filtering', () => {
    const wrapper = createWrapper({
      filterOptions: {
        project: ['PROJ1', 'Proj2'],
        experiment: ['EXP1', 'Exp2'],
        variable: ['VAR1', 'Var2'],
      },
      rawData: [
        { project: 'PROJ1', experiment: 'EXP1', variable: 'VAR1' },
        { project: 'Proj2', experiment: 'Exp2', variable: 'Var2' },
      ],
      modelValue: {
        project: ['proj1'],
      },
    });

    const vm = wrapper.vm as any;
    const dynamicOptions = vm.dynamicFilterOptions;

    // Should match 'proj1' to 'PROJ1' case-insensitively
    expect(dynamicOptions.experiment).toEqual(['EXP1']);
  });
});
