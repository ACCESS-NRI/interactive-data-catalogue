<template>
  <Button
    type="button"
    icon="pi pi-github"
    label="Give us feedback"
    class="p-button-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
    title="Open a new issue pre-filled with the feedback template"
    @click="openFeedbackIssue"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button';

const openFeedbackIssue = () => {
  const url = 'https://github.com/access-nri/interactive-data-catalogue/issues/new?template=feedback.yml';
  const newWin = window.open(url, '_blank', 'noopener,noreferrer');
  if (newWin) newWin.opener = null;
};
</script>
<style scoped></style>
