import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test file patterns
    include: ['**/__tests__/**/*.{ts,js}', '**/*.{test,spec}.{ts,js}', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'build', 'dist'],

    // Environment configuration
    environment: 'node',
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,js}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,js}',
        'src/**/*.spec.{ts,js}',
        'src/**/__tests__/**',
        'src/**/__mocks__/**',
        'src/**/types/**',
        'build',
        'dist',
        'node_modules'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      },
      skipFull: false,
      all: true
    },

    // Timeout configuration
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results.json',
      html: './test-report.html'
    },

    // Setup files (will create this next)
    setupFiles: ['./tests/setup.ts'],

    // Mock configuration
    clearMocks: true,
    restoreMocks: true,

    // Concurrent testing
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4
      }
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests')
    }
  },

  // ESBuild configuration for TypeScript
  esbuild: {
    target: 'node20'
  }
});

