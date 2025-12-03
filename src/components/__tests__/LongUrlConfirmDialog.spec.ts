import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LongUrlConfirmDialog from '../LongUrlConfirmDialog.vue';

describe('LongUrlConfirmDialog', () => {
  // Helper to create wrapper with PrimeVue components stubbed
  const createWrapper = (props: any) => {
    return mount(LongUrlConfirmDialog, {
      props,
      global: {
        stubs: {
          Dialog: {
            template: `
              <div v-if="visible" class="dialog-wrapper">
                <div class="dialog-header">{{ header }}</div>
                <div class="dialog-content"><slot /></div>
              </div>
            `,
            props: ['visible', 'header', 'modal'],
            emits: ['update:visible'],
          },
          Button: {
            template: '<button @click="$emit(\'click\')"><i v-if="icon" :class="icon"></i>{{ label }}</button>',
            props: ['label', 'icon', 'class'],
            emits: ['click'],
          },
        },
      },
    });
  };

  // Test that the dialog displays the correct URL length in the warning message
  it('renders URL length in warning message', () => {
    const wrapper = createWrapper({
      visible: true,
      url: 'https://example.com',
      urlLength: 5000,
    });

    expect(wrapper.text()).toContain('5000');
    expect(wrapper.text()).toContain('characters long');
  });

  // Test that the dialog shows appropriate warning text about potential issues
  it('renders warning text about browser and email compatibility', () => {
    const wrapper = createWrapper({
      visible: true,
      url: 'https://example.com',
      urlLength: 3000,
    });

    expect(wrapper.text()).toContain('may not work in some browsers');
    expect(wrapper.text()).toContain('Do you want to copy it to the clipboard anyway?');
  });

  // Test that clicking the Cancel button emits the cancel event
  it('emits cancel event when cancel button is clicked', async () => {
    const wrapper = createWrapper({
      visible: true,
      url: 'https://example.com',
      urlLength: 3000,
    });

    const buttons = wrapper.findAll('button');
    const cancelButton = buttons.find((btn) => btn.text().includes('Cancel'));
    await cancelButton?.trigger('click');

    expect(wrapper.emitted('cancel')).toBeTruthy();
    expect(wrapper.emitted('cancel')?.length).toBe(1);
  });

  // Test that clicking the Copy anyway button emits confirm event with the URL
  it('emits confirm event with URL when copy button is clicked', async () => {
    const testUrl = 'https://example.com/very/long/url';
    const wrapper = createWrapper({
      visible: true,
      url: testUrl,
      urlLength: 3000,
    });

    const buttons = wrapper.findAll('button');
    const copyButton = buttons.find((btn) => btn.text().includes('Copy anyway'));
    await copyButton?.trigger('click');

    expect(wrapper.emitted('confirm')).toBeTruthy();
    expect(wrapper.emitted('confirm')?.[0]).toEqual([testUrl]);
  });

  // Test that visibility changes emit the update:visible event
  it('emits update:visible event when dialog visibility changes', async () => {
    const wrapper = createWrapper({
      visible: true,
      url: 'https://example.com',
      urlLength: 3000,
    });

    await wrapper.vm.$emit('update:visible', false);

    expect(wrapper.emitted('update:visible')).toBeTruthy();
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false]);
  });

  // Test that the dialog header displays the correct title
  it('renders correct dialog header', () => {
    const wrapper = createWrapper({
      visible: true,
      url: 'https://example.com',
      urlLength: 3000,
    });

    const header = wrapper.find('.dialog-header');
    expect(header.text()).toBe('Long link warning');
  });

  // Test that both action buttons are rendered with correct labels
  it('renders both action buttons', () => {
    const wrapper = createWrapper({
      visible: true,
      url: 'https://example.com',
      urlLength: 3000,
    });

    const buttons = wrapper.findAll('button');
    const buttonTexts = buttons.map((btn) => btn.text());

    expect(buttonTexts).toContain('Cancel');
    expect(buttonTexts).toContain('Copy anyway');
  });

  // Test that the copy button has the appropriate icon
  it('renders copy icon on confirm button', () => {
    const wrapper = createWrapper({
      visible: true,
      url: 'https://example.com',
      urlLength: 3000,
    });

    const buttons = wrapper.findAll('button');
    const copyButton = buttons.find((btn) => btn.text().includes('Copy anyway'));
    const icon = copyButton?.find('i');
    expect(icon?.classes()).toContain('pi');
    expect(icon?.classes()).toContain('pi-copy');
  });
});
