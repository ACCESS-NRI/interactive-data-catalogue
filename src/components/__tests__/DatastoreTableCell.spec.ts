import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DatastoreTableCell from '../DatastoreTableCell.vue';

const createWrapper = (field: string, value: any, header = 'Header') =>
  mount(DatastoreTableCell, { props: { field, header, value } });

describe('DatastoreTableCell', () => {
  describe('variable field (array)', () => {
    it('renders up to 3 variable badges', () => {
      const wrapper = createWrapper('variable', ['tas', 'pr', 'ua']);
      const badges = wrapper.findAll('.bg-cyan-100');
      expect(badges.length).toBe(3);
    });

    it('renders +N more button when more than 3 items', () => {
      const wrapper = createWrapper('variable', ['tas', 'pr', 'ua', 'hus', 'zg']);
      expect(wrapper.text()).toContain('+2 more');
    });

    it('emits open-modal when +N more is clicked', async () => {
      const wrapper = createWrapper('variable', ['a', 'b', 'c', 'd'], 'Variables');
      const moreBtn = wrapper.find('[role="button"]');
      await moreBtn.trigger('click');
      expect(wrapper.emitted('open-modal')).toBeTruthy();
      expect(wrapper.emitted('open-modal')![0]).toEqual(['Variables', ['a', 'b', 'c', 'd']]);
    });

    it('does not render +N more when 3 or fewer items', () => {
      const wrapper = createWrapper('variable', ['tas', 'pr']);
      expect(wrapper.text()).not.toContain('more');
    });
  });

  describe('variable_units field (array)', () => {
    it('renders up to 2 unit badges', () => {
      const wrapper = createWrapper('variable_units', ['K', 'm/s']);
      const spans = wrapper.findAll('.bg-cyan-100');
      expect(spans.length).toBe(2);
    });

    it('renders +N more button when more than 2 items', () => {
      const wrapper = createWrapper('variable_units', ['K', 'm/s', 'Pa'], 'Units');
      expect(wrapper.text()).toContain('+1 more');
    });

    it('emits open-modal when +N more clicked on variable_units', async () => {
      const wrapper = createWrapper('variable_units', ['K', 'm/s', 'Pa', 'W/m2'], 'Units');
      const moreBtn = wrapper.find('[role="button"]');
      await moreBtn.trigger('click');
      expect(wrapper.emitted('open-modal')).toBeTruthy();
    });

    it('does not render +N more when 2 or fewer items', () => {
      const wrapper = createWrapper('variable_units', ['K']);
      expect(wrapper.text()).not.toContain('more');
    });
  });

  describe('frequency field', () => {
    it('renders frequency badge with green styling', () => {
      const wrapper = createWrapper('frequency', 'monthly');
      const badge = wrapper.find('.bg-green-100');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toBe('monthly');
    });

    it('renders dash when frequency value is falsy', () => {
      const wrapper = createWrapper('frequency', null);
      expect(wrapper.text()).toContain('-');
    });
  });

  describe('realm field', () => {
    it('renders realm badge with gray styling', () => {
      const wrapper = createWrapper('realm', 'atmos');
      const badge = wrapper.find('.bg-gray-100');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toBe('atmos');
    });
  });

  describe('variable_long_name / variable_standard_name / variable_cell_methods fields', () => {
    it('renders array items truncated at 40 chars when longer', () => {
      const longName = 'A very long variable name that exceeds 40 characters definitely';
      const wrapper = createWrapper('variable_long_name', [longName]);
      expect(wrapper.text()).toContain(longName.substring(0, 40));
      expect(wrapper.text()).toContain('...');
    });

    it('renders short array items without truncation', () => {
      const wrapper = createWrapper('variable_standard_name', ['air_temperature']);
      expect(wrapper.text()).toContain('air_temperature');
    });

    it('renders dash for empty/null items in array', () => {
      const wrapper = createWrapper('variable_cell_methods', [null]);
      expect(wrapper.text()).toContain('-');
    });

    it('renders +N more for arrays with more than 2 items', () => {
      const wrapper = createWrapper('variable_long_name', ['a', 'b', 'c'], 'Long Names');
      expect(wrapper.text()).toContain('+1 more');
    });

    it('emits open-modal when +N more clicked for long name array', async () => {
      const items = ['a', 'b', 'c'];
      const wrapper = createWrapper('variable_long_name', items, 'Long Names');
      const btn = wrapper.find('[role="button"]');
      await btn.trigger('click');
      expect(wrapper.emitted('open-modal')).toBeTruthy();
    });

    it('renders scalar (non-array) value via displayValue', () => {
      const wrapper = createWrapper('variable_long_name', 'scalar long name');
      expect(wrapper.text()).toContain('scalar long name');
    });
  });

  describe('fallback field', () => {
    it('renders plain text for unknown fields', () => {
      const wrapper = createWrapper('unknown_field', 'plain value');
      expect(wrapper.text()).toContain('plain value');
    });

    it('renders dash for null fallback value', () => {
      const wrapper = createWrapper('unknown_field', null);
      expect(wrapper.text()).toContain('-');
    });

    it('emits "Details" as fallback title when header prop is empty', async () => {
      // openModal emits `title || 'Details'` — empty header triggers the fallback
      const wrapper = createWrapper('variable', ['a', 'b', 'c', 'd'], '');
      const moreBtn = wrapper.find('[role="button"]');
      await moreBtn.trigger('click');
      expect(wrapper.emitted('open-modal')![0][0]).toBe('Details');
    });
  });
});
