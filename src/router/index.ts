import { createRouter, createWebHashHistory } from 'vue-router';
import CatalogTable from '../components/CatalogTable.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: CatalogTable,
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

// Optional: Set page title based on route meta
router.beforeEach((to, _from, next) => {
  if (to.meta?.title) {
    document.title = to.meta.title as string;
  }
  next();
});

export default router;
