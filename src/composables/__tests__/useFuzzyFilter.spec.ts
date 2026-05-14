import { describe, it, expect } from 'vitest';
import { useFuzzyFilter, fuzzyMatchesSearch } from '../useFuzzyFilter';

describe('useFuzzyFilter', () => {
  const { getSortedOptions } = useFuzzyFilter();
  const options = ['cloud_fraction', 'cloud_amount', 'atmosphere', 'ua_850hpa', 'uvel', 'vvel', 'temperature'];

  describe('getSortedOptions', () => {
    it('returns all options when search term is empty', () => {
      expect(getSortedOptions(options, '')).toEqual(options);
    });

    it('returns all options when search term is whitespace only', () => {
      expect(getSortedOptions(options, '   ')).toEqual(options);
    });

    it('returns all options when no search term is provided', () => {
      expect(getSortedOptions(options, undefined)).toEqual(options);
    });

    it('returns all options when options list is empty', () => {
      expect(getSortedOptions([], 'cloud')).toEqual([]);
    });

    it('matches exact substrings', () => {
      expect(getSortedOptions(options, 'cloud')).toEqual(['cloud_fraction', 'cloud_amount']);
    });

    it('tolerates a single-character typo (transposition)', () => {
      // 'cluod' is a transposition of 'cloud'
      const result = getSortedOptions(options, 'cluod');
      expect(result).toContain('cloud_fraction');
      expect(result).toContain('cloud_amount');
    });

    it('tolerates a single-character typo (substitution)', () => {
      const result = getSortedOptions(['temperature', 'pressure'], 'temperiture');
      expect(result).toContain('temperature');
    });

    it('matches abbreviations with chars in sequence', () => {
      // 'atm' chars appear in sequence in 'atmosphere'
      expect(getSortedOptions(options, 'atm')).toContain('atmosphere');
    });

    it('applies OR semantics for space-separated terms', () => {
      const result = getSortedOptions(options, 'uvel vvel');
      expect(result).toContain('uvel');
      expect(result).toContain('vvel');
      expect(result).not.toContain('temperature');
    });

    it('preserves the original index order of matched options', () => {
      const result = getSortedOptions(options, 'uvel vvel');
      expect(result.indexOf('uvel')).toBeLessThan(result.indexOf('vvel'));
    });

    it('includes contains-matches (not just prefix matches)', () => {
      const result = getSortedOptions(['my_proj', 'proj1', 'proj2', 'another_proj'], 'proj');
      expect(result).toContain('proj1');
      expect(result).toContain('proj2');
      expect(result).toContain('my_proj');
    });

    it('matches case-insensitively', () => {
      const result = getSortedOptions(['Project1', 'project', 'PROJ'], 'proj');
      expect(result).toContain('PROJ');
      expect(result).toContain('project');
    });
  });

  describe('getSortedOptions — with availableOptions', () => {
    const allOptions = ['zebra', 'apple', 'mango', 'banana', 'cherry'];

    it('puts available items before unavailable items', () => {
      const available = ['apple', 'cherry'];
      const result = getSortedOptions(allOptions, undefined, available);
      const lastAvailableIdx = Math.max(...available.map((o) => result.indexOf(o)));
      const firstUnavailableIdx = Math.min(
        ...allOptions.filter((o) => !available.includes(o)).map((o) => result.indexOf(o)),
      );
      expect(lastAvailableIdx).toBeLessThan(firstUnavailableIdx);
    });

    it('sorts each partition alphabetically', () => {
      const available = ['mango', 'apple'];
      const result = getSortedOptions(allOptions, undefined, available);
      // available section: apple, mango
      expect(result[0]).toBe('apple');
      expect(result[1]).toBe('mango');
      // unavailable section: banana, cherry, zebra
      expect(result[2]).toBe('banana');
      expect(result[3]).toBe('cherry');
      expect(result[4]).toBe('zebra');
    });

    it('partitions and sorts after fuzzy filtering', () => {
      const opts = ['cloud_fraction', 'cloud_amount', 'atmosphere', 'cloud_cover'];
      const available = ['cloud_amount', 'cloud_cover'];
      const result = getSortedOptions(opts, 'cloud', available);
      void result;
      // all three cloud matches returned; available ones first, alphabetically
      expect(result).toEqual(['cloud_amount', 'cloud_cover', 'cloud_fraction']);
    });

    it('returns all items as unavailable when availableOptions is empty', () => {
      const result = getSortedOptions(allOptions, undefined, []);
      // no available items — all items returned sorted alphabetically
      expect(result).toEqual(['apple', 'banana', 'cherry', 'mango', 'zebra']);
    });

    it('falls back to original behaviour when availableOptions is undefined', () => {
      // No availableOptions: returns all options in original order unchanged
      expect(getSortedOptions(allOptions, undefined, undefined)).toEqual(allOptions);
    });
  });
});

describe('fuzzyMatchesSearch', () => {
  const haystack = ['cloud_fraction', 'atmosphere', 'temperature'];

  it('returns true for an empty search term (no filter)', () => {
    expect(fuzzyMatchesSearch(haystack, '')).toBe(true);
  });

  it('returns true for a whitespace-only search term', () => {
    expect(fuzzyMatchesSearch(haystack, '   ')).toBe(true);
  });

  it('returns true when at least one term matches a haystack entry', () => {
    expect(fuzzyMatchesSearch(haystack, 'cloud')).toBe(true);
  });

  it('returns false when no term matches any haystack entry', () => {
    expect(fuzzyMatchesSearch(haystack, 'zzzzz')).toBe(false);
  });

  it('returns true with OR semantics — one term matches even if another does not', () => {
    expect(fuzzyMatchesSearch(haystack, 'cloud zzzzz')).toBe(true);
  });
});
