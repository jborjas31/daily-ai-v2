import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    // Stabilize in constrained environments (e.g., Node 18 in CI/CLI sandboxes)
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: true },
    },
  },
});
