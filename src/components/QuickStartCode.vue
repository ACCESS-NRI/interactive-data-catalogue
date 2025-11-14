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
    <!-- Long URL confirmation dialog -->
    <Dialog v-model:visible="showLongUrlDialog" header="Long link warning" modal>
      <p class="text-sm text-gray-700 dark:text-gray-200">
        The generated link is <strong>{{ pendingUrlLength }}</strong> characters long and may not work
        in some browsers, servers, or when pasted into email clients.
      </p>
      <p class="text-sm text-gray-600 dark:text-gray-300 mt-2">Do you want to copy it to the clipboard anyway?</p>
      <div class="mt-4 flex justify-end space-x-2">
        <Button label="Cancel" class="p-button-text" @click="cancelCopyLongUrl" />
        <Button label="Copy anyway" icon="pi pi-copy" @click="confirmCopyLongUrl" />
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import Dialog from 'primevue/dialog'

// Props
interface Props {
  datastoreName: string
  currentFilters: Record<string, string[]>
  rawData: any[]
}

const props = defineProps<Props>()

// Vue Router
const router = useRouter()

// Reactive state
const isXArrayMode = ref(false)

// Dialog / long-URL state
const MAX_URL_LENGTH = 2083 // conservative legacy-safe limit (IE)
const showLongUrlDialog = ref(false)
const pendingLongUrl = ref('')
const pendingUrlLength = ref(0)

const confirmCopyLongUrl = async () => {
  try {
    await navigator.clipboard.writeText(pendingLongUrl.value)
    showLongUrlDialog.value = false
    console.log('Query link copied to clipboard (long):', pendingLongUrl.value)
  } catch (err) {
    console.error('Failed to copy long link:', err)
  }
}

const cancelCopyLongUrl = () => {
  showLongUrlDialog.value = false
  pendingLongUrl.value = ''
  pendingUrlLength.value = 0
  console.log('User cancelled copying long URL')
}

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
  // Build query parameters from current filters
  const query: Record<string, string> = {}
  
  for (const [column, values] of Object.entries(props.currentFilters)) {
    if (values && values.length > 0) {
      query[`${column}_filter`] = values.join(',')
    }
  }
  
  // Use Vue Router's resolve to get the full URL
  const route = router.resolve({
    name: 'DatastoreDetail',
    params: { name: props.datastoreName },
    query
  })
  
  // Get the full URL by combining the origin with the resolved route
  const fullUrl = new URL(route.href, window.location.origin).toString()
  
  // If URL is long, show dialog to confirm before copying
  if (fullUrl.length > MAX_URL_LENGTH) {
    pendingLongUrl.value = fullUrl
    pendingUrlLength.value = fullUrl.length
    showLongUrlDialog.value = true
    return
  }

  try {
    await navigator.clipboard.writeText(fullUrl)
    // TODO: Show toast notification
    console.log('Query link copied to clipboard:', fullUrl)
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