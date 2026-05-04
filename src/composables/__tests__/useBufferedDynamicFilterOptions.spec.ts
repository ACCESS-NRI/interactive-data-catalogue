import { describe, expect, it } from 'vitest';
import { useBufferedDynamicFilterOptions } from '../useBufferedDynamicFilterOptions';

describe('useBufferedDynamicFilterOptions', () => {
  it('applies updates immediately for closed dropdowns', () => {
    const { dynamicFilterOptions, handleDynamicFilterOptionsUpdate } = useBufferedDynamicFilterOptions({
      frequency: ['day', 'mon', 'year'],
    });

    handleDynamicFilterOptionsUpdate({ frequency: ['day', 'mon'] });

    expect(dynamicFilterOptions.value.frequency).toEqual(['day', 'mon']);
  });

  it('buffers updates for open dropdowns until close', () => {
    const {
      dynamicFilterOptions,
      handleDynamicFilterOptionsUpdate,
      handleDropdownOpened,
      handleDropdownClosed,
    } = useBufferedDynamicFilterOptions({
      frequency: ['day', 'mon', 'year'],
      realm: ['atmos', 'ocean', 'land'],
    });

    handleDropdownOpened('frequency');
    handleDynamicFilterOptionsUpdate({
      frequency: ['day', 'mon'],
      realm: ['atmos', 'ocean'],
    });

    expect(dynamicFilterOptions.value.frequency).toEqual(['day', 'mon', 'year']);
    expect(dynamicFilterOptions.value.realm).toEqual(['atmos', 'ocean']);

    handleDropdownClosed('frequency');

    expect(dynamicFilterOptions.value.frequency).toEqual(['day', 'mon']);
  });

  it('resets state cleanly', () => {
    const { dynamicFilterOptions, handleDropdownOpened, resetBufferedDynamicFilterOptions } =
      useBufferedDynamicFilterOptions({ frequency: ['day'] });

    handleDropdownOpened('frequency');
    resetBufferedDynamicFilterOptions({ realm: ['atmos'] });

    expect(dynamicFilterOptions.value).toEqual({ realm: ['atmos'] });
  });
});
