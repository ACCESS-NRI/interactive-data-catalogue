import { createRouter, createWebHashHistory } from 'vue-router';
import { ref } from 'vue';
import MetacatTable from '../components/MetacatTable.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: MetacatTable,
    meta: {
      title: 'ACCESS-NRI Intake',
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

router.afterEach(() => {
  // Small delay to ensure component is mounted
  setTimeout(() => {
    isNavigating.value = false;
  }, 100);
});

export default router;
