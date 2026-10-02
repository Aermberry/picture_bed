import { httpStatusForCode, runRevert } from '../../app/index.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** POST /api/revert：ConfirmGate + dryRun；清单损坏单独成 400。 */
export async function revertRoute(ctx: UiRouteContext): Promise<boolean> {
  if (ctx.method !== 'POST' || ctx.pathname !== '/api/revert') return false;

  const body = JSON.parse((await ctx.readBody()) || '{}') as {
    confirm?: boolean;
    dryRun?: boolean;
  };
  const root = ctx.binder.requireRoot();
  const cfg = ctx.loadCfg();

  if (!body.dryRun && body.confirm !== true) {
    ctx.send(409, envelope(false, 'api.revert', undefined, {
      code: 'E_CONFIRM',
      message: 'revert writes files; set confirm: true (or dryRun: true)',
    }));
    return true;
  }

  const result = runRevert({
    root,
    cfg,
    cwd: ctx.cwd,
    dryRun: Boolean(body.dryRun),
    command: 'api.revert',
  });
  if (!result.ok && result.errorCode === 'E_MANIFEST_CORRUPT') {
    ctx.send(400, envelope(false, 'api.revert', result, {
      code: 'E_MANIFEST_CORRUPT',
      message: result.errors.join('; '),
    }));
    return true;
  }
  ctx.send(
    result.ok ? 200 : httpStatusForCode(result.errorCode),
    envelope(result.ok, 'api.revert', result, result.ok ? null : {
      code: result.errorCode ?? 'E_PARTIAL',
      message: result.errors.join('; '),
    }),
  );
  return true;
}
