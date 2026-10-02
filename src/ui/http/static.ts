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

/** Renderer 根目录（Vite root）：包根/renderer。 */
function rendererRoot(): string {
  return fileURLToPath(new URL('../../../renderer', import.meta.url));
}

/** Renderer entry JS (Vite root `renderer/main.js`). 每次重新读取，桌面端刷新即生效。 */
export function rendererMainJs(): string | null {
  try {
    return fs.readFileSync(path.join(rendererRoot(), 'main.js'), 'utf8');
  } catch {
    return null;
  }
}

/** 允许的静态资源类型（收紧到渲染器实际用到的几种）。 */
const ASSET_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * Renderer 子模块静态下发：`renderer/main.js` 按 ESM 拆到 `renderer/src/**`，
 * 浏览器会按相对路径回源，服务器必须能提供（与 Vite dev 的 /src/** 同形）。
 * 只允许 src/ 树内的白名单后缀，禁止 `..` 与目录逃逸。
 */
export function rendererAsset(rel: string): { body: Buffer; type: string } | null {
  if (!/^\/?src\/[A-Za-z0-9_./-]+$/.test(rel)) return null;
  if (rel.includes('..')) return null;
  const root = rendererRoot();
  const file = path.resolve(root, rel.replace(/^\/+/, ''));
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  const type = ASSET_TYPES[path.extname(file).toLowerCase()];
  if (!type) return null;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return { body: fs.readFileSync(file), type };
}
