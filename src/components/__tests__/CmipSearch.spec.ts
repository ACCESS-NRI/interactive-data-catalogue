import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import CmipSearch from '../CmipSearch.vue';
import CmipAccessCode from '../CmipAccessCode.vue';
import FilterSelectors from '../FilterSelectors.vue';
import { checkNciAvailability, fetchEsgfFilterOptions, searchEsgf } from '../../services/esgfSearch';
import { fetchCmipNciOptions, fetchCmipNciPage } from '../../services/cmipSearch';
import { fetchCmipFilePaths } from '../../services/cmipFiles';
import type { FilterOptions, PagedDatastoreResponse } from '../../types/datastore';

vi.mock('../../services/esgfSearch', async (original) => ({
  ...(await original<typeof import('../../services/esgfSearch')>()),
  searchEsgf: vi.fn(),
  fetchEsgfFilterOptions: vi.fn(),
  checkNciAvailability: vi.fn(),
}));
vi.mock('../../services/cmipSearch', async (original) => ({
  ...(await original<typeof import('../../services/cmipSearch')>()),
  fetchCmipNciOptions: vi.fn(),
  fetchCmipNciPage: vi.fn(),
}));
vi.mock('../../services/cmipFiles', () => ({ fetchCmipFilePaths: vi.fn() }));

const options: FilterOptions = { source_id: ['ACCESS-ESM1-6', 'CanESM6-0-MR'], variable_id: ['tas', 'pr'] };
const localPage: PagedDatastoreResponse = { total: 21, records: [{ source_id: 'ACCESS-ESM1-6', variable_id: 'tas' }] };
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
async function toggle(label: string, value: boolean) {
  await wrapper.get(`input[aria-label="${label}"]`).setValue(value);
  await tick();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(searchEsgf).mockResolvedValue({ datasets: [], total: 0, next: null });
  vi.mocked(fetchEsgfFilterOptions).mockResolvedValue(options);
  vi.mocked(fetchCmipNciOptions).mockResolvedValue(options);
  vi.mocked(fetchCmipNciPage).mockResolvedValue(localPage);
  vi.mocked(fetchCmipFilePaths).mockResolvedValue({ paths: ['/g/data/example/tas.nc'], hasMore: false });
});
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
});

describe('combined CMIP discovery', () => {
  it('switches eras, retaining scopes and clearing incompatible selections and cached options', async () => {
    vi.mocked(fetchCmipNciOptions).mockImplementation(async (project) =>
      project === 'CMIP6'
        ? { source_id: ['ACCESS-CM2', 'OtherModel'], member_id: ['r1i1p1f1'], table_id: ['Amon'] }
        : options,
    );
    await render('/cmip?nci=true&access=true&branded_variable_filter=tas_tavg-h2m-hxy-u');
    const previous = vi.mocked(fetchCmipNciPage).mock.lastCall![2];
    await wrapper.get('input[name="cmip-era"][value="CMIP6"]').setValue(true);
    await tick();
    expect(previous.aborted).toBe(true);
    expect(router.currentRoute.value.query).toEqual({ project: 'CMIP6', nci: 'true', access: 'true' });
    expect(fetchCmipNciOptions).toHaveBeenCalledWith('CMIP6', expect.any(AbortSignal));
    for (const name of ['cmip6_fs38', 'cmip6_oi10']) {
      expect(fetchCmipNciPage).toHaveBeenCalledWith(
        name,
        { source_id: ['ACCESS-CM2'] },
        expect.any(AbortSignal),
        0,
        10,
      );
    }
    const filters = wrapper.findComponent(FilterSelectors);
    expect(filters.props('defaultVisibleColumns')).toContain('member_id');
    expect(filters.props('filterOptions').source_id).toEqual(['ACCESS-CM2']);
    expect(wrapper.findComponent(CmipAccessCode).props()).toMatchObject({
      project: 'CMIP6',
      filters: { source_id: ['ACCESS-CM2'] },
      nciOnly: true,
    });
    expect(wrapper.get('[aria-label="NCI results"]').text()).toContain('Table');
    await wrapper.get('input[name="cmip-era"][value="CMIP7"]').setValue(true);
    await tick();
    expect(fetchCmipNciOptions).toHaveBeenCalledTimes(2);
    expect(filters.exists()).toBe(false);
    expect(wrapper.findComponent(CmipAccessCode).props('filters')).toEqual({ source_id: ['ACCESS-ESM1-6'] });
  });

  it('restores CMIP6 ESGF search and uses CMIP6 facets in the shared code', async () => {
    await render('/cmip?project=CMIP6&nci=false&table_id_filter=Amon&member_id_filter=r1i1p1f1');
    const filters = { table_id: ['Amon'], member_id: ['r1i1p1f1'] };
    expect(searchEsgf).toHaveBeenCalledWith('CMIP6', filters, expect.any(AbortSignal), undefined);
    expect(fetchEsgfFilterOptions).toHaveBeenCalledWith('CMIP6', expect.any(AbortSignal));
    expect(wrapper.findComponent(CmipAccessCode).props()).toMatchObject({ project: 'CMIP6', filters, nciOnly: false });
    await wrapper.get('input[name="cmip-era"][value="CMIP7"]').setValue(true);
    await tick();
    expect(vi.mocked(searchEsgf).mock.lastCall?.slice(0, 2)).toEqual(['CMIP7', {}]);
  });

  it('defaults to NCI with mutually exclusive location choices and an unchecked ACCESS checkbox', async () => {
    await render();
    expect(searchEsgf).not.toHaveBeenCalled();
    expect(fetchEsgfFilterOptions).not.toHaveBeenCalled();
    expect(wrapper.get('input[name="cmip-era"]:checked').attributes('value')).toBe('CMIP7');
    expect(wrapper.findAll('input[name="cmip-location"]:checked')).toHaveLength(1);
    expect(wrapper.get('input[name="cmip-location"]:checked').attributes('value')).toBe('nci');
    expect(wrapper.findAll('input[type=checkbox]:checked')).toHaveLength(0);
    expect(fetchCmipNciOptions).toHaveBeenCalledWith('CMIP7', expect.any(AbortSignal));
    expect(fetchCmipNciPage).toHaveBeenCalledWith('cmip7_australian', {}, expect.any(AbortSignal), 0, 10);
    expect(fetchCmipNciPage).toHaveBeenCalledWith('cmip7_replicated', {}, expect.any(AbortSignal), 0, 10);
  });

  it('applies ACCESS to either location, preserves filters, and cancels the previous search', async () => {
    await render('/cmip?nci=false&variable_id_filter=tas');
    expect(wrapper.get('input[name="cmip-location"]:checked').attributes('value')).toBe('esgf');
    expect(wrapper.text()).toContain('avoid duplicate downloads');
    const firstSignal = vi.mocked(searchEsgf).mock.calls[0]![2];
    await toggle('Only ACCESS data', true);
    expect(firstSignal.aborted).toBe(true);
    expect(vi.mocked(searchEsgf).mock.lastCall?.[1]).toEqual({ variable_id: ['tas'], source_id: ['ACCESS-ESM1-6'] });
    await toggle('Search on NCI', true);
    expect(wrapper.findAll('input[name="cmip-location"]:checked')).toHaveLength(1);
    expect(wrapper.text()).not.toContain('avoid duplicate downloads');
    expect(wrapper.find('[aria-label="ESGF results"]').exists()).toBe(false);
    expect(fetchCmipNciPage).toHaveBeenCalledWith(
      'cmip7_australian',
      { variable_id: ['tas'], source_id: ['ACCESS-ESM1-6'] },
      expect.any(AbortSignal),
      0,
      10,
    );
    expect(fetchCmipNciPage).toHaveBeenCalledWith(
      'cmip7_replicated',
      { variable_id: ['tas'], source_id: ['ACCESS-ESM1-6'] },
      expect.any(AbortSignal),
      0,
      10,
    );
    expect(router.currentRoute.value.query).toMatchObject({ nci: 'true', access: 'true', variable_id_filter: 'tas' });
    await toggle('Only ACCESS data', false);
    expect(vi.mocked(fetchCmipNciPage).mock.lastCall?.[1]).toEqual({ variable_id: ['tas'] });
    const localSignal = vi.mocked(fetchCmipNciPage).mock.lastCall![2];
    await toggle('Search ESGF', true);
    expect(localSignal.aborted).toBe(true);
    expect(vi.mocked(searchEsgf).mock.lastCall?.[1]).toEqual({ variable_id: ['tas'] });
    expect(router.currentRoute.value.query).toEqual({ nci: 'false', variable_id_filter: 'tas' });
  });

  it('restores shared scope and filters, and keeps scope when filters are cleared', async () => {
    await render('/cmip?nci=true&access=true&variable_id_filter=tas');
    expect(wrapper.get('input[name="cmip-location"]:checked').attributes('value')).toBe('nci');
    expect(wrapper.findAll('input[type=checkbox]:checked')).toHaveLength(1);
    expect(searchEsgf).not.toHaveBeenCalled();
    wrapper.findComponent(FilterSelectors).vm.$emit('clear');
    await tick();
    expect(router.currentRoute.value.query).toEqual({ nci: 'true', access: 'true' });
    expect(vi.mocked(fetchCmipNciPage).mock.lastCall?.[1]).toEqual({ source_id: ['ACCESS-ESM1-6'] });
    await router.push('/cmip');
    await tick();
    expect(wrapper.findAll('input[type=checkbox]:checked')).toHaveLength(0);
    expect(vi.mocked(fetchCmipNciPage).mock.lastCall?.[1]).toEqual({});
    expect(searchEsgf).not.toHaveBeenCalled();
  });

  it('does not broaden conflicting ACCESS and model filters', async () => {
    await render('/cmip?nci=false&access=true&source_id_filter=CanESM6-0-MR');
    expect(searchEsgf).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No ACCESS models match');
    await toggle('Search on NCI', true);
    expect(fetchCmipNciPage).not.toHaveBeenCalled();
    await toggle('Only ACCESS data', false);
    expect(vi.mocked(fetchCmipNciPage).mock.lastCall?.[1]).toEqual({ source_id: ['CanESM6-0-MR'] });
  });

  it('waits for complete facets before searching ACCESS and supports retry on failure', async () => {
    vi.mocked(fetchEsgfFilterOptions).mockRejectedValueOnce(new Error('ESGF unavailable'));
    await render('/cmip?nci=false&access=true');
    expect(searchEsgf).not.toHaveBeenCalled();
    expect(wrapper.get('[role=alert]').text()).toContain('ESGF unavailable');
    await wrapper.get('[role=alert] button').trigger('click');
    await tick();
    expect(vi.mocked(searchEsgf).mock.lastCall?.[1]).toEqual({ source_id: ['ACCESS-ESM1-6'] });
  });

  it('blocks ACCESS-only local searches when local facets fail', async () => {
    vi.mocked(fetchCmipNciOptions).mockRejectedValueOnce(new Error('NCI unavailable'));
    await render('/cmip?nci=true&access=true');
    expect(fetchCmipNciPage).not.toHaveBeenCalled();
    await wrapper.get('[role=alert] button').trigger('click');
    await tick();
    expect(vi.mocked(fetchCmipNciPage).mock.lastCall?.[1]).toEqual({ source_id: ['ACCESS-ESM1-6'] });
  });

  it.each(['CMIP6', 'CMIP7'])(
    'carries an empty %s NCI search to ESGF without changing its filters',
    async (project) => {
      const model = project === 'CMIP6' ? 'ACCESS-CM2' : 'ACCESS-ESM1-6';
      vi.mocked(fetchCmipNciOptions).mockResolvedValue({ source_id: [model] });
      vi.mocked(fetchEsgfFilterOptions).mockResolvedValue({ source_id: [model] });
      vi.mocked(fetchCmipNciPage).mockResolvedValue({ total: 0, records: [] });
      await render(`/cmip?project=${project}&access=true&variable_id_filter=tas`);
      expect(wrapper.text()).toContain("Can't find it on NCI?");
      expect(searchEsgf).not.toHaveBeenCalled();
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Try searching ESGF')!
        .trigger('click');
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
      expect(wrapper.find('[aria-label="NCI results"]').exists()).toBe(false);
      expect(wrapper.get('input[name="cmip-location"]:checked').attributes('value')).toBe('esgf');
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Search on NCI')!
        .trigger('click');
      await tick();
      expect(router.currentRoute.value.query).toEqual({
        project,
        nci: 'true',
        access: 'true',
        variable_id_filter: 'tas',
      });
    },
  );

  it('does not offer the empty-result fallback before both NCI collections finish successfully', async () => {
    let reject!: (cause: Error) => void;
    vi.mocked(fetchCmipNciPage).mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    vi.mocked(fetchCmipNciPage).mockResolvedValueOnce({ total: 0, records: [] });
    await render();
    expect(wrapper.text()).not.toContain('Try searching ESGF');
    reject(new Error('NCI unavailable'));
    await tick();
    expect(wrapper.text()).toContain('NCI unavailable');
    expect(wrapper.text()).not.toContain('Try searching ESGF');
  });

  it('offers ESGF when the NCI facets contain no ACCESS models', async () => {
    vi.mocked(fetchCmipNciOptions).mockResolvedValue({ source_id: ['CanESM6-0-MR'] });
    await render('/cmip?access=true');
    expect(fetchCmipNciPage).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No ACCESS models match');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Try searching ESGF')!
      .trigger('click');
    await tick();
    expect(vi.mocked(searchEsgf).mock.lastCall?.[1]).toEqual({ source_id: ['ACCESS-ESM1-6'] });
  });

  it('combines both collections in one table, pages them together and resets when filters change', async () => {
    await render('/cmip?nci=true');
    expect(wrapper.findAll('table')).toHaveLength(1);
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.findAll('tbody tr').map((row) => row.text())).toEqual([
      expect.stringContaining('ACCESS-ESM1-6'),
      expect.stringContaining('ACCESS-ESM1-6'),
    ]);
    expect(wrapper.get('tbody').text()).not.toContain('cmip7_');
    const pagination = wrapper.get('[aria-label="NCI result pages"]');
    await pagination
      .findAll('button')
      .find((button) => button.text() === 'Next')!
      .trigger('click');
    await tick();
    for (const name of ['cmip7_australian', 'cmip7_replicated']) {
      expect(fetchCmipNciPage).toHaveBeenCalledWith(name, {}, expect.any(AbortSignal), 10, 10);
    }
    wrapper.findComponent(FilterSelectors).vm.$emit('update:modelValue', { variable_id: ['pr'] });
    await tick();
    expect(fetchCmipNciPage).toHaveBeenCalledWith(
      'cmip7_australian',
      { variable_id: ['pr'] },
      expect.any(AbortSignal),
      0,
      10,
    );
    expect(wrapper.get('[aria-label="Australian submissions at NCI"] a').attributes('href')).toContain(
      'variable_id_filter=pr',
    );
  });

  it('loads file paths inline only on expansion and clears them when the search changes', async () => {
    await render('/cmip?access=true&variable_id_filter=tas');
    expect(fetchCmipFilePaths).not.toHaveBeenCalled();
    const fileButtons = () => wrapper.findAll('tbody button');
    await fileButtons()[0]!.trigger('click');
    await vi.dynamicImportSettled();
    await tick();
    expect(fetchCmipFilePaths).toHaveBeenCalledWith(
      'cmip7_australian',
      { variable_id: ['tas'], source_id: ['ACCESS-ESM1-6'] },
      localPage.records[0],
      0,
      10,
    );
    expect(wrapper.get('[aria-label="Files for this result"]').text()).toContain('/g/data/example/tas.nc');
    expect(router.currentRoute.value.path).toBe('/cmip');
    expect(wrapper.findAllComponents(CmipAccessCode)).toHaveLength(1);
    await wrapper.get('button[aria-expanded="true"]').trigger('click');
    expect(wrapper.find('[aria-label="Files for this result"]').exists()).toBe(false);
    await fileButtons()[1]!.trigger('click');
    await tick();
    expect(vi.mocked(fetchCmipFilePaths).mock.lastCall?.[0]).toBe('cmip7_replicated');
    expect(wrapper.findAll('[aria-label="Files for this result"]')).toHaveLength(1);
    wrapper.findComponent(FilterSelectors).vm.$emit('update:modelValue', { variable_id: ['pr'] });
    await tick();
    expect(wrapper.find('[aria-label="Files for this result"]').exists()).toBe(false);
    expect(wrapper.findComponent(CmipAccessCode).props('filters')).toEqual({
      variable_id: ['pr'],
      source_id: ['ACCESS-ESM1-6'],
    });
    await fileButtons()[0]!.trigger('click');
    await tick();
    await wrapper.get('[aria-label="NCI result pages"]').findAll('button')[1]!.trigger('click');
    await tick();
    expect(wrapper.find('[aria-label="Files for this result"]').exists()).toBe(false);
  });

  it('keeps paging the larger collection after the other runs out', async () => {
    vi.mocked(fetchCmipNciPage).mockImplementation(async (name, _filters, _signal, offset = 0) => ({
      total: name === 'cmip7_australian' ? 1 : 21,
      records: name === 'cmip7_australian' && offset > 0 ? [] : localPage.records,
    }));
    await render('/cmip?nci=true');
    const next = wrapper
      .get('[aria-label="NCI result pages"]')
      .findAll('button')
      .find((button) => button.text() === 'Next')!;
    await next.trigger('click');
    await tick();
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.get('tbody').text()).toContain('ACCESS-ESM1-6');
    expect(wrapper.text()).toContain('Page 2 of 3');
    await next.trigger('click');
    await tick();
    expect(wrapper.text()).toContain('Page 3 of 3');
    expect(next.attributes('disabled')).toBeDefined();
  });

  it('shows successful collection rows but blocks paging until a failed collection is retried', async () => {
    vi.mocked(fetchCmipNciPage).mockRejectedValueOnce(new Error('Submission search unavailable'));
    await render('/cmip?nci=true');
    expect(wrapper.get('tbody').text()).toContain('ACCESS-ESM1-6');
    expect(wrapper.text()).toContain('Results are incomplete');
    const next = wrapper
      .get('[aria-label="NCI result pages"]')
      .findAll('button')
      .find((button) => button.text() === 'Next')!;
    expect(next.attributes('disabled')).toBeDefined();
    await wrapper.get('[role=alert] button').trigger('click');
    await tick();
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(next.attributes('disabled')).toBeUndefined();
  });

  it('shows local errors independently and ignores stale responses after changing scope', async () => {
    let resolve!: (page: PagedDatastoreResponse) => void;
    vi.mocked(fetchCmipNciPage).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    vi.mocked(fetchCmipNciPage).mockRejectedValueOnce(new Error('Replica search unavailable'));
    await render('/cmip?nci=true');
    expect(wrapper.get('[role=alert]').text()).toContain('Replica search unavailable');
    await wrapper.get('[role=alert] button').trigger('click');
    await tick();
    expect(wrapper.find('[role=alert]').exists()).toBe(false);
    const firstSignal = vi.mocked(fetchCmipNciPage).mock.calls[0]![2];
    await toggle('Search ESGF', true);
    resolve(localPage);
    await tick();
    expect(firstSignal.aborted).toBe(true);
    expect(wrapper.find('[aria-label="NCI results"]').exists()).toBe(false);
    expect(checkNciAvailability).not.toHaveBeenCalled();
  });
});
