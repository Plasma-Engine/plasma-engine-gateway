/**
 * Global test setup for Plasma Engine Gateway tests.
 *
 * This file is executed before all test files and configures
 * the testing environment with mocks and global utilities.
 */

import { vi } from 'vitest';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test timeout
vi.setConfig({ testTimeout: 10000 });

// Mock console methods for cleaner test output
const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
};

// Store original console methods
const originalConsole = { ...console };

// Global test setup
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();

  // Mock console for tests unless explicitly needed
  if (!process.env.VITEST_VERBOSE_CONSOLE) {
    Object.assign(console, mockConsole);
  }
});

afterEach(() => {
  // Restore console after each test
  Object.assign(console, originalConsole);
});

// Global test utilities
declare global {
  var testUtils: {
    mockConsole: typeof mockConsole;
    originalConsole: typeof originalConsole;
    createMockRequest: (overrides?: any) => any;
    createMockResponse: (overrides?: any) => any;
  };
}

// Make test utilities available globally
globalThis.testUtils = {
  mockConsole,
  originalConsole,

  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    method: 'GET',
    path: '/',
    ...overrides
  }),

  createMockResponse: (overrides = {}) => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    ...overrides
  })
};

// Environment variable defaults for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '4001';  // Use different port for tests