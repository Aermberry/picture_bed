import { getRun, listRuns } from '../../app/index.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** 运行记录：列表 + 单条。 */
export function runsRoutes(ctx: UiRouteContext): boolean {
  if (ctx.method === 'GET' && ctx.pathname === '/api/runs') {
    ctx.send(200, envelope(true, 'api.runs', { runs: listRuns(ctx.cwd) }));
    return true;
  }

  const runMatch = /^\/api\/runs\/([a-zA-Z0-9_-]+)$/.exec(ctx.pathname);
  if (ctx.method === 'GET' && runMatch) {
    const run = getRun(ctx.cwd, runMatch[1]);
    if (!run) {
      ctx.send(404, envelope(false, 'api.runs.get', undefined, { code: 'E_USAGE', message: 'run not found' }));
      return true;
    }
    ctx.send(200, envelope(true, 'api.runs.get', run));
    return true;
  }

  return false;
}
