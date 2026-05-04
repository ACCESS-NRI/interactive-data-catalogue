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

// Get app version: exact tag > last tag + '.dirty' > 'dev'
const getAppVersion = () => {
  try {
    return execSync('git describe --tags --exact-match HEAD').toString().trim();
  } catch {
    try {
      const lastTag = execSync('git describe --tags --abbrev=0').toString().trim();
      return `${lastTag}.dirty`;
    } catch {
      return 'dev';
    }
  }
};

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/interactive-data-catalogue/' : '/',
  plugins: [vue()],
  define: {
    __GIT_COMMIT_SHA__: JSON.stringify(getGitCommitSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(getAppVersion()),
  },
  server: {
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
        'dist/assets/**',
      ],
    },
  },
});
