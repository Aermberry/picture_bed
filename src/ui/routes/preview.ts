import fs from 'node:fs';
import path from 'node:path';
import { isImageExt, mimeOf } from '../../lib/img.js';
import { isUnderRoot } from '../../lib/paths.js';
import { envelope, sendRaw } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** GET /api/preview?path=… ：仅下发扫描根内的图片。 */
export function previewRoute(ctx: UiRouteContext): boolean {
  if (ctx.method !== 'GET' || ctx.pathname !== '/api/preview') return false;

  const p = ctx.url.searchParams.get('path') || '';
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
  );
  return true;
}
