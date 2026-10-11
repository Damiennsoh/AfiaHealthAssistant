import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@': frontendRoot },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
