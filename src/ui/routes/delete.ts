import { currentToken, httpStatusForCode, runDelete } from '../../app/index.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** POST /api/delete：删除一张已上传图（远端资产 + 回写文档 + 清 manifest）。ConfirmGate + dryRun。 */
export async function deleteRoute(ctx: UiRouteContext): Promise<boolean> {
  if (ctx.method !== 'POST' || ctx.pathname !== '/api/delete') return false;

  const body = JSON.parse((await ctx.readBody()) || '{}') as {
    sha256?: string;
    confirm?: boolean;
    dryRun?: boolean;
  };
  const root = ctx.binder.requireRoot();
  const cfg = ctx.loadCfg();

  if (!body.sha256 || !/^[0-9a-fA-F]{16,}$/.test(body.sha256)) {
    ctx.send(400, envelope(false, 'api.delete', undefined, {
      code: 'E_BAD_REQUEST',
      message: 'sha256 required (hex, >=16 chars)',
    }));
    return true;
  }

  if (!body.dryRun && body.confirm !== true) {
    ctx.send(409, envelope(false, 'api.delete', undefined, {
      code: 'E_CONFIRM',
      message: 'delete removes remote asset and rewrites docs; set confirm: true (or dryRun: true)',
    }));
    return true;
  }

  const result = await runDelete({
    root,
    cfg,
    cwd: ctx.cwd,
    sha256: body.sha256,
    dryRun: Boolean(body.dryRun),
    getToken: currentToken,
    command: 'api.delete',
  });
  if (!result.ok && (result.errorCode === 'E_MANIFEST_CORRUPT' || result.errorCode === 'E_NOT_FOUND' || result.errorCode === 'E_LOCAL')) {
    ctx.send(httpStatusForCode(result.errorCode), envelope(false, 'api.delete', result, {
      code: result.errorCode,
      message: result.errors.join('; '),
    }));
    return true;
  }
  ctx.send(
    result.ok ? 200 : httpStatusForCode(result.errorCode),
    envelope(result.ok, 'api.delete', result, result.ok ? null : {
      code: result.errorCode ?? 'E_PARTIAL',
      message: result.errors.join('; '),
    }),
  );
  return true;
}
