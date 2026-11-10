import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import CmipSearch from '../CmipSearch.vue';
import CmipAccessCode from '../CmipAccessCode.vue';
import FilterSelectors from '../FilterSelectors.vue';
import { checkNciAvailability, fetchEsgfFilterOptions, searchEsgf } from '../../services/esgfSearch';
import { fetchCmipNciOptions } from '../../services/cmipSearch';
import { createCmipDatasetSearch, type CmipDatasetSearch, type CmipNciDataset } from '../../services/cmipDatasets';

vi.mock('../../services/esgfSearch', async (original) => ({
  ...(await original<typeof import('../../services/esgfSearch')>()),
  searchEsgf: vi.fn(),
  fetchEsgfFilterOptions: vi.fn(),
  checkNciAvailability: vi.fn(),
}));
vi.mock('../../services/cmipSearch', async (original) => ({
  ...(await original<typeof import('../../services/cmipSearch')>()),
  fetchCmipNciOptions: vi.fn(),
}));
vi.mock('../../services/cmipDatasets', () => ({ createCmipDatasetSearch: vi.fn() }));
const options = { source_id: ['ACCESS-ESM1-6', 'CanESM6-0-MR'], variable_id: ['tas', 'pr'] };
const dataset: CmipNciDataset = {
  key: 'CMIP7/CMIP/ACCESS/model/historical/r1/glb/day/tas/tavg-h2m-hxy-u/gn/v20261019',
  id: 'CMIP7.CMIP.ACCESS.model.historical.r1.glb.day.tas.tavg-h2m-hxy-u.gn.v20261019',
  version: 'v20261019',
  facets: {
    source_id: 'ACCESS-ESM1-6',
    experiment_id: 'historical',
    variable_id: 'tas',
    table_id: 'Amon',
    grid_label: 'gn',
  },
  fileCount: 30,
  alternatePathCount: 30,
  collections: ['cmip7_australian', 'cmip7_replicated'],
  directories: ['/g/data/im55/publications/example/v20261019/'],
  timeRange: '200001 – 202912',
};
const localPage = { total: 41, datasets: [dataset] };
const page = vi.fn();
const files = vi.fn();
const dispose = vi.fn();
const session = { page, files, dispose, exportPaths: vi.fn() };
let wrapper: VueWrapper;
let router: Router;
const tick = async () => {
  await flushPromises();
  await vi.advanceTimersByTimeAsync(400);
  await flushPromises();
};
async function render(url = '/cmip') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/cmip', name: 'CmipSearch', component: CmipSearch },
      { path: '/datastore/:name', name: 'DatastoreDetail', component: { template: '<div />' } },
      { path: '/', component: { template: '<div />' } },
    ],
  });
  await router.push(url);
  wrapper = mount(CmipSearch, {
    global: { plugins: [router], stubs: { FilterSelectors: true, CmipAccessCode: true } },
  });
  await tick();
}
const button = (text: string) => wrapper.findAll('button').find((b) => b.text() === text)!;
async function toggle(label: string, value: boolean) {
  await wrapper.get(`input[aria-label="${label}"]`).setValue(value);
  await tick();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.mocked(searchEsgf).mockResolvedValue({ datasets: [], total: 0, next: null });
  vi.mocked(fetchEsgfFilterOptions).mockResolvedValue(options);
  vi.mocked(fetchCmipNciOptions).mockResolvedValue(options);
  vi.mocked(createCmipDatasetSearch).mockResolvedValue(session);
  page.mockResolvedValue(localPage);
  files.mockResolvedValue({ paths: ['/g/data/example/tas.nc'], hasMore: false });
});
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
});

describe('combined CMIP discovery', () => {
  it('shares the current NCI export session with the access panel and clears it on a new search', async () => {
    await render();
    const panel = wrapper.findComponent(CmipAccessCode);
    expect(panel.props('pathExport')).toMatchObject({ search: session, total: 41, loading: false, error: '' });
    vi.mocked(createCmipDatasetSearch).mockReturnValueOnce(new Promise(() => {}));
    wrapper.findComponent(FilterSelectors).vm.$emit('update:modelValue', { variable_id: ['tas'] });
    await tick();
    expect(panel.props('pathExport')!.search).toBeUndefined();
    expect(panel.props('pathExport')!.loading).toBe(true);
    await toggle('Search ESGF', true);
    expect(panel.props('pathExport')!.search).toBeUndefined();
  });

  it('passes dependent NCI facets to the picker and broadens choices again on clear', async () => {
    const all = { ...options, branded_variable: ['tas_tavg', 'tos_tavg'], realm: ['atmos', 'ocean'] };
    vi.mocked(fetchCmipNciOptions).mockImplementation(async (_project, _signal, selected) =>
      selected?.variable_id?.includes('tas')
        ? { ...all, branded_variable: ['tas_tavg'], realm: ['atmos'], variable_id: ['tas'] }
        : all,
    );
    await render('/cmip?variable_id_filter=tas');
    const picker = wrapper.findComponent(FilterSelectors);
    expect(picker.props('hideUnavailableOptions')).toBe(true);
    expect(picker.props('dynamicFilterOptions')).toMatchObject({
      branded_variable: ['tas_tavg'],
      realm: ['atmos'],
      variable_id: ['tas', 'pr'],
    });
    expect(wrapper.findComponent(CmipAccessCode).props('filters')).toEqual({ variable_id: ['tas'] });
    picker.vm.$emit('clear');
    await tick();
    expect(picker.props('dynamicFilterOptions').branded_variable).toEqual(['tas_tavg', 'tos_tavg']);
  });

  it('switches eras, retaining scopes and clearing incompatible selections and cached options', async () => {
    vi.mocked(fetchCmipNciOptions).mockImplementation(async (project) =>
      project === 'CMIP6'
        ? { source_id: ['ACCESS-CM2', 'OtherModel'], member_id: ['r1i1p1f1'], table_id: ['Amon'] }
        : options,
    );
    await render('/cmip?nci=true&access=true&branded_variable_filter=tas_tavg-h2m-hxy-u');
    const previous = vi.mocked(createCmipDatasetSearch).mock.lastCall![2];
    await wrapper.get('input[name="cmip-era"][value="CMIP6"]').setValue(true);
    await tick();
    expect(previous.aborted).toBe(true);
    expect(router.currentRoute.value.query).toEqual({ project: 'CMIP6', nci: 'true', access: 'true' });
    expect(createCmipDatasetSearch).toHaveBeenCalledWith(
      'CMIP6',
      { source_id: ['ACCESS-CM2'] },
      expect.any(AbortSignal),
      true,
    );
    const filters = wrapper.findComponent(FilterSelectors);
    expect(filters.props('defaultVisibleColumns')).toContain('member_id');
    expect(filters.props('filterOptions').source_id).toEqual(['ACCESS-CM2']);
    expect(wrapper.findComponent(CmipAccessCode).props()).toMatchObject({
      project: 'CMIP6',
      filters: { source_id: ['ACCESS-CM2'] },
      nciOnly: true,
    });
    await wrapper.get('input[name="cmip-era"][value="CMIP7"]').setValue(true);
    await tick();
    expect(vi.mocked(fetchCmipNciOptions).mock.calls.filter((call) => !call[2])).toHaveLength(2);
    expect(wrapper.findComponent(CmipAccessCode).props('filters')).toEqual({ source_id: ['ACCESS-ESM1-6'] });
  });

  it('restores CMIP6 ESGF search and uses CMIP6 facets in the shared code', async () => {
    await render('/cmip?project=CMIP6&nci=false&table_id_filter=Amon&member_id_filter=r1i1p1f1');
    const filters = { table_id: ['Amon'], member_id: ['r1i1p1f1'] };
    expect(searchEsgf).toHaveBeenCalledWith('CMIP6', filters, expect.any(AbortSignal), undefined);
    expect(wrapper.findComponent(CmipAccessCode).props()).toMatchObject({ project: 'CMIP6', filters, nciOnly: false });
    await wrapper.get('input[name="cmip-era"][value="CMIP7"]').setValue(true);
    await tick();
    expect(vi.mocked(searchEsgf).mock.lastCall?.slice(0, 2)).toEqual(['CMIP7', {}]);
  });

  it('defaults to NCI with mutually exclusive locations and an unchecked ACCESS checkbox', async () => {
    await render();
    expect(searchEsgf).not.toHaveBeenCalled();
    expect(fetchEsgfFilterOptions).not.toHaveBeenCalled();
    expect(wrapper.get('input[name="cmip-era"]:checked').attributes('value')).toBe('CMIP7');
    expect(wrapper.findAll('input[name="cmip-location"]:checked')).toHaveLength(1);
    expect(wrapper.get('input[name="cmip-location"]:checked').attributes('value')).toBe('nci');
    expect(wrapper.findAll('input[type=checkbox]:checked')).toHaveLength(0);
    expect(createCmipDatasetSearch).toHaveBeenCalledWith('CMIP7', {}, expect.any(AbortSignal));
    expect(page).toHaveBeenCalledWith(0, 20);
    expect(wrapper.text()).toContain('41 matching datasets');
  });

  it('applies ACCESS to either location, preserves filters, and cancels the previous search', async () => {
    await render('/cmip?nci=false&variable_id_filter=tas');
    expect(wrapper.text()).toContain('avoid duplicate downloads');
    const firstSignal = vi.mocked(searchEsgf).mock.calls[0]![2];
    await toggle('Only ACCESS data', true);
    expect(firstSignal.aborted).toBe(true);
    expect(vi.mocked(searchEsgf).mock.lastCall?.[1]).toEqual({ variable_id: ['tas'], source_id: ['ACCESS-ESM1-6'] });
    await toggle('Search on NCI', true);
    expect(wrapper.findAll('input[name="cmip-location"]:checked')).toHaveLength(1);
    expect(wrapper.text()).not.toContain('avoid duplicate downloads');
    expect(createCmipDatasetSearch).toHaveBeenCalledWith(
      'CMIP7',
      { variable_id: ['tas'], source_id: ['ACCESS-ESM1-6'] },
      expect.any(AbortSignal),
      true,
    );
    await toggle('Only ACCESS data', false);
    const localSignal = vi.mocked(createCmipDatasetSearch).mock.lastCall![2];
    await toggle('Search ESGF', true);
    expect(localSignal.aborted).toBe(true);
    expect(vi.mocked(searchEsgf).mock.lastCall?.[1]).toEqual({ variable_id: ['tas'] });
    expect(router.currentRoute.value.query).toEqual({ nci: 'false', variable_id_filter: 'tas' });
  });

  it('keeps scope when filters are cleared and restores shared filters', async () => {
    await render('/cmip?nci=true&access=true&variable_id_filter=tas');
    wrapper.findComponent(FilterSelectors).vm.$emit('clear');
    await tick();
    expect(router.currentRoute.value.query).toEqual({ nci: 'true', access: 'true' });
    expect(vi.mocked(createCmipDatasetSearch).mock.lastCall?.[1]).toEqual({ source_id: ['ACCESS-ESM1-6'] });
    await router.push('/cmip');
    await tick();
    expect(wrapper.findAll('input[type=checkbox]:checked')).toHaveLength(0);
    expect(vi.mocked(createCmipDatasetSearch).mock.lastCall?.[1]).toEqual({});
  });

  it('does not broaden conflicting ACCESS and model filters', async () => {
    await render('/cmip?nci=false&access=true&source_id_filter=CanESM6-0-MR');
    expect(searchEsgf).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No ACCESS models match');
    await toggle('Search on NCI', true);
    expect(createCmipDatasetSearch).not.toHaveBeenCalled();
    await toggle('Only ACCESS data', false);
    expect(vi.mocked(createCmipDatasetSearch).mock.lastCall?.[1]).toEqual({ source_id: ['CanESM6-0-MR'] });
  });

  it.each(['NCI', 'ESGF'])(
    'blocks ACCESS searches while %s facets are unavailable and allows retry',
    async (location) => {
      vi.mocked(location === 'NCI' ? fetchCmipNciOptions : fetchEsgfFilterOptions).mockRejectedValueOnce(
        new Error('Facets unavailable'),
      );
      await render(`/cmip?nci=${location === 'NCI'}&access=true`);
      expect(searchEsgf).not.toHaveBeenCalled();
      expect(createCmipDatasetSearch).not.toHaveBeenCalled();
      await wrapper.get('[role=alert] button').trigger('click');
      await tick();
      const call =
        location === 'NCI' ? vi.mocked(createCmipDatasetSearch).mock.lastCall : vi.mocked(searchEsgf).mock.lastCall;
      expect(call?.[1]).toEqual({ source_id: ['ACCESS-ESM1-6'] });
    },
  );

  it.each(['CMIP6', 'CMIP7'])(
    'carries an empty %s NCI search to ESGF without changing its filters',
    async (project) => {
      const model = project === 'CMIP6' ? 'ACCESS-CM2' : 'ACCESS-ESM1-6';
      vi.mocked(fetchCmipNciOptions).mockResolvedValue({ source_id: [model] });
      vi.mocked(fetchEsgfFilterOptions).mockResolvedValue({ source_id: [model] });
      page.mockResolvedValue({ total: 0, datasets: [] });
      await render(`/cmip?project=${project}&access=true&variable_id_filter=tas`);
      await button('Try searching ESGF').trigger('click');
      await tick();
      expect(router.currentRoute.value.query).toEqual({
        project,
        nci: 'false',
        access: 'true',
        variable_id_filter: 'tas',
      });
      expect(vi.mocked(searchEsgf).mock.lastCall?.slice(0, 2)).toEqual([
        project,
        { variable_id: ['tas'], source_id: [model] },
      ]);
    },
  );

  it('does not offer an empty fallback for a pending or failed dataset query and allows retry', async () => {
    let reject!: (cause: Error) => void;
    vi.mocked(createCmipDatasetSearch).mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    await render();
    expect(wrapper.text()).not.toContain('Try searching ESGF');
    reject(new Error('Replica search unavailable'));
    await tick();
    expect(wrapper.text()).not.toContain('Try searching ESGF');
    expect(wrapper.get('[role=alert]').text()).toContain('Replica search unavailable');
    await button('Retry NCI search').trigger('click');
    await tick();
    expect(wrapper.text()).toContain('41 matching datasets');
  });

  it('offers ESGF when the NCI facets contain no ACCESS models', async () => {
    vi.mocked(fetchCmipNciOptions).mockResolvedValue({ source_id: ['CanESM6-0-MR'] });
    await render('/cmip?access=true');
    expect(createCmipDatasetSearch).not.toHaveBeenCalled();
    await button('Try searching ESGF').trigger('click');
    await tick();
    expect(vi.mocked(searchEsgf).mock.lastCall?.[1]).toEqual({ source_id: ['ACCESS-ESM1-6'] });
  });

  it('pages datasets using the same grouped search and rebuilds only when filters change', async () => {
    await render();
    await button('Next').trigger('click');
    await tick();
    expect(page).toHaveBeenLastCalledWith(20, 20);
    expect(createCmipDatasetSearch).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Page 2 of 3');
    await button('Next').trigger('click');
    await tick();
    expect(button('Next').attributes('disabled')).toBeDefined();
    const oldSignal = vi.mocked(createCmipDatasetSearch).mock.lastCall![2];
    wrapper.findComponent(FilterSelectors).vm.$emit('update:modelValue', { variable_id: ['pr'] });
    await tick();
    expect(oldSignal.aborted).toBe(true);
    expect(page).toHaveBeenLastCalledWith(0, 20);
    expect(vi.mocked(createCmipDatasetSearch).mock.lastCall?.[1]).toEqual({ variable_id: ['pr'] });
  });

  it('loads every matching dataset file inline and clears expansion when the search or page changes', async () => {
    await render('/cmip?access=true&variable_id_filter=tas');
    expect(files).not.toHaveBeenCalled();
    await button('View files').trigger('click');
    await tick();
    expect(files).toHaveBeenCalledWith(dataset.key, 0, 10);
    expect(wrapper.get('[aria-label="NCI results"] code').text()).toBe(dataset.directories[0]);
    expect(wrapper.get('[aria-label="Files for this dataset"]').text()).not.toContain('alternate paths');
    expect(wrapper.get('[aria-label="Files for this dataset"]').text()).toContain('/g/data/example/tas.nc');
    expect(router.currentRoute.value.path).toBe('/cmip');
    expect(wrapper.findAllComponents(CmipAccessCode)).toHaveLength(1);
    await button('Next').trigger('click');
    await tick();
    expect(wrapper.find('[aria-label="Files for this dataset"]').exists()).toBe(false);
    await button('View files').trigger('click');
    await tick();
    wrapper.findComponent(FilterSelectors).vm.$emit('update:modelValue', { variable_id: ['pr'] });
    await tick();
    expect(wrapper.find('[aria-label="Files for this dataset"]').exists()).toBe(false);
    expect(wrapper.findComponent(CmipAccessCode).props('filters')).toEqual({
      variable_id: ['pr'],
      source_id: ['ACCESS-ESM1-6'],
    });
  });

  it('disposes an outdated search that finishes after a scope change', async () => {
    let resolve!: (search: CmipDatasetSearch) => void;
    vi.mocked(createCmipDatasetSearch).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await render();
    const signal = vi.mocked(createCmipDatasetSearch).mock.lastCall![2];
    await toggle('Search ESGF', true);
    resolve(session);
    await tick();
    expect(signal.aborted).toBe(true);
    expect(dispose).toHaveBeenCalled();
    expect(page).not.toHaveBeenCalled();
    expect(checkNciAvailability).not.toHaveBeenCalled();
  });
});
