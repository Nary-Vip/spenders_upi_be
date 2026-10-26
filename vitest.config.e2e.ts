import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // Nest loads this polyfill at runtime; specs that skip Nest need it too.
    setupFiles: ['reflect-metadata'],
    root: './',
    include: ['**/*.e2e-spec.ts', '**/*.int-spec.ts'],
    fileParallelism: false,
  },
});
