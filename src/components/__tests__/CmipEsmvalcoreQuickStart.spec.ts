import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import CmipEsmvalcoreQuickStart from '../CmipEsmvalcoreQuickStart.vue';
import type { FilterMap } from '../../types/datastore';

describe('CmipEsmvalcoreQuickStart', () => {
  afterEach(() => vi.restoreAllMocks());

  const createWrapper = (
    project: 'CMIP6' | 'CMIP7',
    currentFilters: FilterMap = { variable_id: ['tas'], product: ['model-output'] },
  ) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/datastore/:name', name: 'DatastoreDetail', component: { template: '<div />' } },
      ],
    });
    return mount(CmipEsmvalcoreQuickStart, {
      props: {
        project,
        datastoreName: project === 'CMIP7' ? 'cmip7_australian' : 'cmip6_fs38',
        requiredProjects: ['xp65', 'zz99'],
        currentFilters,
      },
      global: {
        plugins: [router],
        stubs: {
          Button: { template: '<button @click="$emit(\'click\')">{{ label }}</button>', props: ['label'] },
          LongUrlConfirmDialog: true,
          RequiredProjectsWarning: true,
          highlightjs: { template: '<pre>{{ code }}</pre>', props: ['code'] },
        },
      },
    });
  };

  it.each(['CMIP6', 'CMIP7'] as const)(
    'updates the %s example as filters change and copies the current code',
    async (project) => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      const wrapper = createWrapper(project);

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
      expect(wrapper.text()).toContain('not included in the ESMValCore search: product');

      await wrapper.setProps({ currentFilters: { variable_id: ['pr'] } });
      expect(wrapper.text()).toContain('short_name="pr"');
      expect(wrapper.text()).not.toContain('not included in the ESMValCore search');

      expect(wrapper.text()).toContain('Copy Link to Search');
      expect(wrapper.text()).toContain('Copy Code and Open ARE Session');

      await wrapper.findAll('button')[0]!.trigger('click');
      await flushPromises();
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('short_name="pr"'));
      expect(wrapper.findAll('button')[0]!.text()).toBe('Copied');
    },
  );

  it('copies a link to the current datastore search', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const wrapper = createWrapper('CMIP7');

    await wrapper.findAll('button')[1]!.trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/datastore/cmip7_australian?'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('variable_id_filter=tas'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('product_filter=model-output'));
    expect(wrapper.findAll('button')[1]!.text()).toBe('Link copied');
  });

  it('copies the ESMValCore code before opening ARE', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const wrapper = createWrapper('CMIP6');

    await wrapper.findAll('button')[2]!.trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('project="CMIP6"'));
    expect(open).toHaveBeenCalledWith('https://are.nci.org.au/pun/sys/dashboard', '_blank');
    expect(writeText.mock.invocationCallOrder[0]).toBeLessThan(open.mock.invocationCallOrder[0]!);
  });

  it('asks before copying an unusually long search link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const wrapper = createWrapper('CMIP7', { variable_id: ['x'.repeat(2200)], product: [] });

    await wrapper.findAll('button')[1]!.trigger('click');
    const dialog = wrapper.findComponent({ name: 'LongUrlConfirmDialog' });
    expect(dialog.props('visible')).toBe(true);
    expect(writeText).not.toHaveBeenCalled();

    await dialog.vm.$emit('confirm', dialog.props('url'));
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('variable_id_filter='));
    expect(dialog.props('visible')).toBe(false);
  });

  it('updates and copies the CMIP7 YAML recipe as filters change', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const wrapper = createWrapper('CMIP7');

    expect(wrapper.text()).toContain('ESMValTool recipe (.yml)');
    expect(wrapper.text()).toContain('select one Realm, Branded Variable');
    expect(wrapper.text()).toContain('not included in the recipe: product');
    await wrapper.setProps({
      currentFilters: {
        variable_id: ['tas'],
        branded_variable: ['tas_tavg-h2m-hxy-u'],
        realm: ['atmos'],
        source_id: ['ACCESS-ESM1-6'],
      },
    });
    expect(wrapper.text()).not.toContain('Before running, select');
    expect(wrapper.text()).not.toContain('not included in the recipe');

    await wrapper.findAll('button')[3]!.trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('dataset: "ACCESS-ESM1-6"'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('branding_suffix: "tavg-h2m-hxy-u"'));
    expect(wrapper.findAll('button')[3]!.text()).toBe('Recipe copied');

    await wrapper.setProps({ currentFilters: { variable_id: ['pr'] } });
    expect(wrapper.findAll('button')[3]!.text()).toBe('Copy recipe (.yml)');
  });

  it('copies the YAML recipe before opening ARE', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const wrapper = createWrapper('CMIP6', { variable_id: ['tas'], table_id: ['Amon'] });

    await wrapper.findAll('button')[4]!.trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('project: "CMIP6"'));
    expect(open).toHaveBeenCalledWith('https://are.nci.org.au/pun/sys/dashboard', '_blank');
    expect(writeText.mock.invocationCallOrder[0]).toBeLessThan(open.mock.invocationCallOrder[0]!);
  });
});
