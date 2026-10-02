import { probeGh, saveUserToken, startGhLogin, clearSavedToken } from '../../app/index.js';
import { maskToken } from '../../lib/mask.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** PAT 粘贴保存 / 清除：写本机凭据（~/.picbed/credentials.json），不写 picbed.toml。 */
async function tokenRoute(ctx: UiRouteContext): Promise<boolean> {
  if (ctx.method !== 'POST' || ctx.pathname !== '/api/auth/token') return false;

  const body = JSON.parse((await ctx.readBody()) || '{}') as {
    token?: string;
    clear?: boolean;
    confirm?: boolean;
  };
  if (body.confirm !== true) {
    ctx.send(409, envelope(false, 'api.auth.token', undefined, {
      code: 'E_CONFIRM',
      message: 'auth token writes local credentials; set confirm: true',
    }));
    return true;
  }
  if (body.clear) {
    clearSavedToken();
    ctx.send(200, envelope(true, 'api.auth.token', { cleared: true, tokenMask: '' }));
    return true;
  }
  const tok = String(body.token ?? '').trim();
  if (!tok) {
    ctx.send(400, envelope(false, 'api.auth.token', undefined, {
      code: 'E_USAGE',
      message: 'token is empty；请粘贴 GitHub PAT 或改用 clear: true',
    }));
    return true;
  }
  saveUserToken(tok);
  ctx.send(200, envelope(true, 'api.auth.token', { source: 'user', tokenMask: maskToken(tok) }));
  return true;
}

/** gh 一键登录：启动 / 轮询 / 取消（会话状态由 GhLoginStore 持有）。 */
async function ghLoginRoutes(ctx: UiRouteContext): Promise<boolean> {
  const store = ctx.ghLogin;

  if (ctx.method === 'POST' && ctx.pathname === '/api/auth/gh-login/start') {
    if (store.isRunning) {
      ctx.send(409, envelope(false, 'api.auth.gh-login', undefined, {
        code: 'E_RUNNING',
        message: 'gh auth login 正在进行中，请先完成或等待结束',
      }));
      return true;
    }
    const probe = probeGh();
    if (probe.reason === 'not-installed') {
      ctx.send(400, envelope(false, 'api.auth.gh-login', undefined, {
        code: 'E_GH_NOT_FOUND',
        message: probe.message || '未检测到 GitHub CLI（gh）',
      }));
      return true;
    }
    // 已有 token → 无需登录
    if (probe.token) {
      saveUserToken(probe.token);
      store.set({ status: 'done', output: '已通过 gh CLI 获取 token，无需重复登录' });
      ctx.send(200, envelope(true, 'api.auth.gh-login', {
        status: 'done',
        message: 'gh 已登录，自动获取 token',
        tokenMask: maskToken(probe.token),
      }));
      return true;
    }

    store.set({ status: 'running', output: '' });
    try {
      const { promise } = startGhLogin((chunk) => store.append(chunk));
      promise
        .then(() => {
          if (!store.get()) return;
          const after = probeGh();
          const out = store.get()?.output ?? '';
          if (after.token) {
            saveUserToken(after.token);
            store.set({ status: 'done', output: `${out}\n✅ 登录成功，已保存 token` });
          } else {
            store.set({ status: 'done', output: `${out}\n✅ gh auth login 已完成` });
          }
        })
        .catch((err) => {
          const cur = store.get();
          if (cur) {
            store.set({
              status: 'error',
              output: cur.output,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        });
      ctx.send(200, envelope(true, 'api.auth.gh-login', {
        status: 'running',
        message: 'gh auth login 已启动，请在弹出的浏览器中完成授权',
      }));
    } catch (err) {
      store.set(null);
      ctx.send(500, envelope(false, 'api.auth.gh-login', undefined, {
        code: 'E_SPAWN',
        message: err instanceof Error ? err.message : String(err),
      }));
    }
    return true;
  }

  if (ctx.method === 'GET' && ctx.pathname === '/api/auth/gh-login/status') {
    if (!store.get()) {
      ctx.send(200, envelope(true, 'api.auth.gh-login', { status: 'idle' }));
      return true;
    }
    const s = store.get()!;
    const result: Record<string, unknown> = { status: s.status, output: s.output };
    if (s.error) result.error = s.error;
    // 完成或出错后清理 session（但保留 output 供最后一次读取）
    store.scheduleClearIfTerminal();
    ctx.send(200, envelope(true, 'api.auth.gh-login', result));
    return true;
  }

  if (ctx.method === 'POST' && ctx.pathname === '/api/auth/gh-login/cancel') {
    store.cancel();
    ctx.send(200, envelope(true, 'api.auth.gh-login', { cancelled: true }));
    return true;
  }

  return false;
}

export async function authRoutes(ctx: UiRouteContext): Promise<boolean> {
  return (await tokenRoute(ctx)) || (await ghLoginRoutes(ctx));
}
