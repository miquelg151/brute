import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths, so the build works under any sub-path (e.g. GitHub Pages).
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
