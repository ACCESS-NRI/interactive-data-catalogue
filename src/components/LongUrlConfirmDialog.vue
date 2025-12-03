<template>
  <Dialog v-model:visible="isVisible" header="Long link warning" modal @update:visible="handleVisibilityChange">
    <p class="text-sm text-gray-700 dark:text-gray-200">
      The generated link is <strong>{{ urlLength }}</strong> characters long and may not work in some browsers, servers,
      or when pasted into email clients.
    </p>
    <p class="text-sm text-gray-600 dark:text-gray-300 mt-2">Do you want to copy it to the clipboard anyway?</p>
    <div class="mt-4 flex justify-end space-x-2">
      <Button label="Cancel" class="p-button-text" @click="handleCancel" />
      <Button label="Copy anyway" icon="pi pi-copy" @click="handleConfirm" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';

/**
 * Component props for LongUrlConfirmDialog.
 *
 * A confirmation dialog shown when attempting to copy a URL that exceeds
 * browser/client length limits.
 */
interface Props {
  /**
   * Whether the dialog is visible.
   */
  visible: boolean;

  /**
   * The URL that the user wants to copy.
   */
  url: string;

  /**
   * The length of the URL in characters.
   */
  urlLength: number;
}

const props = defineProps<Props>();

/**
 * Emitted events for LongUrlConfirmDialog.
 */
interface Emits {
  /**
   * Emitted when the visibility state changes.
   */
  (e: 'update:visible', value: boolean): void;

  /**
   * Emitted when the user confirms they want to copy the long URL.
   */
  (e: 'confirm', url: string): void;

  /**
   * Emitted when the user cancels the operation.
   */
  (e: 'cancel'): void;
}

const emit = defineEmits<Emits>();

// Local visibility state (synced with prop)
const isVisible = ref(props.visible);

// Watch for prop changes
watch(
  () => props.visible,
  (newValue) => {
    isVisible.value = newValue;
  },
);

/**
 * Handle visibility changes from the dialog component.
 */
const handleVisibilityChange = (value: boolean): void => {
  emit('update:visible', value);
};

/**
 * Handle the user confirming they want to copy the long URL.
 */
const handleConfirm = (): void => {
  emit('confirm', props.url);
};

/**
 * Handle the user canceling the operation.
 */
const handleCancel = (): void => {
  emit('cancel');
};
</script>
