import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { FilterMap } from '../types/datastore';
import type { CmipProject } from '../services/cmipEsmvalcoreCode';
import { checkEsgfErrata, type EsgfErrata } from '../services/esgfErrata';
import {
  checkNciAvailability,
  mergeEsgfDatasets,
  searchEsgf,
  unsupportedEsgfFilters,
  type EsgfDataset,
  type NciAvailability,
} from '../services/esgfSearch';

export function useEsgfSearch(project: Ref<CmipProject>, filters: Ref<FilterMap>, enabled: Ref<boolean>) {
  const datasets = ref<EsgfDataset[]>([]);
  const availability = ref<Record<string, NciAvailability>>({});
  const errata = ref<Record<string, EsgfErrata>>({});
  const total = ref<number | null>(null);
  const next = ref<string | null>(null);
  const loading = ref(false);
  const error = ref('');
  const unsupported = computed(() => unsupportedEsgfFilters(project.value, filters.value));
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const cache = new Map<string, NciAvailability>();
  const errataCache = new Map<string, EsgfErrata>();

  async function checkAvailability(dataset: EsgfDataset, signal: AbortSignal, current: number) {
    if (cache.has(dataset.id)) return;
    const result = await checkNciAvailability(dataset, signal);
    if (current !== generation || signal.aborted) return;
    availability.value[dataset.id] = result;
    if (result.status !== 'unknown') {
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(dataset.id, result);
    }
  }

  async function checkErrata(dataset: EsgfDataset, signal: AbortSignal, current: number) {
    if (errataCache.has(dataset.id)) return;
    const result = await checkEsgfErrata(dataset, signal);
    if (current !== generation || signal.aborted) return;
    errata.value[dataset.id] = result;
    // Failed lookups remain retryable; Refresh clears successful checks too.
    if (result.status !== 'unknown') {
      if (errataCache.size >= 200) errataCache.delete(errataCache.keys().next().value!);
      errataCache.set(dataset.id, result);
    }
  }

  async function loadMore() {
    if (!enabled.value || loading.value || unsupported.value.length) return;
    const current = generation;
    const signal = controller!.signal;
    loading.value = true;
    error.value = '';
    try {
      const page = await searchEsgf(project.value, filters.value, signal, next.value ?? undefined);
      if (current !== generation || signal.aborted) return;
      datasets.value = mergeEsgfDatasets([...datasets.value, ...page.datasets]);
      total.value = page.total;
      next.value = page.next;
      const queue = page.datasets.filter((dataset) => {
        availability.value[dataset.id] = cache.get(dataset.id) || { status: 'checking', collections: [] };
        errata.value[dataset.id] = errataCache.get(dataset.id) || { status: 'checking', issueUrls: [] };
        return !cache.has(dataset.id) || !errataCache.has(dataset.id);
      });
      // At most four catalogue and two errata requests at once. Individual
      // errata lookups keep one unresolved PID from failing the whole page.
      await Promise.all(
        Array.from({ length: 2 }, async () => {
          while (queue.length && !signal.aborted) {
            const dataset = queue.shift()!;
            await Promise.all([checkAvailability(dataset, signal, current), checkErrata(dataset, signal, current)]);
          }
        }),
      );
    } catch (cause) {
      if (current === generation && !signal.aborted) {
        error.value = cause instanceof Error ? cause.message : 'ESGF search is unavailable. Try again.';
      }
    } finally {
      if (current === generation) loading.value = false;
    }
  }

  function reset() {
    generation++;
    clearTimeout(timer);
    controller?.abort();
    controller = new AbortController();
    datasets.value = [];
    availability.value = {};
    errata.value = {};
    total.value = null;
    next.value = null;
    loading.value = false;
    error.value = '';
    if (enabled.value && !unsupported.value.length) timer = setTimeout(loadMore, 350);
  }

  watch([project, filters, enabled], reset, { deep: true, immediate: true });
  onBeforeUnmount(() => {
    generation++;
    clearTimeout(timer);
    controller?.abort();
  });
  const retry = () => {
    cache.clear();
    errataCache.clear();
    reset();
  };
  return { datasets, availability, errata, total, next, loading, error, unsupported, loadMore, retry };
}
