import { createRouter, createWebHistory } from 'vue-router'
import CatalogTable from '../components/CatalogTable.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: CatalogTable,
    meta: {
      title: 'Interactive Catalog'
    }
  },
  // Future routes can be added here
  // {
  //   path: '/about',
  //   name: 'About',
  //   component: () => import('../views/About.vue')
  // }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Optional: Set page title based on route meta
router.beforeEach((to, _from, next) => {
  if (to.meta?.title) {
    document.title = to.meta.title as string
  }
  next()
})

export default router