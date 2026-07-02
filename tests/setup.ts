/**
 * @file tests/setup.ts
 * @description Global test setup and configuration for Vitest
 * This file is loaded before all tests run
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { config } from 'dotenv';
import 'fake-indexeddb/auto';

// Load environment variables from .env file for tests
config();

// Auto cleanup after each test
afterEach(() => {
  cleanup();
});

// Only setup window-dependent mocks in jsdom environment
if (typeof window !== 'undefined') {
  // Mock window.matchMedia for tests that use media queries
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock Canvas context for canvas-related tests
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Array(4),
    })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => []),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    fillText: vi.fn(),
    strokeText: vi.fn(),
  }));
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock WebSocket for real-time features
const mockWebSocket = vi.fn().mockImplementation(() => ({
  // These are the INSTANCE properties
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1, // OPEN
  onmessage: vi.fn(),
  onerror: vi.fn(),
  onopen: vi.fn(),
  onclose: vi.fn(),
}));

// Assign the STATIC properties directly to the mock constructor
Object.assign(mockWebSocket, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});
// Assign the mock using a more deliberate type assertion
global.WebSocket = mockWebSocket as unknown as typeof WebSocket;

// Mock Worker for environments where it isn't available (Node test runtime)
class MockWorker {
  postMessage = vi.fn();
  terminate = vi.fn();
  onmessage: ((this: Worker, ev: MessageEvent) => void) | null = null;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}
global.Worker = MockWorker as unknown as typeof Worker;

// Mock localStorage with actual in-memory storage
const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => localStorageData[key] || null,
  setItem: (key: string, value: string) => {
    localStorageData[key] = value;
  },
  removeItem: (key: string) => {
    delete localStorageData[key];
  },
  clear: () => {
    Object.keys(localStorageData).forEach(
      (key) => delete localStorageData[key],
    );
  },
  get length() {
    return Object.keys(localStorageData).length;
  },
  key: (index: number) => {
    const keys = Object.keys(localStorageData);
    return keys[index] || null;
  },
};
global.localStorage = localStorageMock as unknown as Storage;

// Mock sessionStorage with actual in-memory storage
const sessionStorageData: Record<string, string> = {};
const sessionStorageMock = {
  getItem: (key: string) => sessionStorageData[key] || null,
  setItem: (key: string, value: string) => {
    sessionStorageData[key] = value;
  },
  removeItem: (key: string) => {
    delete sessionStorageData[key];
  },
  clear: () => {
    Object.keys(sessionStorageData).forEach(
      (key) => delete sessionStorageData[key],
    );
  },
  get length() {
    return Object.keys(sessionStorageData).length;
  },
  key: (index: number) => {
    const keys = Object.keys(sessionStorageData);
    return keys[index] || null;
  },
};
global.sessionStorage = sessionStorageMock as unknown as Storage;

// Setup test environment variables
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.VITE_WS_URL = 'ws://localhost:5001/ws';
});

// Cleanup after all tests
afterAll(() => {
  vi.clearAllMocks();
  vi.resetAllMocks();
});

// Suppress console messages during tests
const originalLog = console.log;
const originalInfo = console.info;
const originalDebug = console.debug;

beforeAll(() => {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
});

afterAll(() => {
  console.log = originalLog;
  console.info = originalInfo;
  console.debug = originalDebug;
});

// Suppress console errors during tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Export common test utilities
export const waitForAsync = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

export const mockWebSocketMessage = (ws: WebSocket, data: unknown) => {
  const messageEvent = new MessageEvent('message', {
    data: JSON.stringify(data),
  });
  ws.onmessage?.(messageEvent);
};

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  name: 'Test User',
  type: 'player' as const,
  color: 'blue',
  connected: true,
  ...overrides,
});

export const createMockSession = (overrides = {}) => ({
  roomCode: 'TEST',
  hostId: 'host-id',
  players: [createMockUser()],
  status: 'connected' as const,
  ...overrides,
});

export const createMockDiceRoll = (overrides = {}) => ({
  id: 'roll-id',
  userId: 'test-user-id',
  userName: 'Test User',
  expression: '1d20+5',
  result: 18,
  details: {
    dice: [{ sides: 20, result: 13 }],
    modifier: 5,
  },
  timestamp: Date.now(),
  ...overrides,
});
