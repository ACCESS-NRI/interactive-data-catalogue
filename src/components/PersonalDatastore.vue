<template>
  <div class="personal-datastore-container">
    <!-- Upload Section -->
    <div v-if="!isDetailVisible">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Personal Datastore</h1>
        <p class="text-gray-600 dark:text-gray-300">
          Upload your own intake-esm CSV file to browse it using the same interface as the ACCESS-NRI catalogue.
          Your data stays in your browser session and is never uploaded to any server.
        </p>
      </div>

      <!-- Session banner for already-loaded datastore -->
      <div
        v-if="catalogStore.hasPersonalDatastore"
        class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6"
      >
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p class="text-blue-800 dark:text-blue-200 font-medium">
              <i class="pi pi-check-circle mr-2"></i>
              <strong>{{ catalogStore.personalDatastore?.name }}</strong> is loaded
            </p>
            <p class="text-blue-700 dark:text-blue-300 text-sm mt-1">
              From <em>{{ catalogStore.personalDatastore?.csvFileName }}</em> —
              loaded {{ loadedAtFormatted }}
            </p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <Button
              label="Browse it"
              icon="pi pi-search"
              size="small"
              @click="showDetail"
            />
            <Button
              label="Replace"
              icon="pi pi-upload"
              size="small"
              severity="secondary"
              outlined
              @click="showReplace = true"
            />
            <Button
              label="Clear"
              icon="pi pi-trash"
              size="small"
              severity="danger"
              outlined
              @click="handleClear"
            />
          </div>
        </div>
      </div>

      <!-- Upload form -->
      <div
        v-if="!catalogStore.hasPersonalDatastore || showReplace"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          <i class="pi pi-upload mr-2"></i>
          {{ catalogStore.hasPersonalDatastore ? 'Replace Datastore' : 'Upload Datastore CSV' }}
        </h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Datastore name
            </label>
            <InputText
              v-model="datastoreNameInput"
              placeholder="e.g. my-project-catalog"
              class="w-full"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              A short label shown in the breadcrumb and quick-start code.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Intake-ESM CSV file
            </label>
            <input
              ref="fileInputRef"
              type="file"
              accept=".csv"
              class="block w-full text-sm text-gray-700 dark:text-gray-300
                     file:mr-4 file:py-2 file:px-4
                     file:rounded file:border-0
                     file:text-sm file:font-medium
                     file:bg-blue-50 file:text-blue-700
                     hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300"
              @change="handleFileChange"
            />
          </div>

          <div v-if="uploadError" class="text-red-600 dark:text-red-400 text-sm">
            <i class="pi pi-exclamation-triangle mr-1"></i>
            {{ uploadError }}
          </div>

          <div class="flex gap-2">
            <Button
              label="Load Datastore"
              icon="pi pi-check"
              :disabled="!selectedFile || !datastoreNameInput.trim() || uploading"
              :loading="uploading"
              @click="handleUpload"
            />
            <Button
              v-if="showReplace"
              label="Cancel"
              severity="secondary"
              outlined
              @click="showReplace = false"
            />
          </div>
        </div>
      </div>

      <!-- Info panel when nothing loaded yet -->
      <div
        v-if="!catalogStore.hasPersonalDatastore"
        class="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
      >
        <h3 class="text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">What is an intake-esm CSV?</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          An intake-esm catalog CSV contains one row per dataset asset, with columns such as
          <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">variable</code>,
          <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">frequency</code>,
          <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">realm</code>, and
          <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">path</code>.
          You can find the CSV file for any intake-esm catalog in its JSON descriptor under the
          <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">catalog_file</code> key.
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          <i class="pi pi-info-circle mr-1"></i>
          Your data is processed locally in-browser using DuckDB WASM — nothing is sent to any server.
        </p>
      </div>
    </div>

    <!-- Detail Section -->
    <div v-else>
      <div class="mb-4">
        <Button
          label="Back to upload"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          size="small"
          @click="hideDetail"
        />
      </div>
      <EagerDatastoreDetail
        :datastore-name="catalogStore.personalDatastore?.name ?? 'Personal Datastore'"
        :cache-key="PERSONAL_DATASTORE_CACHE_KEY"
        source="personal"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import EagerDatastoreDetail from './eager/EagerDatastoreDetail.vue';
import { useCatalogStore } from '../stores/catalogStore';
import { PERSONAL_DATASTORE_CACHE_KEY } from '../stores/catalogStore';

const catalogStore = useCatalogStore();

// Upload form state
const datastoreNameInput = ref('');
const selectedFile = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const uploadError = ref<string | null>(null);
const showReplace = ref(false);
const isDetailVisible = ref(false);

const loadedAtFormatted = computed(() => {
  const date = catalogStore.personalDatastore?.loadedAt;
  if (!date) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
});

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  selectedFile.value = target.files?.[0] ?? null;
  uploadError.value = null;
};

const handleUpload = async () => {
  const file = selectedFile.value;
  const name = datastoreNameInput.value.trim();
  if (!file || !name) return;

  uploading.value = true;
  uploadError.value = null;

  try {
    if (catalogStore.hasPersonalDatastore) {
      await catalogStore.replacePersonalDatastore(file, name);
    } else {
      await catalogStore.loadPersonalDatastoreCsv(file, name);
    }
    showReplace.value = false;
    selectedFile.value = null;
    if (fileInputRef.value) fileInputRef.value.value = '';
    isDetailVisible.value = true;
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Failed to load datastore';
  } finally {
    uploading.value = false;
  }
};

const handleClear = () => {
  catalogStore.clearPersonalDatastore();
  datastoreNameInput.value = '';
  selectedFile.value = null;
  if (fileInputRef.value) fileInputRef.value.value = '';
};

const showDetail = () => {
  isDetailVisible.value = true;
};

const hideDetail = () => {
  isDetailVisible.value = false;
};
</script>

<style scoped>
.personal-datastore-container {
  width: 100%;
  max-width: calc(100vw - 4rem);
  margin: 0 auto;
  padding: 2rem;
}
</style>
