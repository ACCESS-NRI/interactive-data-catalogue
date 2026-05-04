import uFuzzy from '@leeoniya/ufuzzy';
import { FilterService } from '@primevue/core/api';

// Register a passthrough filter so PrimeVue doesn't re-filter our already fuzzy-matched options.
FilterService.register('passthrough', () => true);

// uFuzzy instance with SingleError mode — tolerates one-character typos (Damerau–Levenshtein ≤ 1)
const uf = new uFuzzy({ intraMode: 1 });

/**
 * Provides fuzzy filtering for PrimeVue MultiSelect dropdowns.
 *
 * Registers a `passthrough` FilterService mode so PrimeVue does not re-filter
 * the options returned by `getSortedOptions`. Callers should set
 * `filterMatchMode="passthrough"` on the MultiSelect component.
 */
export function useFuzzyFilter() {
  /**
   * Returns the subset of `options` that fuzzy-match `searchTerm`.
   * Space-separated terms use OR semantics: each term is matched independently
   * and results are unioned, so "uvel vvel" surfaces both options.
   * Returns all options unchanged when `searchTerm` is empty or absent.
   *
   * @param options - The full options list for this column.
   * @param searchTerm - Optional search term entered by the user.
   * @returns Matched options in their original order.
   */
  const getSortedOptions = (options: string[], searchTerm?: string): string[] => {
    if (!searchTerm?.trim()) return options;

    const terms = searchTerm
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const matched = new Set<number>();
    for (const term of terms) {
      const idxs = uf.filter(options, term);
      if (idxs) idxs.forEach((i) => matched.add(i));
    }

    return [...matched]
      .sort((a, b) => a - b)
      .map((i) => options[i])
      .filter((o): o is string => o !== undefined);
  };

  return { getSortedOptions };
}

/**
 * Returns true if `searchTerm` (space-separated OR semantics) fuzzy-matches
 * any string in `haystack`. Intended for per-row global search filtering.
 *
 * @param haystack - Array of strings to search within (e.g. row field values).
 * @param searchTerm - The search string, optionally space-separated for OR.
 */
export function fuzzyMatchesSearch(haystack: string[], searchTerm: string): boolean {
  const terms = searchTerm
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (terms.length === 0) return true;

  return terms.some((term) => {
    const idxs = uf.filter(haystack, term);
    return idxs !== null && idxs.length > 0;
  });
}
