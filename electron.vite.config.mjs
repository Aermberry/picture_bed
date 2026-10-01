import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname);
// UI 服务器目标源（与 desktop/main.mjs dev 端口约定一致）
const apiTarget = process.env.PICBED_UI_API || 'http://127.0.0.1:4780';

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
          target: apiTarget,
          changeOrigin: true,
          // 同源契约（module-webui-http-hardening 决策 1）：服务端要求 Origin host == Host host。
          // changeOrigin 只改写 Host；Chromium 对同源 POST 也附 Origin（此处为 Vite 源），
          // 原样转发会被 403 E_ORIGIN。本地受信代理内把 Origin 改写为 API 目标源，
          // 使代理后的请求恢复"同源"形态；外部攻击者无法经过此代理，安全边界不变。
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (proxyReq.getHeader('origin')) {
                proxyReq.setHeader('origin', apiTarget);
              }
            });
          },
        },
      },
    },
  },
});
