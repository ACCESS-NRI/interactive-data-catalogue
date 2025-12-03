import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DatastoreHeader from '../DatastoreHeader.vue';

describe('DatastoreHeader', () => {
  // Test that the datastoreName prop is rendered correctly in the header
  it('renders datastore name', () => {
    const wrapper = mount(DatastoreHeader, {
      props: {
        datastoreName: 'test-datastore',
      },
    });

    expect(wrapper.text()).toContain('ESM Datastore: test-datastore');
  });

  // Test that totalRecords prop is displayed with proper formatting
  it('renders total records with locale formatting', () => {
    const wrapper = mount(DatastoreHeader, {
      props: {
        datastoreName: 'test-datastore',
        totalRecords: 1234567,
      },
    });

    expect(wrapper.text()).toContain('1,234,567');
  });

  // Test that the component handles undefined totalRecords gracefully
  it('renders without totalRecords when not provided', () => {
    const wrapper = mount(DatastoreHeader, {
      props: {
        datastoreName: 'test-datastore',
      },
    });

    expect(wrapper.text()).toContain('test-datastore');
    // Should not throw an error when totalRecords is undefined
    expect(wrapper.html()).toBeTruthy();
  });

  // Test that the intake-esm documentation link is present with correct attributes
  it('renders intake-esm documentation link', () => {
    const wrapper = mount(DatastoreHeader, {
      props: {
        datastoreName: 'test-datastore',
      },
    });

    const link = wrapper.find('a[href="https://intake-esm.readthedocs.io/"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.text()).toContain('intake-esm Documentation');
  });

  // Test that the ACCESS-NRI documentation link is present with correct attributes
  it('renders ACCESS-NRI documentation link', () => {
    const wrapper = mount(DatastoreHeader, {
      props: {
        datastoreName: 'test-datastore',
      },
    });

    const link = wrapper.find('a[href="https://access-nri-intake-catalog.readthedocs.io/"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.text()).toContain('ACCESS-NRI Intake Documentation');
  });

  // Test that both documentation links are rendered
  it('renders both documentation links', () => {
    const wrapper = mount(DatastoreHeader, {
      props: {
        datastoreName: 'test-datastore',
      },
    });

    const links = wrapper.findAll('a');
    expect(links.length).toBe(2);
  });

  // Test that the description text includes the datastore name
  it('includes datastore name in description', () => {
    const wrapper = mount(DatastoreHeader, {
      props: {
        datastoreName: 'my-special-datastore',
        totalRecords: 100,
      },
    });

    expect(wrapper.text()).toContain('Detailed view of the my-special-datastore ESM datastore');
  });

  // Test that zero records is handled correctly
  it('handles zero records correctly', () => {
    const wrapper = mount(DatastoreHeader, {
      props: {
        datastoreName: 'test-datastore',
        totalRecords: 0,
      },
    });

    expect(wrapper.text()).toContain('containing 0 records');
  });

  // Test that the component has the correct layout structure classes
  it('applies correct layout classes', () => {
    const wrapper = mount(DatastoreHeader, {
      props: {
        datastoreName: 'test-datastore',
      },
    });

    const container = wrapper.find('div.flex');
    expect(container.exists()).toBe(true);
    expect(container.classes()).toContain('flex-col');
    expect(container.classes()).toContain('lg:flex-row');
  });
});
