<template>
  <div class="yaml-tree text-sm">
    <div v-if="!data">
      <div class="text-gray-600 dark:text-gray-300">No data to display</div>
    </div>
    <div v-else>
      <yaml-node :data="data" />
    </div>
  </div>
</template>

<script setup lang="ts">
import YamlNode from './YamlNode.vue';
defineProps<{ data: any }>();
</script>

<style scoped>
.yaml-tree {
  max-height: 20rem;
  overflow: auto;
}
</style>
