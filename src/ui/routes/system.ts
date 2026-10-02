import {
  asAppError,
  createRepoDir,
  currentToken,
  doctorService,
  githubProbe,
  httpStatusForCode,
  listManifestView,
} from '../../app/index.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** 系统类只读端点：doctor 自检 + manifest 视图 + 远程目录创建。 */
export async function systemRoutes(ctx: UiRouteContext): Promise<boolean> {
  if (ctx.method === 'POST' && ctx.pathname === '/api/doctor') {
    const cfg = ctx.loadCfg();
    const view = await doctorService({ cfg, getToken: currentToken, probeApi: githubProbe });
    ctx.send(view.ok ? 200 : 400, envelope(view.ok, 'api.doctor', view, view.ok ? null : {
      code: 'E_DOCTOR',
      message: 'doctor failed: ' + view.failures.join(','),
      hint: 'token: PICBED_GITHUB_TOKEN / GITHUB_TOKEN / gh auth token',
    }));
    return true;
  }

  if (ctx.method === 'GET' && ctx.pathname === '/api/manifest') {
    const view = listManifestView(ctx.cwd);
    if (!view.ok) {
      ctx.send(400, envelope(false, 'api.manifest', { entries: [] }, view.error));
      return true;
    }
    ctx.send(200, envelope(true, 'api.manifest', view));
    return true;
  }

  if (ctx.method === 'POST' && ctx.pathname === '/api/repo/mkdir') {
    // 新建远程目录：GitHub 无空目录 API，以空 .gitkeep 占位提交
    const body = JSON.parse((await ctx.readBody()) || '{}') as {
      path?: string;
      confirm?: boolean;
    };
    try {
      const result = await createRepoDir({
        cfg: ctx.loadCfg(),
        getToken: currentToken,
        path: body.path ?? '',
        confirm: body.confirm === true,
      });
      ctx.send(200, envelope(true, 'api.repo.mkdir', result));
    } catch (e) {
      const appErr = asAppError(e, 'E_REMOTE');
      ctx.send(
        httpStatusForCode(appErr.code),
        envelope(false, 'api.repo.mkdir', undefined, {
          code: appErr.code,
          message: appErr.message,
          ...(appErr.hint ? { hint: appErr.hint } : {}),
        }),
      );
    }
    return true;
  }

  return false;
}
