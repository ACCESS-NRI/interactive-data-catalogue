<template>
  <LazyDatastoreDetail v-if="totalRecords > 10000" />
  <EagerDatastoreDetail v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCatalogStore } from '../stores/catalogStore';
import LazyDatastoreDetail from './lazy/LazyDatastoreDetail.vue';
import EagerDatastoreDetail from './eager/EagerDatastoreDetail.vue';
import { useRoute  } from 'vue-router';

const route = useRoute();

const datastoreName = computed(() => route.params.name as string);
const catalogStore = useCatalogStore();
const cachedDatastore = computed(() => catalogStore.getDatastoreFromCache(datastoreName.value));
const totalRecords = computed(() => cachedDatastore.value?.totalRecords || 0);
</script>

<style scoped>
.datastore-detail-container {
  width: 100%;
  max-width: calc(100vw - 4rem);
  margin: 0 auto;
  padding: 2rem;
}
</style>
