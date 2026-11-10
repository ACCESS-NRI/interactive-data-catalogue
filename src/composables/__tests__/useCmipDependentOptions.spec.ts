import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, ref, type Ref } from 'vue';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { useCmipDependentOptions, type CmipFacetContext } from '../useCmipDependentOptions';
import { fetchCmipNciOptions } from '../../services/cmipSearch';
import { fetchEsgfFilterOptions } from '../../services/esgfSearch';
import type { FilterMap, FilterOptions } from '../../types/datastore';

vi.mock('../../services/cmipSearch', async (original) => ({
  ...(await original<typeof import('../../services/cmipSearch')>()),
  fetchCmipNciOptions: vi.fn(),
}));
vi.mock('../../services/esgfSearch', () => ({ fetchEsgfFilterOptions: vi.fn() }));

const rows = [
  { variable_id: 'tas', branded_variable: 'tas_tavg', realm: 'atmos', source_id: 'ACCESS-ESM1-6', frequency: 'mon' },
  { variable_id: 'tas', branded_variable: 'tas_tmax', realm: 'atmos', source_id: 'OtherModel', frequency: 'day' },
  { variable_id: 'pr', branded_variable: 'pr_tavg', realm: 'atmos', source_id: 'ACCESS-ESM1-6', frequency: 'day' },
  { variable_id: 'tos', branded_variable: 'tos_tavg', realm: 'ocean', source_id: 'ACCESS-ESM1-6', frequency: 'mon' },
  { variable_id: 'so', branded_variable: 'so_tavg', realm: 'ocean', source_id: 'OtherModel', frequency: 'mon' },
];
function choices(filters: FilterMap = {}): FilterOptions {
  const matching = rows.filter((row) =>
    Object.entries(filters).every(([field, values]) => values.includes(row[field as keyof typeof row])),
  );
  return Object.fromEntries(
    Object.keys(rows[0]!).map((field) => [field, [...new Set(matching.map((row) => row[field as keyof typeof row]))]]),
  );
}
let wrapper: VueWrapper;
let context: Ref<CmipFacetContext | null>;
let state: ReturnType<typeof useCmipDependentOptions>;
function render(overrides: Partial<CmipFacetContext> = {}) {
  context = ref({ project: 'CMIP7', nci: true, filters: {}, accessOnly: false, baseOptions: choices(), ...overrides });
  wrapper = mount(
    defineComponent({
      setup() {
        state = useCmipDependentOptions(context);
        return () => null;
      },
    }),
  );
}
async function settle() {
  await nextTick();
  await vi.advanceTimersByTimeAsync(201);
  await flushPromises();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.mocked(fetchCmipNciOptions).mockImplementation(async (_project, _signal, filters) => choices(filters));
  vi.mocked(fetchEsgfFilterOptions).mockImplementation(async (_project, _signal, filters) => choices(filters));
});
afterEach(() => {
  wrapper?.unmount();
  vi.useRealTimers();
});

describe('dependent CMIP choices', () => {
  it('reuses complete options without requesting unfiltered catalogues again', async () => {
    render();
    await settle();
    expect(state.options.value).toEqual(choices());
    expect(fetchCmipNciOptions).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'narrows branding and realm from tas, keeping other variable choices (NCI=%s)',
    async (nci) => {
      render({ nci, filters: { variable_id: ['tas'] } });
      expect(state.loading.value).toBe(true);
      expect(state.options.value).toEqual({});
      await settle();
      expect(state.options.value.branded_variable).toEqual(['tas_tavg', 'tas_tmax']);
      expect(state.options.value.realm).toEqual(['atmos']);
      expect(state.options.value.variable_id).toEqual(['tas', 'pr', 'tos', 'so']);
      expect(nci ? fetchCmipNciOptions : fetchEsgfFilterOptions).toHaveBeenCalledWith(
        'CMIP7',
        expect.any(AbortSignal),
        { variable_id: ['tas'] },
      );
      expect(nci ? fetchEsgfFilterOptions : fetchCmipNciOptions).not.toHaveBeenCalled();
    },
  );

  it('uses all other fields, allowing OR within a field and AND between fields', async () => {
    render({ filters: { realm: ['ocean'], variable_id: ['tos', 'so'] } });
    await settle();
    expect(state.options.value.variable_id).toEqual(['tos', 'so']);
    expect(state.options.value.branded_variable).toEqual(['tos_tavg', 'so_tavg']);
    expect(state.options.value.frequency).toEqual(['mon']);
    context.value!.filters = { realm: ['atmos'], variable_id: ['tas', 'pr'] };
    await settle();
    expect(state.options.value.branded_variable).toEqual(['tas_tavg', 'tas_tmax', 'pr_tavg']);
    expect(state.options.value.variable_id).toEqual(['tas', 'pr']);
  });

  it('keeps ACCESS scope when excluding a selected model, without broadening conflicting selections', async () => {
    render({ accessOnly: true, filters: { source_id: ['OtherModel'], realm: ['ocean'] } });
    await settle();
    expect(state.options.value.variable_id ?? []).toEqual([]);
    expect(state.options.value.source_id).toEqual(['ACCESS-ESM1-6']);
    expect(
      vi.mocked(fetchCmipNciOptions).mock.calls.every((call) => call[2]?.source_id?.includes('ACCESS-ESM1-6')),
    ).toBe(true);
    context.value!.filters = { realm: ['ocean'] };
    await settle();
    expect(state.options.value.variable_id).toEqual(['tos']);
    expect(state.options.value.source_id).toEqual(['ACCESS-ESM1-6']);
  });

  it('preserves conflicting URL selections and restores broader choices when a filter is cleared', async () => {
    render({ filters: { variable_id: ['tas'], branded_variable: ['tos_tavg'] } });
    await settle();
    expect(context.value!.filters).toEqual({ variable_id: ['tas'], branded_variable: ['tos_tavg'] });
    expect(state.options.value.variable_id).toEqual(['tos']);
    expect(state.options.value.branded_variable).toEqual(['tas_tavg', 'tas_tmax']);
    context.value!.filters = {};
    await settle();
    expect(state.options.value).toEqual(choices());
  });

  it('debounces changes and reuses completed queries while separating era and search location caches', async () => {
    render({ filters: { variable_id: ['tas'] } });
    context.value!.filters = { realm: ['ocean'] };
    await settle();
    expect(fetchCmipNciOptions).toHaveBeenCalledTimes(1);
    context.value!.filters = { realm: [] };
    await settle();
    context.value!.filters = { realm: ['ocean'] };
    await settle();
    expect(fetchCmipNciOptions).toHaveBeenCalledTimes(1);
    context.value!.project = 'CMIP6';
    await settle();
    expect(fetchCmipNciOptions).toHaveBeenCalledTimes(2);
    context.value!.nci = false;
    await settle();
    expect(fetchEsgfFilterOptions).toHaveBeenCalledWith('CMIP6', expect.any(AbortSignal), { realm: ['ocean'] });
  });

  it('aborts stale responses and supports retry without showing stale choices after failure', async () => {
    let resolve!: (options: FilterOptions) => void;
    vi.mocked(fetchCmipNciOptions).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    render({ filters: { variable_id: ['tas'] } });
    await settle();
    const previousSignal = vi.mocked(fetchCmipNciOptions).mock.calls[0]![1];
    context.value!.nci = false;
    vi.mocked(fetchEsgfFilterOptions).mockRejectedValueOnce(new Error('Facet service offline'));
    await settle();
    resolve(choices({ variable_id: ['tas'] }));
    await flushPromises();
    expect(previousSignal.aborted).toBe(true);
    expect(state.options.value).toEqual({});
    expect(state.error.value).toBe('Facet service offline');
    expect(state.loading.value).toBe(false);
    await state.retry();
    expect(state.error.value).toBe('');
    expect(state.options.value.branded_variable).toEqual(['tas_tavg', 'tas_tmax']);
    wrapper.unmount();
    expect(vi.mocked(fetchEsgfFilterOptions).mock.lastCall![1].aborted).toBe(true);
  });
});
