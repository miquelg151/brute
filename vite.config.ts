import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths, so the build works under any sub-path (e.g. GitHub Pages).
  base: './',
  // A new id on every build: art URLs carry it, so phones fetch changed PNGs right away.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
