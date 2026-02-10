import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DatastoreEntryModal from '../DatastoreEntryModal.vue';

describe('DatastoreEntryModal', () => {
  // Helper to create wrapper with PrimeVue components stubbed
  const createWrapper = (props: any) => {
    return mount(DatastoreEntryModal, {
      props,
      global: {
        stubs: {
          InputText: {
            template: '<input v-model="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['modelValue'],
          },
          Button: {
            template: '<button @click="$emit(\'click\')"><slot /></button>',
            props: ['label', 'icon'],
          },
        },
      },
    });
  };

  // Test that the modal is hidden when modelValue is false
  it('does not render when modelValue is false', () => {
    const wrapper = createWrapper({
      modelValue: false,
      items: ['item1'],
    });

    expect(wrapper.find('.fixed.inset-0').exists()).toBe(false);
  });

  // Test that the modal is visible when modelValue is true
  it('renders when modelValue is true', () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: ['item1'],
    });

    expect(wrapper.find('.fixed.inset-0').exists()).toBe(true);
  });

  // Test that the title prop is displayed in the modal header
  it('renders title when provided', () => {
    const wrapper = createWrapper({
      modelValue: true,
      title: 'Test Modal Title',
      items: ['item1'],
    });

    expect(wrapper.text()).toContain('Test Modal Title');
  });

  // Test that items are rendered as chips in the modal
  it('renders items as chips', () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: ['item1', 'item2', 'item3'],
    });

    expect(wrapper.text()).toContain('item1');
    expect(wrapper.text()).toContain('item2');
    expect(wrapper.text()).toContain('item3');
  });

  // Test that clicking the X button in header emits update:modelValue with false
  it('emits update:modelValue false when X button clicked', async () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: ['item1'],
    });

    const closeButton = wrapper.find('button'); // First button is the X
    await closeButton.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
  });

  // Test that clicking the Close button in footer emits update:modelValue with false
  it('emits update:modelValue false when Close button clicked', async () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: ['item1'],
    });

    const buttons = wrapper.findAll('button');
    const closeButton = buttons[buttons.length - 1]; // Last button is the Close button
    expect(closeButton).toBeDefined();
    await closeButton!.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
  });

  // Test that query is cleared when modal is closed
  it('clears search query when modal is closed', async () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: ['item1'],
    });

    const input = wrapper.find('input');
    await input.setValue('test query');

    // Close the modal
    const closeButton = wrapper.find('button'); // First button is the X
    await closeButton.trigger('click');

    // Reopen the modal
    await wrapper.setProps({ modelValue: true });

    // The input should be cleared
    expect(wrapper.find('input').element.value).toBe('');
  });

  // Test that clicking the backdrop emits update:modelValue with false
  it('emits update:modelValue false when backdrop clicked', async () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: ['item1'],
    });

    const backdrop = wrapper.find('.bg-black.bg-opacity-50');
    await backdrop.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
  });

  // Test that the filter input correctly filters items
  it('filters items based on search query', async () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: ['apple', 'banana', 'cherry'],
    });

    const input = wrapper.find('input');
    await input.setValue('ban');

    // Only 'banana' should be visible after filtering
    const chips = wrapper.findAll('span').filter((span) => span.classes().includes('px-2'));
    expect(chips.length).toBe(1);
    expect(chips[0]?.text()).toContain('banana');
  });

  // Test that "No results" is displayed when filter matches no items
  it('shows "No results" when filter matches nothing', async () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: ['apple', 'banana'],
    });

    const input = wrapper.find('input');
    await input.setValue('xyz');

    expect(wrapper.text()).toContain('No results');
  });

  // Test that single non-array item is converted to an array
  it('handles single non-array item', () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: 'single-item',
    });

    expect(wrapper.text()).toContain('single-item');
  });

  // Test that empty array shows "No results"
  it('shows "No results" for empty items array', () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: [],
    });

    expect(wrapper.text()).toContain('No results');
  });

  // Test that null/undefined items are handled gracefully
  it('handles null items gracefully', () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: null,
    });

    expect(wrapper.text()).toContain('No results');
  });

  // Test that object items are formatted as JSON strings
  it('formats object items as JSON', () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: [{ key: 'value' }],
    });

    const chip = wrapper.findAll('span').find((span) => span.classes().includes('px-2'));
    expect(chip?.attributes('title')).toContain('"key"');
    expect(chip?.attributes('title')).toContain('"value"');
  });

  // Test that long item text is truncated with ellipsis in display
  it('truncates long items with ellipsis', () => {
    const longItem = 'a'.repeat(50);
    const wrapper = createWrapper({
      modelValue: true,
      items: [longItem],
    });

    const chip = wrapper.findAll('span').find((span) => span.classes().includes('px-2'));
    expect(chip?.text()).toContain('...');
    expect(chip?.text().length).toBeLessThan(longItem.length);
  });

  // Test that full text is available in the title attribute for truncated items
  it('provides full text in title attribute for truncated items', () => {
    const longItem = 'a'.repeat(50);
    const wrapper = createWrapper({
      modelValue: true,
      items: [longItem],
    });

    const chip = wrapper.findAll('span').find((span) => span.classes().includes('px-2'));
    expect(chip?.attributes('title')).toBe(longItem);
  });

  // Test that filter is case-insensitive
  it('performs case-insensitive filtering', async () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: ['Apple', 'BANANA', 'cherry'],
    });

    const input = wrapper.find('input');
    await input.setValue('APPLE');

    const chips = wrapper.findAll('span').filter((span) => span.classes().includes('px-2'));
    expect(chips.length).toBe(1);
    expect(chips[0]?.text()).toContain('Apple');
  });

  // NOTE: Implementation detail / snapshot test - liable to change with styling updates
  // Test that modal has proper layout and styling classes
  it('applies correct layout classes', () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: ['item1'],
    });

    const modal = wrapper.find('.bg-white');
    expect(modal.exists()).toBe(true);
    expect(modal.classes()).toContain('bg-white');
    expect(modal.classes()).toContain('dark:bg-gray-800');
    expect(modal.classes()).toContain('rounded-lg');
    expect(modal.classes()).toContain('shadow-lg');
    expect(modal.classes()).toContain('max-w-2xl');
  });

  // NOTE: Implementation detail / snapshot test - liable to change with styling updates
  // Test that chips have correct styling classes
  it('applies correct chip styling classes', () => {
    const wrapper = createWrapper({
      modelValue: true,
      items: ['item1'],
    });

    const chip = wrapper.findAll('span').find((span) => span.classes().includes('px-2'));
    expect(chip?.classes()).toContain('px-2');
    expect(chip?.classes()).toContain('py-1');
    expect(chip?.classes()).toContain('bg-cyan-100');
    expect(chip?.classes()).toContain('dark:bg-cyan-900');
    expect(chip?.classes()).toContain('text-cyan-800');
    expect(chip?.classes()).toContain('dark:text-cyan-200');
    expect(chip?.classes()).toContain('rounded');
    expect(chip?.classes()).toContain('text-sm');
    expect(chip?.classes()).toContain('font-medium');
  });
});
