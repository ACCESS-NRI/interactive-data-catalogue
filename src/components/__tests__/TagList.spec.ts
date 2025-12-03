import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TagList from '../TagList.vue';

describe('TagList', () => {
  // Helper to create wrapper with tooltip directive stubbed
  const createWrapper = (props: any) => {
    return mount(TagList, {
      props,
      global: {
        directives: {
          tooltip: {}, // Stub the PrimeVue tooltip directive
        },
      },
    });
  };

  // Test that the title prop is rendered correctly in the component
  it('renders title', () => {
    const wrapper = createWrapper({
      title: 'Test Tags',
      items: ['tag1', 'tag2'],
    });

    expect(wrapper.text()).toContain('Test Tags');
  });

  // Test that all items in the array are rendered as individual tags
  it('renders items when provided', () => {
    const wrapper = createWrapper({
      title: 'Tags',
      items: ['tag1', 'tag2', 'tag3'],
    });

    expect(wrapper.text()).toContain('Tags');
    expect(wrapper.text()).toContain('tag1');
    expect(wrapper.text()).toContain('tag2');
    expect(wrapper.text()).toContain('tag3');
    // Verify we have exactly 3 tag spans (filter by the ones with chip classes)
    const tags = wrapper.findAll('span').filter((span) => span.classes().includes('px-3'));
    expect(tags.length).toBe(3);
  });

  // Test that an em dash (—) is displayed when items array is empty
  it('renders empty state when no items', () => {
    const wrapper = createWrapper({
      title: 'Tags',
      items: [],
    });

    expect(wrapper.text()).toContain('—');
  });

  // Test that an em dash (—) is displayed when items prop is null
  it('renders empty state when items is null', () => {
    const wrapper = createWrapper({
      title: 'Tags',
      items: null,
    });

    expect(wrapper.text()).toContain('—');
  });

  // Test that default styling classes are applied when chipClass prop is not provided
  it('applies default chip class when not provided', () => {
    const wrapper = createWrapper({
      title: 'Tags',
      items: ['tag1'],
    });

    const tag = wrapper.findAll('span').find((span) => span.text() === 'tag1');
    expect(tag?.classes()).toContain('px-3');
    expect(tag?.classes()).toContain('bg-gray-100');
  });

  // Test that custom chipClass prop overrides the default styling
  it('applies custom chip class when provided', () => {
    const wrapper = createWrapper({
      title: 'Tags',
      items: ['tag1'],
      chipClass: 'custom-class',
    });

    const tag = wrapper.findAll('span').find((span) => span.text() === 'tag1');
    expect(tag?.classes()).toContain('custom-class');
  });

  // Test that clicking a tag emits the chip-click event with the correct item when clickable is true
  it('emits chip-click event when clickable and clicked', async () => {
    const wrapper = createWrapper({
      title: 'Tags',
      items: ['tag1', 'tag2'],
      clickable: true,
    });

    const tag = wrapper.findAll('span').find((span) => span.text() === 'tag1');
    await tag?.trigger('click');

    expect(wrapper.emitted('chip-click')).toBeTruthy();
    expect(wrapper.emitted('chip-click')?.[0]).toEqual(['tag1']);
  });

  // Test that clicking a tag does not emit an event when clickable is false
  it('does not emit chip-click when not clickable', async () => {
    const wrapper = createWrapper({
      title: 'Tags',
      items: ['tag1'],
      clickable: false,
    });

    const tag = wrapper.findAll('span').find((span) => span.text() === 'tag1');
    await tag?.trigger('click');

    expect(wrapper.emitted('chip-click')).toBeFalsy();
  });

  // Test that cursor-pointer and hover classes are applied when clickable is true
  it('applies cursor-pointer class when clickable', () => {
    const wrapper = createWrapper({
      title: 'Tags',
      items: ['tag1'],
      clickable: true,
    });

    const tag = wrapper.findAll('span').find((span) => span.text() === 'tag1');
    expect(tag?.classes()).toContain('cursor-pointer');
  });

  // Test that cursor-pointer class is not applied when clickable is false or undefined
  it('does not apply cursor-pointer class when not clickable', () => {
    const wrapper = createWrapper({
      title: 'Tags',
      items: ['tag1'],
      clickable: false,
    });

    const tag = wrapper.findAll('span').find((span) => span.text() === 'tag1');
    expect(tag?.classes()).not.toContain('cursor-pointer');
  });
});

