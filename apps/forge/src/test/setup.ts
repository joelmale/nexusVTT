// Test setup file for Vitest
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
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
    dispatchEvent: () => {},
  }),
});

// Mock ResizeObserver
(globalThis as unknown as { ResizeObserver: new () => unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
(globalThis as unknown as { IntersectionObserver: new () => unknown }).IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};