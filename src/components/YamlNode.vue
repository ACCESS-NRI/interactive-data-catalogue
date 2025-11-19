<template>
  <div class="yaml-node">
    <template v-if="isObject(data)">
      <div v-for="(val, key) in data" :key="key" class="py-1">
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-2 text-left w-full text-sm text-gray-700 dark:text-gray-200"
            @click="toggle(key)"
          >
            <i :class="open[key] ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
            <span class="font-mono text-xs">{{ key }}</span>
          </button>
        </div>
        <div v-show="open[key]" class="pl-2">
          <yaml-node :data="val" />
        </div>
      </div>
    </template>

    <template v-else-if="isArray(data)">
      <div v-for="(item, idx) in data" :key="idx" class="py-1">
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-2 text-left w-full text-sm text-gray-700 dark:text-gray-200"
            @click="toggle(idx)"
          >
            <i :class="open[idx] ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
            <span class="font-mono text-xs">- [{{ idx }}]</span>
          </button>
        </div>
        <div v-show="open[idx]" class="pl-2">
          <yaml-node :data="item" />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="py-1">
        <code class="font-mono text-xs text-gray-800 dark:text-gray-200">{{ String(data) }}</code>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';

const YamlNode = defineComponent({
  name: 'YamlNode',
  props: {
    data: { type: null, required: true },
  },
  setup() {
    const open = ref<Record<string | number, boolean>>({});

    const isObject = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
    const isArray = (v: any) => Array.isArray(v);

    const toggle = (key: string | number) => {
      open.value[key] = !open.value[key];
    };

    return { open, isObject, isArray, toggle };
  },
});

// Allow recursive self-reference
(YamlNode as any).components = { 'yaml-node': YamlNode };

export default YamlNode;
</script>

<style scoped>
.yaml-node code {
  white-space: pre-wrap;
}
</style>
