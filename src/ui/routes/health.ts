import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

export function healthRoute(ctx: UiRouteContext): boolean {
  if (ctx.method !== 'GET' || ctx.pathname !== '/api/health') return false;
  ctx.send(200, envelope(true, 'api.health', { ok: true, rootBound: Boolean(ctx.binder.root) }));
  return true;
}
