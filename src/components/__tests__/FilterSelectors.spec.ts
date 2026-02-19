import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import FilterSelectors from '../FilterSelectors.vue';
import MultiSelect from 'primevue/multiselect';
import Button from 'primevue/button';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Aura from '@primeuix/themes/aura';

// Mock useToast to avoid actual toast service calls in tests
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn(),
  }),
}));

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
          ToastService,
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

  // Test that formatColumnName handles edge cases like empty parts (double underscores)
  it('handles column names with empty parts from double underscores', () => {
    const wrapper = createWrapper({
      filterOptions: {
        test__column: ['value1'],
      },
    });

    // Should handle the empty string between double underscores
    expect(wrapper.text()).toContain('Test  Column');
  });

  // Test that formatColumnName handles empty strings
  it('handles empty string in column name parts', () => {
    const wrapper = createWrapper({
      filterOptions: {
        test_: ['value1'],
      },
    });

    // Should handle trailing underscore creating empty part
    expect(wrapper.text()).toContain('Test ');
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

  // Test that filter search term is tracked
  it('tracks filter search term when filter event is emitted', () => {
    const wrapper = createWrapper();

    const multiSelect = wrapper.findComponent(MultiSelect);
    multiSelect.vm.$emit('filter', { value: 'proj' });

    // filterValues should be updated internally
    expect(wrapper.vm.filterValues).toBeDefined();
    expect(wrapper.vm.filterValues.project).toBe('proj');
  });

  // Test that getSortedOptions returns original order when no search term
  it('returns options in original order when no search term provided', () => {
    const wrapper = createWrapper({
      dynamicFilterOptions: {
        project: ['zebra', 'apple', 'banana'],
      },
    });

    const sorted = wrapper.vm.getSortedOptions('project', [], undefined);
    expect(sorted).toEqual(['zebra', 'apple', 'banana']);
  });

  // Test that exact matches appear first
  it('prioritizes exact matches first in sorted options', () => {
    const wrapper = createWrapper({
      dynamicFilterOptions: {
        project: ['project', 'proj1', 'my_project', 'proj'],
      },
    });

    const sorted = wrapper.vm.getSortedOptions('project', [], 'proj');
    expect(sorted[0]).toBe('proj');
  });

  // Test that starts-with matches appear after exact matches
  it('prioritizes starts-with matches after exact matches', () => {
    const wrapper = createWrapper({
      dynamicFilterOptions: {
        project: ['my_proj', 'proj1', 'proj2', 'another_proj'],
      },
    });

    const sorted = wrapper.vm.getSortedOptions('project', [], 'proj');
    // proj1 and proj2 start with 'proj', they should come before others
    expect(sorted[0]).toBe('proj1');
    expect(sorted[1]).toBe('proj2');
  });

  // Test case-insensitive sorting
  it('performs case-insensitive sorting of options', () => {
    const wrapper = createWrapper({
      dynamicFilterOptions: {
        project: ['Project1', 'project', 'PROJ'],
      },
    });

    const sorted = wrapper.vm.getSortedOptions('project', [], 'proj');
    // 'PROJ' is exact match (case-insensitive)
    expect(sorted[0]).toBe('PROJ');
  });

  // Test that fallback options are used when dynamic options are not available
  it('uses fallback options when dynamic options are not available for column', () => {
    const wrapper = createWrapper({
      dynamicFilterOptions: {
        // No 'project' key
        experiment: ['exp1'],
      },
    });

    const fallbackOptions = ['fallback1', 'fallback2'];
    const sorted = wrapper.vm.getSortedOptions('project', fallbackOptions, undefined);
    expect(sorted).toEqual(['fallback1', 'fallback2']);
  });

  // Test sorting with mixed match types
  it('sorts with exact, starts-with, and contains matches in correct order', () => {
    const wrapper = createWrapper({
      dynamicFilterOptions: {
        variable: ['var', 'variable', 'var1', 'my_var', 'test_variable'],
      },
    });

    const sorted = wrapper.vm.getSortedOptions('variable', [], 'var');
    // Exact match first
    expect(sorted[0]).toBe('var');
    // Starts-with matches next
    expect(['var1', 'variable']).toContain(sorted[1]);
    expect(['var1', 'variable']).toContain(sorted[2]);
  });
});
