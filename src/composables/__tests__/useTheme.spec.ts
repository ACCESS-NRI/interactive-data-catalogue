import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTheme, isDarkMode, toggleTheme } from '../useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with the system theme when no preference is saved', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);

    initializeTheme();

    expect(isDarkMode.value).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('uses and remembers an explicit theme choice', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    localStorage.setItem('catalogue-theme', 'light');

    initializeTheme();
    expect(isDarkMode.value).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    toggleTheme();
    expect(isDarkMode.value).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('catalogue-theme')).toBe('dark');
  });
});
