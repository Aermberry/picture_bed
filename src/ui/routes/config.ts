import {
  asAppError,
  httpStatusForCode,
  importConfigToml,
  publicConfig,
  serializeConfigToml,
  writeConfigKey,
} from '../../app/index.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** 配置读写与导入导出（绝不含 token）。 */
export async function configRoutes(ctx: UiRouteContext): Promise<boolean> {
  if (ctx.method === 'GET' && ctx.pathname === '/api/config') {
    const cfg = ctx.loadCfg();
    ctx.send(200, envelope(true, 'api.config', publicConfig(cfg, { root: ctx.binder.root })));
    return true;
  }

  if (ctx.method === 'POST' && ctx.pathname === '/api/config') {
    const body = JSON.parse((await ctx.readBody()) || '{}') as {
      key?: string;
      value?: string;
      confirm?: boolean;
      dryRun?: boolean;
    };
    if (body.confirm !== true && !body.dryRun) {
      ctx.send(409, envelope(false, 'api.config', undefined, {
        code: 'E_CONFIRM',
        message: 'config set writes files; set confirm: true (or dryRun: true)',
      }));
      return true;
    }
    const cfg = ctx.loadCfg();
    const out = writeConfigKey(cfg, body.key ?? '', body.value ?? '', Boolean(body.dryRun));
    ctx.send(200, envelope(true, 'api.config', out));
    return true;
  }

  if (ctx.method === 'GET' && ctx.pathname === '/api/config/export') {
    // 导出：可移植 picbed.toml 文本；绝不含 token
    ctx.send(200, envelope(true, 'api.config.export', { toml: serializeConfigToml(ctx.loadCfg()) }));
    return true;
  }

  if (ctx.method === 'POST' && ctx.pathname === '/api/config/import') {
    const body = JSON.parse((await ctx.readBody()) || '{}') as {
      toml?: string;
      confirm?: boolean;
      dryRun?: boolean;
    };
    if (body.confirm !== true && !body.dryRun) {
      ctx.send(409, envelope(false, 'api.config.import', undefined, {
        code: 'E_CONFIRM',
        message: 'config import writes files; set confirm: true (or dryRun: true)',
      }));
      return true;
    }
    const toml = String(body.toml ?? '');
    if (!toml.trim()) {
      ctx.send(400, envelope(false, 'api.config.import', undefined, {
        code: 'E_USAGE',
        message: 'toml is empty；请提供导出的 picbed.toml 文本',
      }));
      return true;
    }
    try {
      const cfg = ctx.loadCfg();
      const out = importConfigToml(cfg, toml, Boolean(body.dryRun));
      ctx.send(200, envelope(true, 'api.config.import', {
        file: out.file,
        dryRun: out.dryRun,
        config: publicConfig(out.config),
      }));
    } catch (e) {
      const appErr = asAppError(e);
      ctx.send(httpStatusForCode(appErr.code), envelope(false, 'api.config.import', undefined, appErr));
    }
    return true;
  }

  return false;
}
