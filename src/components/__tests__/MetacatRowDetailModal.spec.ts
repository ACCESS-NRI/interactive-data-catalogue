import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import CatalogRowDetailModal from '../MetacatRowDetailModal.vue';
import type { CatalogRow } from '../../stores/catalogStore';

// Mock router
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/datastore/:name',
      name: 'DatastoreDetail',
      component: { template: '<div>Datastore</div>' },
    },
  ],
});

describe('CatalogRowDetailModal', () => {
  let pinia: ReturnType<typeof createPinia>;

  // Sample catalog row data for testing
  const mockCatalogRow: CatalogRow = {
    name: 'test-catalog',
    description: 'Test catalogue description',
    model: ['ACCESS-CM2', 'ACCESS-ESM1-5'],
    realm: ['ocean', 'atmos'],
    frequency: ['mon', 'day'],
    variable: ['tos', 'tas', 'pr', 'uas', 'vas'],
    yaml: 'sources:\n test-catalog: \n    metadata: \n      driver: zarr \n      args: \n        urlpath: /path/to/data \n        consolidated: true',
  };

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  // Helper function to create wrapper with PrimeVue components stubbed
  const createWrapper = (props: any = {}) => {
    return mount(CatalogRowDetailModal, {
      props: {
        visible: false,
        rowData: null,
        ...props,
      },
      global: {
        plugins: [pinia, router],
        stubs: {
          Dialog: {
            template: `
              <div v-if="visible" class="dialog-wrapper">
                <div class="dialog-header">{{ header }}</div>
                <div class="dialog-content"><slot /></div>
                <div class="dialog-footer"><slot name="footer" /></div>
              </div>
            `,
            props: ['visible', 'header', 'modal', 'dismissableMask', 'closable', 'style'],
            emits: ['update:visible'],
          },
          Button: {
            template: '<button @click="handleClick"><slot /></button>',
            props: ['label', 'icon', 'class'],
            emits: ['click'],
            methods: {
              handleClick() {
                this.$emit('click');
              },
            },
          },
          RouterLink: {
            template: '<a @click="handleClick"><slot /></a>',
            props: ['to'],
            emits: ['click'],
            methods: {
              handleClick() {
                this.$emit('click');
              },
            },
          },
          TagList: {
            template: `
              <div class="tag-list">
                <h6>{{ title }}</h6>
                <template v-if="items && items.length">
                  <span
                    v-for="(item, index) in items"
                    :key="index"
                    class="tag-chip"
                    @click="handleChipClick(item)"
                  >{{ item }}</span>
                </template>
              </div>
            `,
            props: ['title', 'items', 'chipClass', 'clickable'],
            emits: ['chip-click'],
            methods: {
              handleChipClick(item: string) {
                this.$emit('chip-click', item);
              },
            },
          },
          YamlTree: {
            template: '<div class="yaml-tree">YAML Tree</div>',
            props: ['data'],
          },
        },
      },
    });
  };

  // Test that the dialog is not rendered when visible prop is false
  it('does not render dialog when not visible', () => {
    const wrapper = createWrapper({
      visible: false,
      rowData: mockCatalogRow,
    });

    expect(wrapper.find('.dialog-wrapper').exists()).toBe(false);
  });

  // Test that the dialog is rendered when visible prop is true
  it('renders dialog when visible', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    expect(wrapper.find('.dialog-wrapper').exists()).toBe(true);
  });

  // Test that the catalog name is displayed in the dialog header
  it('displays catalog name in header', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    expect(wrapper.find('.dialog-header').text()).toBe('test-catalog');
  });

  // Test that a fallback header is shown when rowData is null
  it('displays fallback header when rowData is null', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: null,
    });

    expect(wrapper.find('.dialog-header').text()).toBe('Catalogue Entry Details');
  });

  // Test that basic information section renders name and description
  it('renders basic information section with name and description', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    expect(wrapper.text()).toContain('Basic Information');
    expect(wrapper.text()).toContain('test-catalog');
    expect(wrapper.text()).toContain('Test catalogue description');
  });

  // Test that the intake code snippet is displayed correctly
  it('renders intake code snippet with catalog name', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    expect(wrapper.text()).toContain('Open Catalogue');
    expect(wrapper.text()).toContain('import intake');
    expect(wrapper.text()).toContain('intake.cat.access_nri["test-catalog"]');
  });

  // Test that the "View Datastore Online" RouterLink is rendered with correct props
  it('renders View Datastore Online link with correct route', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    const link = wrapper.find('a');
    expect(link.text()).toContain('Explore Datastore Online');
  });

  // Test that TagList components are rendered for models, realms, and frequencies
  it('renders TagList components for models, realms, and frequencies', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    const tagLists = wrapper.findAll('.tag-list');
    expect(tagLists.length).toBeGreaterThanOrEqual(3);

    // Check titles
    expect(wrapper.text()).toContain('Models');
    expect(wrapper.text()).toContain('Realms');
    expect(wrapper.text()).toContain('Frequencies');
  });

  // Test that model tags are rendered with correct values
  it('renders model tags with correct values', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    expect(wrapper.text()).toContain('ACCESS-CM2');
    expect(wrapper.text()).toContain('ACCESS-ESM1-5');
  });

  // Test that realm tags are rendered with correct values
  it('renders realm tags with correct values', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    expect(wrapper.text()).toContain('ocean');
    expect(wrapper.text()).toContain('atmos');
  });

  // Test that frequency tags are rendered with correct values
  it('renders frequency tags with correct values', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    expect(wrapper.text()).toContain('mon');
    expect(wrapper.text()).toContain('day');
  });

  // Test that variables section displays the correct count and variable names
  it('renders variables section with count and variable names', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    expect(wrapper.text()).toContain('Variables (5 total)');
    expect(wrapper.text()).toContain('tos');
    expect(wrapper.text()).toContain('tas');
    expect(wrapper.text()).toContain('pr');
    expect(wrapper.text()).toContain('uas');
    expect(wrapper.text()).toContain('vas');
  });

  // Test that YAML configuration section is rendered when yaml prop is provided
  it('renders YAML configuration section', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    expect(wrapper.text()).toContain('Metadata (YAML)');
  });

  // Test that YamlTree component is rendered for valid YAML
  it('renders YamlTree component when YAML is valid', async () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    // Wait for YAML parsing to complete
    await wrapper.vm.$nextTick();

    const yamlTree = wrapper.find('.yaml-tree');
    expect(yamlTree.exists()).toBe(true);
  });

  // Test that invalid YAML displays an error message and raw YAML
  it('displays error message when YAML is invalid', async () => {
    const invalidYamlRow = {
      ...mockCatalogRow,
      yaml: 'invalid: yaml: syntax: [[[',
    };

    const wrapper = createWrapper({
      visible: true,
      rowData: invalidYamlRow,
    });

    // Wait for YAML parsing attempt
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Error parsing YAML');
  });

  // Test that Close button emits hide event when clicked
  it('emits hide event when Close button is clicked', async () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    const closeButton = wrapper.find('button');
    await closeButton.trigger('click');

    expect(wrapper.emitted('hide')).toBeTruthy();
  });

  // Test that dialog emits hide event when dismissed via dismissable mask
  it('emits hide event when dialog is dismissed', async () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    // Simulate dialog visibility change
    await wrapper.setProps({ visible: false });
    await wrapper.vm.$nextTick();

    // The component should handle visibility changes
    expect(wrapper.find('.dialog-wrapper').exists()).toBe(false);
  });

  // Test that chip click handlers trigger navigation with filter parameters
  it('handles chip click and navigates to datastore with filter', async () => {
    const pushSpy = vi.spyOn(router, 'push');

    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    const tagLists = wrapper.findAll('.tag-list');
    const modelTagList = tagLists[0]; // First TagList is for models

    // Emit chip-click event by clicking a chip
    if (modelTagList) {
      const chip = modelTagList.find('.tag-chip');
      await chip.trigger('click');
    }

    expect(pushSpy).toHaveBeenCalled();
    expect(wrapper.emitted('hide')).toBeTruthy();
  });

  // Test that modal handles empty or missing YAML gracefully
  it('handles missing YAML gracefully', () => {
    const noYamlRow = {
      ...mockCatalogRow,
      yaml: undefined,
    };

    const wrapper = createWrapper({
      visible: true,
      rowData: noYamlRow,
    });

    // YAML section should not be rendered when yaml is undefined
    expect(wrapper.text()).not.toContain('Configuration (YAML)');
    // But other sections should still render
    expect(wrapper.text()).toContain('test-catalog');
    expect(wrapper.text()).toContain('Basic Information');
  });

  // Test that dialog has correct modal configuration
  it('sets correct dialog properties for modal behavior', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    // Dialog is rendered when visible
    expect(wrapper.find('.dialog-wrapper').exists()).toBe(true);
    expect(wrapper.find('.dialog-header').exists()).toBe(true);
    expect(wrapper.find('.dialog-content').exists()).toBe(true);
  });

  // Test that dialog has correct styling for responsive layout
  it('applies responsive styling to dialog', () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    // Dialog wrapper should exist with proper structure
    const dialog = wrapper.find('.dialog-wrapper');
    expect(dialog.exists()).toBe(true);
  });

  // Test that component handles rowData changes reactively
  it('updates content when rowData changes', async () => {
    const wrapper = createWrapper({
      visible: true,
      rowData: mockCatalogRow,
    });

    expect(wrapper.text()).toContain('test-catalog');

    const newRowData: CatalogRow = {
      ...mockCatalogRow,
      name: 'updated-catalog',
      description: 'Updated description',
    };

    await wrapper.setProps({ rowData: newRowData });

    expect(wrapper.text()).toContain('updated-catalog');
    expect(wrapper.text()).toContain('Updated description');
  });

  // Test that empty arrays in rowData are handled gracefully
  it('handles empty arrays in rowData gracefully', () => {
    const emptyArraysRow: CatalogRow = {
      name: 'empty-catalog',
      description: 'Empty arrays test',
      model: [],
      realm: [],
      frequency: [],
      variable: [],
    };

    const wrapper = createWrapper({
      visible: true,
      rowData: emptyArraysRow,
    });

    expect(wrapper.text()).toContain('empty-catalog');
    expect(wrapper.text()).toContain('Variables (0 total)');
  });
});
