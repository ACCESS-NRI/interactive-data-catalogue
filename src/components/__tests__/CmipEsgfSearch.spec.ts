import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import CmipEsgfSearch from '../CmipEsgfSearch.vue';
import { checkNciAvailability, searchEsgf, type EsgfPage } from '../../services/esgfSearch';

vi.mock('../../services/esgfSearch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/esgfSearch')>()),
  searchEsgf: vi.fn(),
  checkNciAvailability: vi.fn(),
}));
const page: EsgfPage = {
  total: 1,
  next: null,
  datasets: [
    {
      id: 'CMIP6.test.v20250101',
      project: 'CMIP6',
      version: '20250101',
      facets: { source_id: ['TestModel'], variable_id: ['tas'] },
      nodes: ['test.example.org'],
      fileCount: 1,
      size: 1024,
      portalUrl: 'https://esgf-ui.ceda.ac.uk/search',
    },
  ],
};
let wrapper: VueWrapper;
const tick = async () => {
  await vi.advanceTimersByTimeAsync(400);
  await flushPromises();
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(searchEsgf).mockResolvedValue(page);
  vi.mocked(checkNciAvailability).mockResolvedValue({ status: 'missing', collections: [] });
  wrapper = mount(CmipEsgfSearch, {
    props: { project: 'CMIP6', filters: {} },
  });
});
afterEach(() => {
  wrapper.unmount();
  vi.useRealTimers();
});

describe('opt-in ESGF results', () => {
  it.each(['listed', 'version-unverified', 'different-version', 'unknown', 'checking'] as const)(
    'does not offer replication when NCI availability is %s',
    async (status) => {
      vi.mocked(checkNciAvailability).mockResolvedValue({
        status,
        collections: ['listed', 'version-unverified', 'different-version'].includes(status) ? ['cmip6_oi10'] : [],
      });
      await wrapper.get('input[type=checkbox]').setValue(true);
      await tick();
      expect(wrapper.find('tbody tr').exists()).toBe(true);
      expect(wrapper.text()).not.toContain('Prepare replication request');
      expect(wrapper.text()).not.toContain('Replication requests are not available yet.');
      expect(wrapper.find('a[href="https://esgf-ui.ceda.ac.uk/search"]').exists()).toBe(true);
    },
  );

  it('switches between NCI only, ESGF only and Both, suspending external searches in NCI-only mode', async () => {
    await wrapper.get('input[type=checkbox]').setValue(true);
    await tick();
    expect(wrapper.get('input[value=both]').element).toHaveProperty('checked', true);
    expect(wrapper.get('[aria-label="ESGF results"]').text()).toContain('ESGF · International datasets');
    const oldSignal = vi.mocked(searchEsgf).mock.calls[0]![2];
    await wrapper.get('input[value=nci]').setValue(true);
    await tick();
    expect(wrapper.find('[aria-label="ESGF results"]').exists()).toBe(false);
    expect(oldSignal.aborted).toBe(true);
    expect(searchEsgf).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('update:view')?.slice(-1)[0]).toEqual(['nci']);
    await wrapper.get('input[value=esgf]').setValue(true);
    await tick();
    expect(wrapper.get('[aria-label="ESGF results"]').text()).toContain('CMIP6.test.v20250101');
    expect(wrapper.emitted('update:view')?.slice(-1)[0]).toEqual(['esgf']);
    await wrapper.get('input[value=both]').setValue(true);
    await tick();
    expect(wrapper.emitted('update:view')?.slice(-1)[0]).toEqual(['both']);
  });

  it('makes no network calls until checked and shows a message instead of a replication action', async () => {
    await tick();
    expect(searchEsgf).not.toHaveBeenCalled();
    await wrapper.get('input[type=checkbox]').setValue(true);
    await tick();
    expect(wrapper.text()).toContain('Not found in NCI catalogue');
    expect(wrapper.get('tbody tr').text()).toContain('Replication requests are not available yet.');
    expect(wrapper.get('tbody tr').findAll('button')).toHaveLength(0);
    expect(wrapper.find('[role=dialog]').exists()).toBe(false);
    expect(wrapper.find('textarea').exists()).toBe(false);
    expect(wrapper.find('a[href="https://help.nci.org.au"]').exists()).toBe(false);
    expect(wrapper.find('a[href="https://esgf-ui.ceda.ac.uk/search"]').exists()).toBe(true);
  });

  it('aborts and discards stale results after filters change', async () => {
    let resolve!: (value: EsgfPage) => void;
    vi.mocked(searchEsgf).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await wrapper.get('input[type=checkbox]').setValue(true);
    await tick();
    const oldSignal = vi.mocked(searchEsgf).mock.calls[0]![2];
    await wrapper.setProps({ filters: { source_id: ['DifferentModel'] } });
    resolve(page);
    await flushPromises();
    expect(oldSignal.aborted).toBe(true);
    expect(wrapper.text()).not.toContain('CMIP6.test.v20250101');
    vi.mocked(searchEsgf).mockResolvedValueOnce({ total: 0, next: null, datasets: [] });
    await tick();
    expect(wrapper.text()).toContain('No ESGF datasets match');
  });

  it('clears results and cancels searches when unchecked', async () => {
    await wrapper.get('input[type=checkbox]').setValue(true);
    await tick();
    const oldSignal = vi.mocked(searchEsgf).mock.calls[0]![2];
    await wrapper.get('input[type=checkbox]').setValue(false);
    await tick();
    expect(oldSignal.aborted).toBe(true);
    expect(wrapper.text()).not.toContain('CMIP6.test.v20250101');
    expect(searchEsgf).toHaveBeenCalledTimes(1);
  });

  it('does not perform a broader search when a local-only filter is selected', async () => {
    await wrapper.setProps({ filters: { file_type: ['f'] } });
    await wrapper.get('input[type=checkbox]').setValue(true);
    await tick();
    expect(searchEsgf).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('ESGF cannot apply these filters: file_type');
  });

  it('preserves NCI access and offers retry when ESGF fails', async () => {
    vi.mocked(searchEsgf).mockRejectedValueOnce(new Error('Service unavailable'));
    await wrapper.get('input[type=checkbox]').setValue(true);
    await tick();
    expect(wrapper.get('[role=alert]').text()).toContain('Your NCI results are still available below');
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Retry search')!
      .trigger('click');
    await tick();
    expect(wrapper.text()).toContain('CMIP6.test.v20250101');
    expect(wrapper.find('[role=alert]').exists()).toBe(false);
  });

  it('appends another page and groups duplicate replicas across pages', async () => {
    vi.mocked(searchEsgf).mockResolvedValueOnce({ ...page, next: '10', total: 20 });
    await wrapper.get('input[type=checkbox]').setValue(true);
    await tick();
    vi.mocked(searchEsgf).mockResolvedValueOnce({
      ...page,
      datasets: [{ ...page.datasets[0]!, nodes: ['replica.example.org'] }],
    });
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Load more ESGF results')!
      .trigger('click');
    await tick();
    expect(vi.mocked(searchEsgf).mock.calls[1]![3]).toBe('10');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.text()).toContain('test.example.org, replica.example.org');
  });
});
