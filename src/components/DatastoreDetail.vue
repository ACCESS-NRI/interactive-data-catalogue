<template>
  <div v-if="isLoading" class="flex items-center justify-center p-8">
    <div class="text-center">
      <i class="pi pi-spinner pi-spin text-2xl text-blue-500 mb-2"></i>
      <p class="text-gray-600">Loading datastore metadata...</p>
    </div>
  </div>
  <LazyDatastoreDetail v-else-if="shouldUseLazy" :key="`lazy-${componentKey}`" />
  <EagerDatastoreDetail v-else :key="`eager-${componentKey}`" />
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useCatalogStore } from '../stores/catalogStore';
import LazyDatastoreDetail from './lazy/LazyDatastoreDetail.vue';
import EagerDatastoreDetail from './eager/EagerDatastoreDetail.vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const isLoading = ref(true);
const totalRecords = ref(0);
const componentKey = ref(0);

const datastoreName = computed(() => route.params.name as string);
const catalogStore = useCatalogStore();
const shouldUseLazy = computed(() => totalRecords.value > 10000);

const initializeComponent = async () => {
  isLoading.value = true;

  // Check if we already have cached data
  const existingCache = catalogStore.getDatastoreFromCache(datastoreName.value);
  if (existingCache && existingCache.totalRecords > 0) {
    totalRecords.value = existingCache.totalRecords;
  } else {
    // No cache exists - default to lazy loading for safety
    // The child component will load the data and populate the cache
    totalRecords.value = 999999;
  }

  isLoading.value = false;
};

// Watch for route changes
watch(
  () => datastoreName.value,
  () => {
    componentKey.value++; // Force component remount
    initializeComponent();
  },
  { immediate: true },
);

onMounted(() => {
  initializeComponent();
});
</script>

<style scoped>
.datastore-detail-container {
  width: 100%;
  max-width: calc(100vw - 4rem);
  margin: 0 auto;
  padding: 2rem;
}
</style>
