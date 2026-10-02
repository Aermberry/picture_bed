import { currentToken, runSync } from '../../app/index.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** 监听模式：状态 / 启动（preview | confirm-each | auto）/ 停止。 */
export async function watchRoutes(ctx: UiRouteContext): Promise<boolean> {
  if (ctx.method === 'GET' && ctx.pathname === '/api/watch') {
    ctx.send(200, envelope(true, 'api.watch', ctx.watch.state));
    return true;
  }

  if (ctx.method === 'POST' && ctx.pathname === '/api/watch/start') {
    const body = JSON.parse((await ctx.readBody()) || '{}') as {
      mode?: 'preview' | 'confirm-each' | 'auto';
      debounceMs?: number;
      confirm?: boolean;
    };
    const root = ctx.binder.requireRoot();
    const mode = body.mode ?? 'preview';
    if (mode === 'auto' && body.confirm !== true) {
      ctx.send(409, envelope(false, 'api.watch.start', undefined, {
        code: 'E_CONFIRM',
        message: 'auto mode must be explicitly enabled with confirm: true',
      }));
      return true;
    }
    const cfg = ctx.loadCfg();
    const state = ctx.watch.start({
      root,
      debounceMs: body.debounceMs,
      mode,
      onBatch: async (changed, m) => {
        if (m === 'confirm-each') {
          ctx.watch.state.events.push({
            at: new Date().toISOString(),
            message: 'awaiting confirm for batch (call /api/sync)',
            changed,
          });
          return;
        }
        if (m === 'auto') {
          await runSync({ root, cfg, cwd: ctx.cwd, getToken: currentToken, command: 'api.sync' });
        }
      },
    });
    ctx.send(200, envelope(true, 'api.watch.start', state));
    return true;
  }

  if (ctx.method === 'POST' && ctx.pathname === '/api/watch/stop') {
    ctx.send(200, envelope(true, 'api.watch.stop', ctx.watch.stop()));
    return true;
  }

  return false;
}
