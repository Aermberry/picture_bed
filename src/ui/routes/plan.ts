import path from 'node:path';
import { publicPlanItem, runPlan } from '../../app/index.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** POST /api/scan（文档+引用概览）与 /api/plan（可预览计划）。 */
export async function planRoutes(ctx: UiRouteContext): Promise<boolean> {
  if (ctx.method !== 'POST') return false;

  if (ctx.pathname === '/api/scan') {
    const root = ctx.binder.requireRoot();
    const cfg = ctx.loadCfg();
    const { collected, plan } = await runPlan(root, cfg, ctx.cwd);
    ctx.send(
      200,
      envelope(true, 'api.scan', {
        root,
        docs: collected.docs.map((d) => path.relative(ctx.cwd, d.path).split(path.sep).join('/')),
        refCount: plan.length,
        assets: collected.assets.map((a) => ({
          localPath: a.localPath,
          sha256: a.sha256,
          bytes: a.bytes,
          refs: a.refs.length,
        })),
        blocked: collected.blocked.map((b) => ({
          raw: b.ref.raw,
          code: b.code,
          reason: b.reason,
        })),
        plan: plan.map(publicPlanItem),
      }, null, collected.warnings),
    );
    return true;
  }

  if (ctx.pathname === '/api/plan') {
    const root = ctx.binder.requireRoot();
    const cfg = ctx.loadCfg();
    const { plan, summary, collected } = await runPlan(root, cfg, ctx.cwd);
    ctx.send(
      200,
      envelope(true, 'api.plan', { plan: plan.map(publicPlanItem), summary }, null, collected.warnings),
    );
    return true;
  }

  return false;
}
