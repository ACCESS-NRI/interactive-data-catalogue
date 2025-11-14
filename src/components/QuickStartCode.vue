<template>
  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
    <div class="flex items-center justify-between mb-3">
      <h6 class="text-lg font-semibold text-blue-800 dark:text-blue-200 flex items-center">
        <i class="pi pi-code mr-2"></i>
        Quick Start
      </h6>
      
      <!-- Toggle Switch -->
      <div class="flex items-center space-x-3">
        <span class="text-sm text-blue-700 dark:text-blue-300">ESM Datastore</span>
        <ToggleSwitch
          v-model="isXArrayMode"
          onLabel="xarray"
          offLabel="ESM"
          class="w-24"
          size="small"
        />
        <span class="text-sm text-blue-700 dark:text-blue-300">xarray Dataset</span>
      </div>
    </div>
    
    <p class="text-blue-700 dark:text-blue-300 mb-3">
      To access this data{{ hasActiveFilters ? ' with current filters' : '' }}:
    </p>
    
    <!-- Required Projects Section -->
    <div v-if="requiredProjects.length > 0" class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
      <div class="flex items-center mb-2">
        <i class="pi pi-info-circle text-yellow-600 mr-2"></i>
        <strong class="text-yellow-800 dark:text-yellow-200 text-sm">Required Project Access:</strong>
      </div>
      <p class="text-yellow-700 dark:text-yellow-300 text-sm mb-2">
        You will need to be a member of the following project{{ requiredProjects.length > 1 ? 's' : '' }}:
      </p>
      <div class="flex flex-wrap gap-2">
        <span 
          v-for="project in requiredProjects" 
          :key="project"
          class="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-sm font-mono font-medium"
        >
          {{ project }}
        </span>
      </div>
    </div>
    
    <pre class="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto"><code>{{ quickStartCode }}</code></pre>
    
    <div class="mt-3">
      <Button 
        label="Copy Query Link" 
        icon="pi pi-share" 
        @click="copyQueryLink"
        outlined
        size="small"
        class="text-blue-600 border-blue-600 hover:bg-blue-50"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'

// Props
interface Props {
  datastoreName: string
  currentFilters: Record<string, string[]>
  rawData: any[]
}

const props = defineProps<Props>()

// Reactive state
const isXArrayMode = ref(false)

// Computed properties
const hasActiveFilters = computed(() => {
  return Object.values(props.currentFilters).some(value => value && value.length > 0)
})

const requiredProjects = computed(() => {
  const projects = new Set<string>()
  
  // We always require 'xp65' 
  projects.add('xp65')
  
  // Look for path fields in the data
  props.rawData.forEach(row => {
    // Check various possible path field names
    const field = 'path';
    
    if (row[field]) {
      const pathValue = row[field]
      // Match pattern /g/data/{PROJECT}/...
      const match = pathValue.match(/\/g\/data\/([^\/]+)\//)
      if (match) {
        projects.add(match[1])
      }
    }
  })
  
  return Array.from(projects).sort()
})

const numDatasets = computed(() => {
  // Use a Set to count unique datasets - one fileId per dataset
  const fileIds = new Set<string>()

  props.rawData.forEach(row => {
    if (row['file_id']) {
      fileIds.add(row['file_id'])
    }
  })

  return fileIds.size
})

const quickStartCode = computed(() => {
  let code = `# In an ARE session on Gadi: https://are.nci.org.au/pun/sys/dashboard
import intake
datastore = intake.cat.access_nri["${props.datastoreName}"]`
  
  if (hasActiveFilters.value) {
    for (const [column, values] of Object.entries(props.currentFilters)) {
      if (values && values.length > 0) {
        // If multiple values, use an array filter, otherwise use single value
        if (values.length === 1) {
          code += `\ndatastore = datastore.search(${column}='${values[0]}')`
        } else {
          code += `\ndatastore = datastore.search(${column}=${JSON.stringify(values)})`
        }
      }
    }
  }
  
  // Add XArray conversion if in XArray mode
  if (isXArrayMode.value) {

    if (numDatasets.value > 1) {
      code += `\n# Search contains ${numDatasets.value} datasets. This will generate a dataset dictionary: see https://intake-esm.readthedocs.io/en/stable/`
      code += `\n# To get to a single dataset, you will need to filter down to a single File ID.`
      code += `\ndataset_dict = datastore.to_dataset_dict()`
    } else {
    code += `\ndataset = datastore.to_dask()`
    }
  }
  
  return code
})

// Methods
const copyQueryLink = async () => {
  const url = new URL(window.location.href)
  
  // Add filter parameters to URL
  for (const [column, values] of Object.entries(props.currentFilters)) {
    if (values && values.length > 0) {
      url.searchParams.set(`${column}_filter`, values.join(','))
    }
  }
  
  try {
    await navigator.clipboard.writeText(url.toString())
    // TODO: Show toast notification
    console.log('Query link copied to clipboard')
  } catch (err) {
    console.error('Failed to copy link:', err)
  }
}
</script>

<style scoped>
/* Code formatting */
pre code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.4;
}
</style>