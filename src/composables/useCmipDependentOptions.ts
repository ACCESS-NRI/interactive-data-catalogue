import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { accessFilters, fetchCmipNciOptions } from '../services/cmipSearch';
import { fetchEsgfFilterOptions } from '../services/esgfSearch';
import type { CmipProject } from '../services/cmipEsmvalcoreCode';
import type { FilterMap, FilterOptions } from '../types/datastore';

export interface CmipFacetContext {
  project: CmipProject;
  nci: boolean;
  filters: FilterMap;
  accessOnly: boolean;
  baseOptions: FilterOptions;
}

const canonicalFilters = (filters: FilterMap): FilterMap =>
  Object.fromEntries(
    Object.entries(filters)
      .filter(([, values]) => values.length)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([field, values]) => [field, [...new Set(values)].sort()]),
  );

/** Each field uses all other selections, keeping OR choices within that field.
 * ACCESS is a permanent scope constraint, even when calculating model choices.
 */
export function useCmipDependentOptions(context: Ref<CmipFacetContext | null>) {
  const options = ref<FilterOptions>({});
  const loading = ref(false);
  const error = ref('');
  const cache = new Map<string, FilterOptions>();
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function load(immediate = false) {
    controller?.abort();
    clearTimeout(timer);
    const request = new AbortController();
    controller = request;
    options.value = {};
    error.value = '';
    loading.value = false;
    const current = context.value;
    if (!current) return;
    const { project, nci, accessOnly, baseOptions } = current;
    const filters = canonicalFilters(current.filters);
    if (!accessOnly && !Object.keys(filters).length) {
      options.value = baseOptions;
      return;
    }
    loading.value = true;
    const run = async () => {
      // Share identical requests within this update; retain only completed results
      // across updates, so a cancelled request is never reused by the next search.
      const pending = new Map<string, Promise<FilterOptions>>();
      const choices = (selections: FilterMap): Promise<FilterOptions> => {
        const scoped = accessOnly ? accessFilters(selections, baseOptions) : selections;
        if (!scoped) return Promise.resolve({});
        const active = canonicalFilters(scoped);
        if (!Object.keys(active).length) return Promise.resolve(baseOptions);
        const key = JSON.stringify([project, nci, accessOnly, active]);
        if (cache.has(key)) return Promise.resolve(cache.get(key)!);
        if (!pending.has(key)) {
          const fetchOptions = nci ? fetchCmipNciOptions : fetchEsgfFilterOptions;
          pending.set(
            key,
            (nci && accessOnly
              ? fetchCmipNciOptions(project, request.signal, active, true)
              : fetchOptions(project, request.signal, active)
            ).then((result) => {
              if (!request.signal.aborted) {
                cache.set(key, result);
                if (cache.size > 24) cache.delete(cache.keys().next().value!);
              }
              return result;
            }),
          );
        }
        return pending.get(key)!;
      };
      try {
        const [matching, ...selected] = await Promise.all([
          choices(filters),
          ...Object.keys(filters).map(async (field) => {
            const otherFilters = Object.fromEntries(Object.entries(filters).filter(([key]) => key !== field));
            return [field, (await choices(otherFilters))[field] ?? []] as const;
          }),
        ]);
        if (request.signal.aborted) return;
        options.value = { ...matching, ...Object.fromEntries(selected) };
      } catch (cause) {
        if (request.signal.aborted) return;
        error.value = cause instanceof Error ? cause.message : 'Related filter choices could not be loaded.';
        // Abort sibling requests after an incomplete response. Keep current
        // selections removable, but do not offer stale unconstrained choices.
        request.abort();
      } finally {
        if (controller === request) loading.value = false;
      }
    };
    if (immediate) await run();
    else timer = setTimeout(() => void run(), 200);
  }
  watch(context, () => void load(), { immediate: true, deep: true });
  onBeforeUnmount(() => {
    controller?.abort();
    clearTimeout(timer);
  });
  return { options, loading, error, retry: () => load(true) };
}
