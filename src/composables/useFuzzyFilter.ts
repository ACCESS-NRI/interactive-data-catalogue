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
