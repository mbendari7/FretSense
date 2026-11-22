import { defineConfig } from 'vitest/config';

// SC-010 / Constitution III: >= 90% line and branch coverage on the theory engine.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
