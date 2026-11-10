<template>
  <div class="text-sm">
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-lg border border-blue-300 bg-white px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-950"
        :disabled="busy || disabled"
        @click="download('download')"
      >
        <i class="pi pi-download mr-2" aria-hidden="true"></i
        >{{ datasetKey ? 'Download dataset paths (.txt)' : 'Download all matching paths (.txt)' }}
      </button>
      <button
        v-if="allowCopy"
        type="button"
        class="rounded-lg border border-blue-300 bg-white px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300"
        :disabled="busy || disabled"
        @click="download('copy')"
      >
        <i class="pi pi-copy mr-2" aria-hidden="true"></i>Copy all paths
      </button>
      <button v-if="busy" type="button" class="underline" @click="cancel">Cancel</button>
      <span v-if="status" role="status">{{ status }}</span>
    </div>
    <p v-if="!datasetKey" class="mt-2 text-xs text-gray-600 dark:text-gray-300">
      Includes all matching NCI datasets across every result page, with one path per line.
    </p>
    <p v-if="error" role="alert" class="mt-2 text-amber-800 dark:text-amber-200">{{ error }} You can try again.</p>
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
  allowCopy?: boolean;
}>();
const busy = ref(false);
const status = ref('');
const error = ref('');
let controller: AbortController | undefined;
function cancel() {
  controller?.abort();
  busy.value = false;
  status.value = 'Cancelled.';
}
function reset() {
  controller?.abort();
  controller = undefined;
  busy.value = false;
  status.value = '';
  error.value = '';
}
async function download(action: 'download' | 'copy') {
  if (busy.value || props.disabled) return;
  const request = new AbortController();
  controller = request;
  busy.value = true;
  error.value = '';
  status.value = 'Preparing paths…';
  let sink: PathListDownload | undefined;
  let count = 0;
  const clipboardChunks: string[] = [];
  let clipboardBytes = 0;
  try {
    if (action === 'download') sink = await createPathListDownload(props.filename, request.signal, props.large);
    request.signal.throwIfAborted();
    for await (const paths of props.search.exportPaths(request.signal, props.datasetKey)) {
      request.signal.throwIfAborted();
      if (sink) await sink.write(paths);
      else {
        const chunk = `${paths.join('\n')}\n`;
        clipboardBytes += new TextEncoder().encode(chunk).byteLength;
        if (clipboardBytes > 16 * 1024 * 1024)
          throw new Error('This list is too large for the clipboard. Use Download dataset paths instead.');
        clipboardChunks.push(chunk);
      }
      count += paths.length;
      if (controller === request) status.value = `Preparing ${count.toLocaleString()} paths…`;
    }
    if (!count) throw new Error('No matching file paths were found. Refresh the search and try again.');
    request.signal.throwIfAborted();
    if (sink) await sink.close();
    else await navigator.clipboard.writeText(clipboardChunks.join(''));
    if (controller === request && !request.signal.aborted)
      status.value = `${action === 'copy' ? 'Copied' : 'Downloaded'} ${count.toLocaleString()} ${count === 1 ? 'path' : 'paths'}.`;
  } catch (cause) {
    await sink?.abort().catch(() => {});
    if (controller !== request) return;
    if (request.signal.aborted || (cause instanceof Error && cause.name === 'AbortError')) status.value = 'Cancelled.';
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
