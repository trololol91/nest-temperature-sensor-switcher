import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/api/**/*.{mts,ts}'],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80, 
        branches: 80,
        statements: 80,
      }
    },
  },
});
