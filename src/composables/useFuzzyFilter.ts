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
   * Returns the subset of `options` that fuzzy-match `searchTerm`, optionally
   * partitioned so available items appear before unavailable ones.
   *
   * Space-separated terms use OR semantics: each term is matched independently
   * and results are unioned, so "uvel vvel" surfaces both options.
   * Returns all options unchanged when `searchTerm` is empty or absent.
   *
   * When `availableOptions` is provided the result is split into two
   * alphabetically-sorted groups: available items first, unavailable below.
   * When `availableOptions` is omitted the original index order is preserved
   * (existing behaviour — used for non-lazy datastores).
   *
   * @param options - The full options list for this column.
   * @param searchTerm - Optional search term entered by the user.
   * @param availableOptions - Optional subset of options that are currently
   *   selectable given the active filters (from dynamicFilterOptions).
   * @returns Matched options, partitioned and sorted when availableOptions is given.
   */
  const getSortedOptions = (options: string[], searchTerm?: string, availableOptions?: string[]): string[] => {
    let result: string[];

    if (!searchTerm?.trim()) {
      result = options;
    } else {
      const terms = searchTerm
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 0);

      const matched = new Set<number>();
      for (const term of terms) {
        const idxs = uf.filter(options, term);
        if (idxs) idxs.forEach((i) => matched.add(i));
      }

      result = [...matched]
        .sort((a, b) => a - b)
        .map((i) => options[i])
        .filter((o): o is string => o !== undefined);
    }

    if (!availableOptions) return result;

    const availableSet = new Set(availableOptions);
    const available = result.filter((o) => availableSet.has(o)).sort((a, b) => a.localeCompare(b));
    const unavailable = result.filter((o) => !availableSet.has(o)).sort((a, b) => a.localeCompare(b));
    return [...available, ...unavailable];
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
