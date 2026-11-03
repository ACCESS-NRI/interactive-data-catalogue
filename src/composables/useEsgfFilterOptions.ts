import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { CmipProject } from '../services/cmipEsmvalcoreCode';
import type { FilterOptions } from '../types/datastore';
import { fetchEsgfFilterOptions } from '../services/esgfSearch';

export function useEsgfFilterOptions(project: Ref<CmipProject | null>) {
  const options = ref<FilterOptions>({});
  const loading = ref(false);
  const error = ref('');
  const cache = new Map<CmipProject, FilterOptions>();
  let controller: AbortController | undefined;

  async function load() {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    const currentProject = project.value;
    options.value = {};
    error.value = '';
    loading.value = false;
    if (!currentProject) return;
    const cached = cache.get(currentProject);
    if (cached) {
      options.value = cached;
      return;
    }
    loading.value = true;
    try {
      const result = await fetchEsgfFilterOptions(currentProject, request.signal);
      if (request.signal.aborted) return;
      cache.set(currentProject, result);
      options.value = result;
    } catch (cause) {
      if (!request.signal.aborted)
        error.value = cause instanceof Error ? cause.message : 'ESGF filter options are unavailable.';
    } finally {
      if (!request.signal.aborted) loading.value = false;
    }
  }

  watch(project, load, { immediate: true });
  onBeforeUnmount(() => controller?.abort());
  return { options, loading, error, retry: load };
}
