<template>
  <div class="text-sm">
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-lg border border-blue-300 bg-white px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-950"
        :disabled="busy || disabled"
        @click="download"
      >
        <i class="pi pi-download mr-2" aria-hidden="true"></i
        >{{ datasetKey ? 'Download dataset paths (.txt)' : 'Download all matching paths (.txt)' }}
      </button>
      <button v-if="busy" type="button" class="underline" @click="cancel">Cancel download</button>
      <span v-if="status" role="status">{{ status }}</span>
    </div>
    <p class="mt-2 text-xs text-gray-600 dark:text-gray-300">
      One path per line, using your current filters.
      {{
        datasetKey
          ? 'Includes every matching file in this dataset.'
          : 'Includes all matching NCI datasets across every result page.'
      }}
      Alternate paths are grouped as in the file list.
    </p>
    <p v-if="error" role="alert" class="mt-2 text-amber-800 dark:text-amber-200">
      {{ error }} You can retry the download.
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import type { CmipDatasetSearch } from '../services/cmipDatasets';
import { createPathListDownload, type PathListDownload } from '../services/pathListDownload';

const props = defineProps<{
  search: CmipDatasetSearch;
  filename: string;
  datasetKey?: string;
  large?: boolean;
  disabled?: boolean;
}>();
const busy = ref(false);
const status = ref('');
const error = ref('');
let controller: AbortController | undefined;
function cancel() {
  controller?.abort();
  busy.value = false;
  status.value = 'Download cancelled.';
}
function reset() {
  controller?.abort();
  controller = undefined;
  busy.value = false;
  status.value = '';
  error.value = '';
}
async function download() {
  if (busy.value || props.disabled) return;
  const request = new AbortController();
  controller = request;
  busy.value = true;
  error.value = '';
  status.value = 'Preparing paths…';
  let sink: PathListDownload | undefined;
  let count = 0;
  try {
    sink = await createPathListDownload(props.filename, request.signal, props.large);
    request.signal.throwIfAborted();
    for await (const paths of props.search.exportPaths(request.signal, props.datasetKey)) {
      request.signal.throwIfAborted();
      await sink.write(paths);
      count += paths.length;
      if (controller === request) status.value = `Preparing ${count.toLocaleString()} paths…`;
    }
    if (!count) throw new Error('No matching file paths were found. Refresh the search and try again.');
    request.signal.throwIfAborted();
    await sink.close();
    if (controller === request && !request.signal.aborted)
      status.value = `Downloaded ${count.toLocaleString()} ${count === 1 ? 'path' : 'paths'}.`;
  } catch (cause) {
    await sink?.abort().catch(() => {});
    if (controller !== request) return;
    if (request.signal.aborted || (cause instanceof Error && cause.name === 'AbortError'))
      status.value = 'Download cancelled.';
    else {
      status.value = '';
      error.value = cause instanceof Error ? cause.message : 'The path list could not be downloaded.';
    }
  } finally {
    if (controller === request) busy.value = false;
  }
}
watch([() => props.search, () => props.datasetKey], reset);
onBeforeUnmount(reset);
</script>
