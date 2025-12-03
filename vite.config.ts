/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { execSync } from 'child_process';

// Get git commit SHA
const getGitCommitSha = () => {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
};

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/catalog-viewer-spa/' : '/',
  plugins: [vue()],
  define: {
    __GIT_COMMIT_SHA__: JSON.stringify(getGitCommitSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    proxy: {
      '/api/parquet': {
        target:
          'https://object-store.rc.nectar.org.au/v1/AUTH_685340a8089a4923a71222ce93d5d323/access-nri-intake-catalog',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/parquet/, ''),
        secure: true,
      },
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.spec.ts',
        '**/*.d.ts',
        'vite.config.ts',
        'tailwind.config.js',
        'postcss.config.js',
      ],
    },
  },
});
