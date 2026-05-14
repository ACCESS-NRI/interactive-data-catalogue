import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { buildFilterQuery, parseFiltersFromQuery, useFilterUrlSync } from '../useFilterUrlSync';

describe('useFilterUrlSync', () => {
  it('parses *_filter query params into filter maps', () => {
    expect(
      parseFiltersFromQuery({
        realm_filter: 'atmos,ocean',
        frequency_filter: 'day',
        ignored: 'value',
      } as never),
    ).toEqual({
      realm: ['atmos', 'ocean'],
      frequency: ['day'],
    });
  });

  it('serializes filter maps back into query params', () => {
    expect(
      buildFilterQuery({
        realm: ['atmos', 'ocean'],
        frequency: ['day'],
        variable: [],
      }),
    ).toEqual({
      realm_filter: 'atmos,ocean',
      frequency_filter: 'day',
    });
  });

  it('initializes from route query and syncs updates back to router', async () => {
    const route = {
      query: { realm_filter: 'atmos,ocean' },
      name: 'DatastoreDetail',
      params: { name: 'woa23' },
    } as any;
    const router = {
      replace: vi.fn(),
    } as any;
    const currentFilters = ref({});

    const { initializeFiltersFromUrl, stopFilterWatcher } = useFilterUrlSync(route, router, currentFilters);
    initializeFiltersFromUrl();

    expect(currentFilters.value).toEqual({ realm: ['atmos', 'ocean'] });

    currentFilters.value = { frequency: ['day'] };
    await nextTick();

    expect(router.replace).toHaveBeenCalledWith({
      name: 'DatastoreDetail',
      params: { name: 'woa23' },
      query: { frequency_filter: 'day' },
    });

    stopFilterWatcher();
  });

  it('uses fallbackRouteName when route.name is null', async () => {
    const route = {
      query: {},
      name: null,
      params: {},
    } as any;
    const router = { replace: vi.fn() } as any;
    const currentFilters = ref({});

    const { initializeFiltersFromUrl, stopFilterWatcher } = useFilterUrlSync(
      route,
      router,
      currentFilters,
      'DatastoreDetail',
    );
    initializeFiltersFromUrl();

    currentFilters.value = { realm: ['atmos'] };
    await nextTick();

    expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({ name: 'DatastoreDetail' }));

    stopFilterWatcher();
  });
});
