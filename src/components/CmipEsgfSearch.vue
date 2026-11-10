<template>
  <section
    class="mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
    aria-label="ESGF search"
  >
    <label v-if="!standalone" class="flex cursor-pointer items-start gap-3">
      <input
        v-model="enabled"
        type="checkbox"
        class="mt-1 h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-500"
        aria-describedby="esgf-search-help"
      />
      <span>
        <span class="font-semibold text-gray-900 dark:text-white">Also search ESGF for {{ project }} data</span>
        <span id="esgf-search-help" class="mt-1 block text-sm text-gray-600 dark:text-gray-300">
          Find datasets beyond the NCI replicas and check NCI availability. Searches the public ESGF index using the
          filters above.
        </span>
      </span>
    </label>

    <details
      v-if="enabled"
      open
      class="group/esgf overflow-hidden rounded-xl border border-violet-300 border-t-4 border-t-violet-600 bg-violet-50/70 p-4 dark:border-violet-700 dark:border-t-violet-400 dark:bg-violet-950/30"
      :class="standalone ? '' : 'mt-5'"
      aria-label="ESGF results"
    >
      <summary
        class="flex cursor-pointer list-none items-center gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 [&::-webkit-details-marker]:hidden"
      >
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white"
          ><i class="pi pi-globe text-xl" aria-hidden="true"></i
        ></span>
        <h2 class="flex-1 text-lg font-bold text-violet-950 dark:text-violet-100">
          ESGF · International datasets
          <span class="block text-sm font-normal text-violet-800 dark:text-violet-200">
            Discover data across the federation and see whether it is listed at NCI.
          </span>
        </h2>
        <i
          class="pi pi-chevron-right shrink-0 text-violet-950 transition-transform group-open/esgf:rotate-90 dark:text-violet-100"
          aria-hidden="true"
        ></i>
      </summary>
      <div class="pt-4">
        <p v-if="!standalone" class="mb-3 text-sm text-gray-600 dark:text-gray-300">
          The filter dropdowns now include ESGF values, including models and variables absent from NCI. ESGF results
          describe whole datasets; NCI results list local files.
        </p>
        <p
          v-if="unsupported.length"
          role="status"
          class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          ESGF cannot apply these filters: {{ unsupported.join(', ') }}. Remove them to search ESGF.
        </p>
        <template v-else>
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div aria-live="polite" class="text-sm text-gray-700 dark:text-gray-200">
              <span class="font-semibold">ESGF datasets</span>
              <span v-if="total !== null">
                · {{ total.toLocaleString() }} index records · {{ datasets.length }} unique datasets loaded</span
              >
              <span v-if="loading"> · Searching and checking NCI and errata…</span>
            </div>
            <button
              type="button"
              class="text-sm font-medium text-blue-700 underline disabled:opacity-50 dark:text-blue-300"
              :disabled="loading"
              @click="retry"
            >
              Refresh ESGF results
            </button>
          </div>
          <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {{ filters.version?.length ? 'Selected versions.' : 'Latest published versions.' }} Replicas of the same
            version are grouped. NCI checks cover the replicas and Australian submissions catalogues; file completeness
            and the replication queue are not checked. Errata checks apply to the displayed version; an unverified
            lookup does not mean there are no issues.
          </p>
          <div
            v-if="error"
            role="alert"
            class="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            ESGF search could not finish. {{ error }}
            {{
              standalone ? 'Choose Search on NCI to search local files.' : 'Your NCI results are still available below.'
            }}
            <button type="button" class="ml-2 underline" @click="loadMore">Retry search</button>
          </div>
          <div v-if="datasets.length" class="overflow-x-auto">
            <table class="w-full min-w-[60rem] text-left text-sm">
              <thead class="bg-violet-100 text-violet-950 dark:bg-violet-900/60 dark:text-violet-100">
                <tr>
                  <th class="p-3">Dataset / version</th>
                  <th class="p-3">ESGF</th>
                  <th class="p-3">NCI availability</th>
                  <th class="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="dataset in datasets"
                  :key="dataset.id"
                  class="border-t border-violet-200 bg-white/70 align-top dark:border-violet-800 dark:bg-gray-900/30"
                >
                  <td class="min-w-80 max-w-xl p-3">
                    <div class="mb-1 font-medium">
                      {{ dataset.facets.source_id?.join(', ') }} · {{ dataset.facets.experiment_id?.join(', ') }} ·
                      {{ (dataset.facets.branded_variable || dataset.facets.variable_id)?.join(', ') }}
                    </div>
                    <div class="break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ dataset.id }}</div>
                    <div class="mt-2 text-xs" aria-live="polite">
                      <template v-if="errataStatus(dataset).status === 'reported'">
                        <span
                          class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-950 dark:bg-amber-900 dark:text-amber-100"
                        >
                          <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
                          Errata reported
                        </span>
                        <a
                          v-for="(url, index) in errataStatus(dataset).issueUrls"
                          :key="url"
                          :href="url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="ml-2 inline-block text-blue-700 underline dark:text-blue-300"
                          >{{
                            errataStatus(dataset).issueUrls.length === 1 ? 'View errata' : `Errata issue ${index + 1}`
                          }}
                          ↗</a
                        >
                      </template>
                      <span v-else class="text-gray-500 dark:text-gray-400">
                        {{
                          errataStatus(dataset).status === 'checking'
                            ? 'Checking errata…'
                            : errataStatus(dataset).status === 'none'
                              ? 'No errata reported for this version'
                              : 'Errata unverified'
                        }}
                      </span>
                    </div>
                  </td>
                  <td class="min-w-32 p-3">
                    <div>{{ dataset.fileCount ?? 'Unknown' }} files</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">{{ formatSize(dataset.size) }}</div>
                    <div class="mt-1 max-w-48 break-words text-xs text-gray-500 dark:text-gray-400">
                      {{ dataset.nodes.join(', ') || 'Node not supplied' }}
                    </div>
                  </td>
                  <td class="min-w-48 p-3">
                    <span
                      class="inline-block rounded-full px-2 py-1 text-xs font-medium"
                      :class="statusClass(status(dataset).status)"
                      >{{ statusLabel(status(dataset).status) }}</span
                    >
                    <div
                      v-if="status(dataset).collections.length"
                      class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                    >
                      {{ status(dataset).collections.join(', ') }}
                    </div>
                  </td>
                  <td class="min-w-44 p-3">
                    <a
                      :href="dataset.portalUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block text-blue-700 underline dark:text-blue-300"
                      >View in ESGF ↗</a
                    >
                    <p
                      v-if="status(dataset).status === 'missing'"
                      class="mt-2 text-xs text-gray-600 dark:text-gray-400"
                    >
                      Replication requests are not available yet.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-else-if="!loading && total === 0 && !error"
            role="status"
            class="py-4 text-sm text-gray-600 dark:text-gray-300"
          >
            No ESGF datasets match these filters. Try removing a filter or choosing another value.
          </p>
          <button
            v-if="next && !error"
            type="button"
            class="mt-4 rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 disabled:opacity-50 dark:border-blue-700 dark:text-blue-300"
            :disabled="loading"
            @click="loadMore"
          >
            {{ loading ? 'Loading…' : 'Load more ESGF results' }}
          </button>
        </template>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import type { FilterMap } from '../types/datastore';
import type { CmipProject } from '../services/cmipEsmvalcoreCode';
import type { EsgfDataset, NciStatus } from '../services/esgfSearch';
import { useEsgfSearch } from '../composables/useEsgfSearch';

const props = defineProps<{ project: CmipProject; filters: FilterMap; standalone?: boolean }>();
const enabled = defineModel<boolean>({ default: false });
const { datasets, availability, errata, total, next, loading, error, unsupported, loadMore, retry } = useEsgfSearch(
  toRef(props, 'project'),
  toRef(props, 'filters'),
  enabled,
);
const status = (dataset: EsgfDataset) =>
  availability.value[dataset.id] || { status: 'checking' as const, collections: [] };
const errataStatus = (dataset: EsgfDataset) =>
  errata.value[dataset.id] || { status: 'checking' as const, issueUrls: [] };
const statusLabel = (value: NciStatus) =>
  ({
    checking: 'Checking NCI…',
    listed: 'Version listed at NCI',
    'different-version': 'Different version at NCI',
    'version-unverified': 'NCI match · version unverified',
    missing: 'Not found in NCI catalogue',
    unknown: 'NCI availability unverified',
  })[value];
const statusClass = (value: NciStatus) =>
  value === 'listed' || value === 'version-unverified'
    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
    : value === 'missing' || value === 'different-version'
      ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
function formatSize(bytes: number | null) {
  if (bytes === null) return 'Size not supplied';
  const unit = bytes >= 1024 ** 3 ? 'GiB' : 'MiB';
  return `${(bytes / 1024 ** (unit === 'GiB' ? 3 : 2)).toFixed(1)} ${unit}`;
}
</script>
