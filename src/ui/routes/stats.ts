import { currentToken, emptyStatsView, buildStatsView } from '../../app/index.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** 使用统计：GET /api/stats → F25 统计视图聚合（本地 manifest/runs + 远端补充）。 */
export async function statsRoutes(ctx: UiRouteContext): Promise<boolean> {
  if (ctx.method !== 'GET' || ctx.pathname !== '/api/stats') return false;
  try {
    const view = await buildStatsView({ cwd: ctx.cwd, cfg: ctx.loadCfg(), getToken: currentToken });
    ctx.send(200, envelope(true, 'api.stats', view, undefined, view.warnings));
  } catch (e) {
    // 兜底：聚合异常也返回完整形状的空视图（无 500 路径）；warnings 双写保持信封契约
    const w = [`统计聚合失败：${e instanceof Error ? e.message : String(e)}`];
    ctx.send(200, envelope(true, 'api.stats', emptyStatsView(w), undefined, w));
  }
  return true;
}
