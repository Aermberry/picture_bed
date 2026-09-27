import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname);

/**
 * electron-vite · picbed desktop
 * - main/preload: desktop/ (ESM main + CJS preload)
 * - renderer: renderer/ (vanilla HTML/CSS/JS, talks to same-origin /api)
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve(root, 'out/main'),
      // CJS: Electron 33 main-process ESM interop (node:module createRequire) is brittle
      lib: {
        entry: resolve(root, 'desktop/main.mjs'),
        formats: ['cjs'],
      },
      rollupOptions: {
        external: ['electron'],
        output: { entryFileNames: 'main.cjs' },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve(root, 'out/preload'),
      lib: {
        entry: resolve(root, 'desktop/preload.cjs'),
        formats: ['cjs'],
      },
      rollupOptions: {
        output: { entryFileNames: 'preload.cjs' },
      },
    },
  },
  renderer: {
    root: resolve(root, 'renderer'),
    build: {
      outDir: resolve(root, 'out/renderer'),
      rollupOptions: {
        input: resolve(root, 'renderer/index.html'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Same-origin /api/* contract as createUiServer (F16–F22)
        '/api': {
          target: process.env.PICBED_UI_API || 'http://127.0.0.1:4780',
          changeOrigin: true,
        },
      },
    },
  },
});
