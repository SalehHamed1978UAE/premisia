import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Config for pure unit tests that don't need database
 * Run with: npx vitest run --config vitest.unit.config.ts
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // NO setup files - pure unit tests
    testTimeout: 10000,
    include: [
      'tests/bridges/bridge-unit.test.ts',
      'tests/item-c-clarifications.test.ts',
      'tests/t1-t8-validation.test.ts',
      'tests/sprint6-validation.spec.ts',
    ],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@': path.resolve(__dirname, './client/src'),
    },
  },
});
