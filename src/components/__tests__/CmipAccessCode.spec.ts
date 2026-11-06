import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import CmipAccessCode from '../CmipAccessCode.vue';

let wrapper: VueWrapper;
const writeText = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText);
  wrapper = mount(CmipAccessCode, {
    props: { project: 'CMIP6', filters: { variable_id: ['tas'], table_id: ['Amon'] }, nciOnly: false },
    global: {
      directives: { tooltip: {} },
      stubs: { highlightjs: { props: ['code'], template: '<pre>{{ code }}</pre>' } },
    },
  });
});
afterEach(() => {
  wrapper.unmount();
  vi.restoreAllMocks();
});
const button = (label: string) => wrapper.findAll('button').find((item) => item.text() === label)!;
const tab = (label: string) => wrapper.findAll('[role=tab]').find((item) => item.text() === label)!;

describe('shared CMIP access panel', () => {
  it('copies intake code using both collections and selected filters, and explains local scope', async () => {
    expect(wrapper.text()).toContain('Your search is on ESGF.');
    await button('Copy Intake + Xarray code').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('["cmip6_fs38","cmip6_oi10"]'));
    expect(writeText.mock.lastCall![0]).toContain('"tas"');
    expect(writeText.mock.lastCall![0]).toContain('Storage: gdata/xp65+gdata/fs38+gdata/oi10');
    expect(writeText.mock.lastCall![0]).toContain('Modules: conda/analysis3');
    expect(button('Code copied').exists()).toBe(true);
    await wrapper.setProps({ project: 'CMIP7', filters: { branded_variable: ['tas_tavg-h2m-hxy-u'] }, nciOnly: true });
    expect(wrapper.text()).not.toContain('Your search is on ESGF.');
    expect(wrapper.text()).toContain('Use your current CMIP7 search filters');
    await button('Copy Intake + Xarray code').trigger('click');
    await flushPromises();
    expect(writeText.mock.lastCall![0]).toContain('["cmip7_australian","cmip7_replicated"]');
    expect(writeText.mock.lastCall![0]).not.toContain('cmip6_fs38');
  });

  it('switches code tabs by keyboard and copies both-location ESMValCore code', async () => {
    await tab('Intake + Xarray').trigger('keydown', { key: 'ArrowRight' });
    expect(tab('ESMValCore').attributes('aria-selected')).toBe('true');
    await button('Copy ESMValCore code').trigger('click');
    await flushPromises();
    expect(writeText.mock.lastCall![0]).toContain('CFG["search_data"] = "complete"');
    expect(writeText.mock.lastCall![0]).toContain('/g/data/oi10/replicas');
  });

  it('copies the matching recipe, data-source configuration and run command separately', async () => {
    await tab('ESMValTool').trigger('click');
    await button('Copy recipe').trigger('click');
    await flushPromises();
    expect(writeText.mock.lastCall![0]).toContain('short_name: "tas"');
    await button('Copy configuration').trigger('click');
    await flushPromises();
    expect(writeText.mock.lastCall![0]).toContain('search_data: complete');
    expect(writeText.mock.lastCall![0]).toContain('/g/data/fs38/publications');
    expect(writeText.mock.lastCall![0]).toContain('/g/data/oi10/replicas');
    await button('Copy run command').trigger('click');
    await flushPromises();
    expect(writeText.mock.lastCall![0]).toBe(
      'esmvaltool run --config_dir ./cmip-config --remove_preproc_dir=False recipe_cmip.yml',
    );
  });

  it('prevents copying code that would drop unsupported filters', async () => {
    await wrapper.setProps({ filters: { version: ['v20260101'] } });
    await tab('ESMValCore').trigger('click');
    expect(button('Copy ESMValCore code').attributes('disabled')).toBeDefined();
    await tab('ESMValTool').trigger('click');
    expect(button('Copy recipe').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Remove these filters to generate a matching recipe: version');
  });

  it('reports clipboard failures and allows another attempt', async () => {
    writeText.mockRejectedValueOnce(new Error('Clipboard unavailable'));
    await button('Copy Intake + Xarray code').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role=alert]').text()).toContain('Could not copy');
    await button('Copy Intake + Xarray code').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role=alert]').exists()).toBe(false);
  });
});
