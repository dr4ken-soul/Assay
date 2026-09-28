import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite configuration for the Anna App bundle.
 *
 * `base: './'` keeps every asset reference relative, because the bundle is
 * served from a versioned path rather than the site root. The SDK is loaded at
 * runtime from the host origin with a vite-ignore dynamic import, so it is
 * never bundled and never rewritten.
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
  },
  server: {
    port: 5181,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
})
