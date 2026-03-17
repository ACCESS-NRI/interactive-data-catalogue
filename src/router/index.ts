import { createRouter, createWebHashHistory } from 'vue-router';
import { ref } from 'vue';
import MetacatTable from '../components/MetacatTable.vue';
import { posthog } from '../composables/usePosthog';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: MetacatTable,
    meta: {
      title: 'ACCESS-NRI Data Catalogue',
    },
  },
  {
    path: '/datastore/:name',
    name: 'DatastoreDetail',
    component: () => import('../components/DatastoreDetail.vue'),
    meta: {
      title: 'ESM Datastore Details',
    },
  },
  // Future routes can be added here
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// Global loading state for navigation
export const isNavigating = ref(false);

// Set page title and show loading during navigation
router.beforeEach((to, _from, next) => {
  isNavigating.value = true;
  if (to.meta?.title) {
    document.title = to.meta.title as string;
  }
  next();
});

router.afterEach((to) => {
  // Small delay to ensure component is mounted
  setTimeout(() => {
    isNavigating.value = false;
  }, 100);
  posthog.capture('$pageview', { $current_url: window.location.origin + to.fullPath });
});

export default router;
