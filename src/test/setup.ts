import { config } from '@vue/test-utils';

// Global test setup for Vue Test Utils
// This file runs before all test files

// Configure Vue Test Utils global options
config.global.stubs = {
  // Add global component stubs here if needed
  // Example: 'RouterLink': true
};

// Add any global mocks or configuration here
// Example: mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});
