import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'
import Aura from '@primeuix/themes/aura'

// PrimeVue imports
import PrimeVue from 'primevue/config'
import 'primeicons/primeicons.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(PrimeVue, {
    theme: {
        preset: Aura
    }
})

app.mount('#app')

// Expose store globally for debugging
if (import.meta.env.DEV) {
  import('./stores/catalogStore').then(({ useCatalogStore }) => {
    ;(window as any).catalogStore = useCatalogStore()
  })
}
