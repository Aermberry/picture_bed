import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INDEX_HTML } from '../static.js';

/**
 * 「规范」入口仅本地调试可见（F23/F24）。
 * PICBED_UI_DEV=1/0 优先；否则源码树（包根有 src/ui/static.ts）视为 dev。
 */
export function detectUiDevMode(explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit;
  const env = process.env.PICBED_UI_DEV;
  if (env === '1') return true;
  if (env === '0') return false;
  try {
    // http/static.ts 位于 src/ui/http/（或 dist/ui/http/）→ 上溯三级为包根
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    return fs.existsSync(path.join(root, 'src', 'ui', 'static.ts'));
  } catch {
    return false;
  }
}

/** 注入 UI dev 标记后的 index.html。 */
export function renderIndexHtml(dev: boolean): string {
  return INDEX_HTML.replace(
    'window.__PICBED_UI_DEV__ = window.__PICBED_UI_DEV__ ?? false;',
    `window.__PICBED_UI_DEV__ = ${dev ? 'true' : 'false'};`,
  );
}

/** Renderer entry JS (Vite root `renderer/main.js`). 每次重新读取，桌面端刷新即生效。 */
export function rendererMainJs(): string | null {
  try {
    return fs.readFileSync(fileURLToPath(new URL('../../../renderer/main.js', import.meta.url)), 'utf8');
  } catch {
    return null;
  }
}
