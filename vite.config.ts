import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/interactive-catalog-spa/' : '/',
  plugins: [vue()],
  server: {
    proxy: {
      '/api/parquet': {
        target: 'https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/parquet/, ''),
        secure: true
      }
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm']
  },
  worker: {
    format: 'es'
  }
})
