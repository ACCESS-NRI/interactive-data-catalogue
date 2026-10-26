import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CmipEsmvalcoreQuickStart from '../CmipEsmvalcoreQuickStart.vue';

describe('CmipEsmvalcoreQuickStart', () => {
  it.each(['CMIP6', 'CMIP7'] as const)(
    'updates the %s example as filters change and copies the current code',
    async (project) => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      const wrapper = mount(CmipEsmvalcoreQuickStart, {
        props: {
          project,
          datastoreName: project === 'CMIP7' ? 'cmip7_australian' : 'cmip6_fs38',
          requiredProjects: ['xp65', 'zz99'],
          currentFilters: { variable_id: ['tas'], product: ['model-output'] },
        },
        global: {
          stubs: {
            Button: { template: '<button @click="$emit(\'click\')">{{ label }}</button>', props: ['label'] },
            RequiredProjectsWarning: true,
            highlightjs: { template: '<pre>{{ code }}</pre>', props: ['code'] },
          },
        },
      });

      expect(wrapper.text()).toContain('Alternative quick start: ESMValCore');
      expect(wrapper.findComponent({ name: 'RequiredProjectsWarning' }).props()).toMatchObject({
        projects: ['xp65', 'zz99'],
        datastoreName: project === 'CMIP7' ? 'cmip7_australian' : 'cmip6_fs38',
      });
      expect(wrapper.text()).not.toContain('Search locally configured');
      expect(wrapper.text()).not.toContain('local data source');
      expect(wrapper.text()).toContain('short_name="tas"');
      expect(wrapper.text()).toContain(
        'You will need to run this in an ARE session on Gadi: https://are.nci.org.au/pun/sys/dashboard',
      );
      expect(wrapper.text()).toContain('not included as ESMValCore facets: product');

      await wrapper.setProps({ currentFilters: { variable_id: ['pr'] } });
      expect(wrapper.text()).toContain('short_name="pr"');
      expect(wrapper.text()).not.toContain('not included as ESMValCore facets');

      await wrapper.find('button').trigger('click');
      await flushPromises();
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('short_name="pr"'));
      expect(wrapper.find('button').text()).toBe('Copied');
    },
  );
});
