import { describe, it, expect, beforeEach, vi } from 'vitest';
import router, { isNavigating } from '../index';

// posthog-js is globally mocked in src/test/setup.ts

describe('router', () => {
  beforeEach(async () => {
    await router.push('/');
    await router.isReady();
    vi.clearAllMocks();
  });

  it('resolves the PersonalDatastore route', () => {
    const resolved = router.resolve({ name: 'PersonalDatastore' });
    expect(resolved.path).toBe('/personal-datastore');
  });

  it('resolves the PersonalDatastoreDetail route with a name param', () => {
    const resolved = router.resolve({ name: 'PersonalDatastoreDetail', params: { name: 'my-ds' } });
    expect(resolved.path).toBe('/personal-datastore/my-ds');
  });

  it('sets isNavigating to true inside beforeEach and document.title from meta', async () => {
    let navigatingDuringGuard = false;

    const remove = router.beforeEach(() => {
      navigatingDuringGuard = isNavigating.value;
    });

    await router.push('/personal-datastore/my-ds');

    remove();
    expect(navigatingDuringGuard).toBe(true);
    expect(document.title).toBe('Personal Datastore');
  });

  it('navigates to PersonalDatastoreDetail and reflects the name param', async () => {
    await router.push({ name: 'PersonalDatastoreDetail', params: { name: 'test-catalog' } });
    expect(router.currentRoute.value.name).toBe('PersonalDatastoreDetail');
    expect(router.currentRoute.value.params.name).toBe('test-catalog');
  });

  it('afterEach sets isNavigating to false after the 100ms timeout', async () => {
    vi.useFakeTimers();

    await router.push('/personal-datastore');
    // Before the timer fires, isNavigating may still be true
    vi.advanceTimersByTime(100);
    expect(isNavigating.value).toBe(false);

    vi.useRealTimers();
  });
});
