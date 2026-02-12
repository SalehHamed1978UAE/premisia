import { defineConfig } from 'vitest/config';
import path from 'path';

// Item E test config — no database setup needed (pure function tests)
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/item-e-validation.test.ts'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@': path.resolve(__dirname, './client/src'),
    },
  },
});
