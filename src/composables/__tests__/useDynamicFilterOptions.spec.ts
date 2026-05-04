import { describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';
import {
  buildDynamicFilterOptions,
  filterRowsBySelectedFilters,
  useDynamicFilterOptions,
} from '../useDynamicFilterOptions';

describe('useDynamicFilterOptions', () => {
  const rows = [
    { realm: ['atmos'], frequency: ['day'], variable: ['tas'] },
    { realm: ['ocean'], frequency: ['mon'], variable: ['tos'] },
    { realm: ['atmos'], frequency: ['mon'], variable: ['pr'] },
  ];

  const filterOptions = {
    realm: ['atmos', 'ocean'],
    frequency: ['day', 'mon'],
    variable: ['tas', 'tos', 'pr'],
  };

  it('filters rows by active selections', () => {
    expect(filterRowsBySelectedFilters(rows, { realm: ['atmos'] })).toEqual([
      { realm: ['atmos'], frequency: ['day'], variable: ['tas'] },
      { realm: ['atmos'], frequency: ['mon'], variable: ['pr'] },
    ]);
  });

  it('builds dynamic options by applying all other active filters', () => {
    expect(buildDynamicFilterOptions(rows, filterOptions, { realm: ['atmos'] })).toEqual({
      realm: ['atmos', 'ocean'],
      frequency: ['day', 'mon'],
      variable: ['tas', 'pr'],
    });
  });

  it('exposes the same behaviour through the composable', () => {
    const currentFilters = ref({ realm: ['atmos'] });
    const dynamicFilterOptions = useDynamicFilterOptions(ref(rows), computed(() => filterOptions), currentFilters);

    expect(dynamicFilterOptions.value.variable).toEqual(['tas', 'pr']);
    expect(dynamicFilterOptions.value.frequency).toEqual(['day', 'mon']);
  });
});
