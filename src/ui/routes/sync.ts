import { currentToken, httpStatusForCode, publicPlanItem, runPlan, runSync } from '../../app/index.js';
import { ensureDocExt } from '../root.js';
import { isImageExt } from '../../lib/img.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

const isImagePath = isImageExt;

/** POST /api/sync：ConfirmGate + dryRun + 工作集作用域。 */
export async function syncRoute(ctx: UiRouteContext): Promise<boolean> {
  if (ctx.method !== 'POST' || ctx.pathname !== '/api/sync') return false;

  const body = JSON.parse((await ctx.readBody()) || '{}') as {
    confirm?: boolean;
    dryRun?: boolean;
  };
  const root = ctx.binder.requireRoot();
  const cfg = ctx.loadCfg();

  // UI 上传作用域为投放工作集（图片 + 文档；目录已拒绝）。
  const worksetDocs: string[] = [];
  const worksetImages: string[] = [];
  for (const w of ctx.workset) {
    const p = w.resolvedPath || '';
    if (!p || w.type !== 'file') continue;
    if (isImagePath(p)) worksetImages.push(p);
    else if (ensureDocExt(p, cfg.scan.extensions)) worksetDocs.push(p);
  }
  const scoped = worksetDocs.length > 0 || worksetImages.length > 0;
  const includeDocs = scoped ? worksetDocs : undefined;
  const includeImages = scoped ? worksetImages : undefined;

  if (body.dryRun) {
    const { plan, summary, collected } = await runPlan(
      root,
      cfg,
      ctx.cwd,
      includeDocs ? { includeDocs } : undefined,
    );
    ctx.send(200, envelope(true, 'api.sync', {
      dryRun: true,
      plan: plan.map(publicPlanItem),
      summary,
      uploaded: 0,
      rewrittenDocs: [],
      items: [],
    }, null, collected.warnings));
    return true;
  }

  // ConfirmGate：写操作必须显式 confirm（退出码 7 语义）
  if (body.confirm !== true) {
    ctx.send(409, envelope(false, 'api.sync', undefined, {
      code: 'E_CONFIRM',
      message: 'sync writes documents and uploads; set confirm: true',
    }));
    return true;
  }

  const result = await runSync({
    root,
    cfg,
    cwd: ctx.cwd,
    getToken: currentToken,
    command: 'api.sync',
    includeDocs,
    includeImages,
  });
  const errorCode = result.errorCode ?? 'E_PARTIAL';
  ctx.send(
    result.ok ? 200 : httpStatusForCode(errorCode),
    envelope(result.ok, 'api.sync', {
      dryRun: false,
      uploaded: result.uploaded,
      rewrittenDocs: result.rewrittenDocs,
      summary: result.summary,
      items: result.items,
      errors: result.errors,
      partial: result.partial,
    }, result.ok ? null : { code: errorCode, message: result.errors.join('; ') }, result.warnings),
  );
  return true;
}
