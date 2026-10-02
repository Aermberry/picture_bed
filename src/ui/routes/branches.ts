import { currentToken } from '../../app/index.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** 分支列表：GET /api/branches → 仓库可选分支（设置页 Branch 下拉，只读）。 */
export async function branchRoutes(ctx: UiRouteContext): Promise<boolean> {
  if (ctx.method !== 'GET' || ctx.pathname !== '/api/branches') return false;
  const cfg = ctx.loadCfg();
  const owner = cfg.github.owner;
  const repo = cfg.github.repo;

  if (!owner || !repo) {
    ctx.send(400, envelope(false, 'api.branches', undefined, {
      code: 'E_CONFIG',
      message: '请先在设置中配置 github.owner / github.repo',
    }));
    return true;
  }
  const token = currentToken();
  if (!token) {
    ctx.send(401, envelope(false, 'api.branches', undefined, {
      code: 'E_TOKEN',
      message: '需要 GitHub Token：请在设置中粘贴 PAT 保存、配置 PICBED_GITHUB_TOKEN，或本机 gh auth login 后自动读取',
    }));
    return true;
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'picbed',
      },
    });
    if (res.status === 404) {
      ctx.send(404, envelope(false, 'api.branches', undefined, {
        code: 'E_NOT_FOUND',
        message: `仓库不存在或无权访问：${owner}/${repo}`,
      }));
      return true;
    }
    if (!res.ok) {
      ctx.send(res.status, envelope(false, 'api.branches', undefined, {
        code: 'E_REMOTE',
        message: `GitHub API ${res.status}`,
      }));
      return true;
    }
    const json = (await res.json()) as Array<{ name?: string }>;
    const branches = (Array.isArray(json) ? json : [])
      .map((b) => String(b?.name ?? ''))
      .filter(Boolean);
    ctx.send(200, envelope(true, 'api.branches', { owner, repo, branches }));
  } catch (e) {
    ctx.send(502, envelope(false, 'api.branches', undefined, {
      code: 'E_REMOTE',
      message: e instanceof Error ? e.message : String(e),
    }));
  }
  return true;
}
