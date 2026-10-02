import { currentToken } from '../../app/index.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext } from '../context.js';

/** 图库：列出远端目录下的文件/文件夹；批量删除选中文件。 */
export async function galleryRoutes(ctx: UiRouteContext): Promise<boolean> {
  const cfg = ctx.loadCfg();
  const owner = cfg.github.owner;
  const repo = cfg.github.repo;

  if (ctx.method === 'GET' && ctx.pathname === '/api/gallery') {
    const token = currentToken();
    if (!owner || !repo) {
      ctx.send(400, envelope(false, 'api.gallery', undefined, {
        code: 'E_CONFIG',
        message: '请先在设置中配置 github.owner / github.repo',
      }));
      return true;
    }
    if (!token) {
      ctx.send(401, envelope(false, 'api.gallery', undefined, {
        code: 'E_TOKEN',
        message: '需要 GitHub Token：请在设置中粘贴 PAT 保存、配置 PICBED_GITHUB_TOKEN，或本机 gh auth login 后自动读取',
      }));
      return true;
    }
    const dir = (ctx.url.searchParams.get('path') || '').replace(/^\/+|\/+$/g, '');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${dir}`;
    try {
      const res = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'picbed',
        },
      });
      if (res.status === 404) {
        ctx.send(404, envelope(false, 'api.gallery', undefined, {
          code: 'E_NOT_FOUND',
          message: `目录不存在或无权访问：${dir || '/'}`,
        }));
        return true;
      }
      if (!res.ok) {
        ctx.send(res.status, envelope(false, 'api.gallery', undefined, {
          code: 'E_REMOTE',
          message: `GitHub API ${res.status}`,
        }));
        return true;
      }
      const list = (await res.json()) as Array<{
        name: string;
        path: string;
        type: string;
        download_url?: string;
        html_url?: string;
        size?: number;
        sha?: string;
      }>;
      const items = Array.isArray(list)
        ? list.map((it) => ({
            name: it.name,
            path: it.path,
            type: it.type === 'dir' ? 'dir' : 'file',
            url: it.download_url || it.html_url || '',
            size: it.size ?? null,
            sha: it.sha ?? null,
          }))
        : [];
      ctx.send(200, envelope(true, 'api.gallery', { owner, repo, path: dir, items }));
    } catch (e) {
      ctx.send(502, envelope(false, 'api.gallery', undefined, {
        code: 'E_REMOTE',
        message: e instanceof Error ? e.message : String(e),
      }));
    }
    return true;
  }

  if (ctx.method === 'POST' && ctx.pathname === '/api/gallery/delete') {
    const token = currentToken();
    const branch = cfg.github.branch;
    if (!owner || !repo) {
      ctx.send(400, envelope(false, 'api.gallery.delete', undefined, {
        code: 'E_CONFIG',
        message: '请先在设置中配置 github.owner / github.repo',
      }));
      return true;
    }
    if (!token) {
      ctx.send(401, envelope(false, 'api.gallery.delete', undefined, {
        code: 'E_TOKEN',
        message: '需要 GitHub Token：请在设置中粘贴 PAT 保存、配置 PICBED_GITHUB_TOKEN，或本机 gh auth login 后自动读取',
      }));
      return true;
    }
    const body = JSON.parse((await ctx.readBody()) || '{}') as {
      items?: Array<{ path?: string; sha?: string; name?: string }>;
    };
    const targets = Array.isArray(body.items)
      ? body.items
          .filter((it) => it && it.path && it.sha)
          .map((it) => ({ path: String(it.path), sha: String(it.sha), name: String(it.name || it.path) }))
      : [];
    if (!targets.length) {
      ctx.send(400, envelope(false, 'api.gallery.delete', undefined, {
        code: 'E_BAD_REQUEST',
        message: 'items ({path,sha}[]) required',
      }));
      return true;
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'picbed',
    };
    const deleted: Array<{ path: string; name: string }> = [];
    const failed: Array<{ path: string; name: string; error: string }> = [];
    for (const t of targets) {
      try {
        const deleteUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${t.path
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`;
        const res = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cfg.upload.commitMessage || 'picbed: delete image',
            sha: t.sha,
            branch,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          failed.push({ path: t.path, name: t.name, error: `GitHub API ${res.status}: ${text}` });
          continue;
        }
        deleted.push({ path: t.path, name: t.name });
      } catch (e) {
        failed.push({ path: t.path, name: t.name, error: e instanceof Error ? e.message : String(e) });
      }
    }
    ctx.send(200, envelope(true, 'api.gallery.delete', {
      deleted: deleted.length,
      failed,
    }, undefined, failed.length > 0 ? [`部分失败 ${failed.length} 个`] : undefined));
    return true;
  }

  return false;
}
