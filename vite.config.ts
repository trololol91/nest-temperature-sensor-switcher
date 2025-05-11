import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    coverage: {
      provider: 'v8',
      exclude: ['src/api/__tests__/utils/*'],
      include: ['src/api/**/*.{mts}'],
    },
  }
});
