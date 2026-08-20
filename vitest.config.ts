import { defineConfig } from 'vitest/config';

// Deliberately not vite.config.ts: that one loads the CRX plugin, which builds a
// whole extension bundle from manifest.json — irrelevant here and slow. These
// tests cover the pure logic in src/lib, so they need no browser and no bundler.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
