import fs from 'node:fs';
import path from 'node:path';
import { isImageExt, mimeOf } from '../../lib/img.js';
import { isInlinePath } from '../../lib/inline.js';
import { isUnderRoot } from '../../lib/paths.js';
import { envelope, sendRaw } from '../http/envelope.js';
import { inlineAssetBytes } from '../inline-cache.js';
import type { UiRouteContext } from '../context.js';

/** 预览图片的安全响应头：禁脚本/禁外联 + 禁内容嗅探（对全部图片统一生效）。 */
const PREVIEW_SAFETY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "sandbox; default-src 'none'",
  'X-Content-Type-Options': 'nosniff',
};

/** GET /api/preview?path=… ：仅下发扫描根内的图片。 */
export function previewRoute(ctx: UiRouteContext): boolean {
  if (ctx.method !== 'GET' || ctx.pathname !== '/api/preview') return false;

  const p = ctx.url.searchParams.get('path') || '';

  // 内嵌图（data:image/*）没有磁盘文件，只能从内存取——必须先于根约束判定，
  // 否则合成路径会被当成「根内但不存在的文件」直接 404。
  if (isInlinePath(p)) {
    const hit = inlineAssetBytes(p);
    if (!hit) {
      ctx.send(404, envelope(false, 'api.preview', undefined, {
        code: 'E_PATH_MISSING',
        message: 'inline image not in cache (run /api/plan first)',
      }));
      return true;
    }
    sendRaw(ctx.res, 200, hit.mime, hit.bytes, PREVIEW_SAFETY_HEADERS);
    return true;
  }

  const root = ctx.binder.requireRoot();
  let abs = p;
  if (!path.isAbsolute(p)) abs = path.resolve(root, p);
  if (!isUnderRoot(root, abs)) {
    ctx.send(400, envelope(false, 'api.preview', undefined, {
      code: 'E_PATH_ESCAPE',
      message: 'path outside scan root',
    }));
    return true;
  }
  if (!isImageExt(abs)) {
    ctx.send(400, envelope(false, 'api.preview', undefined, {
      code: 'E_DOC_EXT',
      message: 'not an image',
    }));
    return true;
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    ctx.send(404, envelope(false, 'api.preview', undefined, {
      code: 'E_PATH_MISSING',
      message: 'image not found',
    }));
    return true;
  }
  sendRaw(
    ctx.res,
    200,
    mimeOf(abs),
    fs.readFileSync(abs),
    // SVG 可内嵌脚本：控制台的 <img> 上下文本就不执行它，但顶层打开
    // /api/preview 会成为文档上下文，故统一加沙箱 + 禁外联/禁嗅探。
    // 字节原样下发（上传/去重仍以 sha256 为准）。
    PREVIEW_SAFETY_HEADERS,
  );
  return true;
}
