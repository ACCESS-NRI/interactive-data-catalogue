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
    path: '/cmip',
    name: 'CmipSearch',
    component: () => import('../components/CmipSearch.vue'),
    meta: { title: 'CMIP data | ACCESS-NRI Data Catalogue' },
  },
  {
    path: '/cmip7',
    name: 'Cmip7Search',
    redirect: (to: { query: Record<string, unknown> }) => ({
      name: 'CmipSearch',
      query: { ...to.query, project: 'CMIP7' },
    }),
  },
  {
    path: '/cmip6',
    redirect: (to: { query: Record<string, unknown> }) => ({
      name: 'CmipSearch',
      query: { ...to.query, project: 'CMIP6' },
    }),
  },
  {
    path: '/datastore/:name',
    name: 'DatastoreDetail',
    component: () => import('../components/DatastoreDetail.vue'),
    meta: {
      title: 'ESM Datastore Details',
    },
  },
  {
    path: '/personal-datastore',
    name: 'PersonalDatastore',
    component: () => import('../components/PersonalDatastore.vue'),
    meta: {
      title: 'Personal Datastore',
    },
  },
  {
    path: '/personal-datastore/:name',
    name: 'PersonalDatastoreDetail',
    component: () => import('../components/PersonalDatastore.vue'),
    meta: {
      title: 'Personal Datastore',
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
