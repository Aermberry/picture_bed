import fs from 'node:fs';
import path from 'node:path';
import { httpStatusForCode } from '../../app/index.js';
import { ensureDocExt } from '../root.js';
import { isImageExt } from '../../lib/img.js';
import { isUnderRoot } from '../../lib/paths.js';
import { envelope } from '../http/envelope.js';
import type { UiRouteContext, WorksetItem } from '../context.js';

const isImagePath = isImageExt;

/** 工作集内的图片（去重，保持首次出现顺序）。 */
function worksetImages(workset: WorksetItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of workset) {
    const p = w.resolvedPath || '';
    if (!p || !isImagePath(p) || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

function pushBlocked(ctx: UiRouteContext, name: string, rel: string, type: 'file' | 'dir'): WorksetItem {
  const item: WorksetItem = { name, relativePath: rel, type, status: 'blocked' };
  ctx.workset.push(item);
  return item;
}

/**
 * 会话工作集：/api/session、reset、remove、images、bind-root、drop。
 * 工作集是「本次 UI 会话投放了什么」的可变状态，由 server.ts 持有并注入。
 */
export async function sessionRoutes(ctx: UiRouteContext): Promise<boolean> {
  const { method, pathname, workset } = ctx;

  if (method === 'GET' && pathname === '/api/session') {
    ctx.send(200, envelope(true, 'api.session', { root: ctx.binder.root, workset }));
    return true;
  }

  if (method === 'POST' && pathname === '/api/session/reset') {
    workset.length = 0;
    ctx.send(200, envelope(true, 'api.session.reset', { ok: true }));
    return true;
  }

  if (method === 'POST' && pathname === '/api/session/remove') {
    // 批量移除投放项（照片墙选择）。按 resolved/relative 路径或名称匹配。
    const body = JSON.parse((await ctx.readBody()) || '{}') as { keys?: unknown };
    const keys: string[] = Array.isArray(body.keys)
      ? body.keys.map((k: unknown) => String(k ?? '').replace(/\\/g, '/')).filter(Boolean)
      : [];
    if (!keys.length) {
      ctx.send(400, envelope(false, 'api.session.remove', undefined, {
        code: 'E_BAD_REQUEST',
        message: 'keys (string[]) required',
      }));
      return true;
    }
    const keySet = new Set(keys);
    const kept: WorksetItem[] = [];
    let removed = 0;
    for (const w of workset) {
      const cands = [w.resolvedPath || '', w.relativePath || '', w.name || '']
        .map((p) => String(p).replace(/\\/g, '/'))
        .filter(Boolean);
      if (cands.some((p) => keySet.has(p))) {
        removed += 1;
        continue;
      }
      kept.push(w);
    }
    workset.length = 0;
    workset.push(...kept);
    ctx.send(200, envelope(true, 'api.session.remove', { removed, remaining: workset.length }));
    return true;
  }

  if (method === 'GET' && pathname === '/api/session/images') {
    // 只列工作集内的图片——不枚举扫描根目录（预览不该「凭空长出新图」）。
    const images = worksetImages(workset);
    ctx.send(200, envelope(true, 'api.session.images', {
      root: ctx.binder.root,
      count: images.length,
      images,
    }));
    return true;
  }

  if (method === 'POST' && pathname === '/api/session/bind-root') {
    const body = JSON.parse((await ctx.readBody()) || '{}') as { root?: string };
    if (!body.root) {
      ctx.send(400, envelope(false, 'api.session.bind-root', undefined, {
        code: 'E_USAGE',
        message: 'root required',
      }));
      return true;
    }
    const root = ctx.binder.bind(body.root, ctx.cwd);
    ctx.send(200, envelope(true, 'api.session.bind-root', { root }));
    return true;
  }

  if (method === 'POST' && pathname === '/api/session/drop') {
    const body = JSON.parse((await ctx.readBody()) || '{}') as {
      name?: string;
      relativePath?: string;
      type?: 'file' | 'dir';
      absPath?: string;
    };
    const rel = (body.relativePath || body.name || '').trim();
    const type = body.type === 'dir' ? 'dir' : 'file';
    const absRaw = (body.absPath || '').trim();
    const absPath = absRaw && path.isAbsolute(absRaw) ? absRaw : '';

    // 目录不接受：只收图片文件或文档文件。
    if (type === 'dir') {
      const item = pushBlocked(ctx, body.name ?? rel, rel, 'dir');
      ctx.send(400, envelope(false, 'api.session.drop', { item }, {
        code: 'E_USAGE',
        message: 'only image or document files are accepted (folders are not)',
        hint: 'Drop image files or md/html documents',
      }));
      return true;
    }

    // 桌面端投放携带绝对路径 → 自动推断/重绑 root（无需手工 bind）。
    if (absPath && type === 'file') {
      // 已绑定 root 之外的投放必须重绑：plan/sync 都只扫 binder.root，
      // 沿用旧根会让本次投放静默空转（plan 为空、上传什么都不做）。
      // 重绑换根，先前工作集已不属于新根，一并清空，避免混入跨根条目。
      const prevRoot = ctx.binder.root;
      let rebindTo: string | null = null;
      if (!prevRoot) {
        rebindTo = path.dirname(absPath);
      } else if (!isUnderRoot(prevRoot, absPath)) {
        rebindTo = path.dirname(absPath);
      }
      if (rebindTo) {
        try {
          ctx.binder.bind(rebindTo, rebindTo);
        } catch (err) {
          const e = err as Error & { code?: string };
          const item = pushBlocked(ctx, body.name ?? rel, rel, 'file');
          ctx.send(httpStatusForCode(e.code), envelope(false, 'api.session.drop', { item }, {
            code: e.code ?? 'E_ROOT',
            message: e.message,
          }));
          return true;
        }
        if (prevRoot) workset.length = 0;
      }
      if (!fs.existsSync(absPath)) {
        const item = pushBlocked(ctx, body.name ?? rel, rel, 'file');
        ctx.send(400, envelope(false, 'api.session.drop', { item }, {
          code: 'E_PATH_MISSING',
          message: 'dropped file not found',
          path: absPath,
        }));
        return true;
      }
      const cfgAbs = ctx.loadCfg();
      const isImg = isImagePath(absPath);
      if (!isImg && !ensureDocExt(absPath, cfgAbs.scan.extensions)) {
        const item = pushBlocked(ctx, body.name ?? rel, rel, 'file');
        ctx.send(400, envelope(false, 'api.session.drop', { item }, {
          code: 'E_DOC_EXT',
          message: 'not a scanned document or image',
          path: absPath,
        }));
        return true;
      }
      const rootNow = ctx.binder.requireRoot();
      const relFromRoot = path.relative(rootNow, absPath);
      workset.push({
        name: body.name ?? path.basename(absPath),
        relativePath: relFromRoot || path.basename(absPath),
        type: 'file',
        resolvedPath: absPath,
        status: isImg ? 'image' : 'in-root',
      });
      ctx.send(200, envelope(true, 'api.session.drop', {
        action: isImg ? 'image' : 'in-root',
        boundRoot: rootNow,
        image: isImg,
        // 换根即清空工作集：前端须同步丢弃旧墙，避免展示不属于新根的图块。
        ...(rebindTo && prevRoot ? { rebind: { from: prevRoot, to: rootNow, cleared: true } } : {}),
        // 只有图片可预览——投放文档不得计入照片墙数量。
        ...(isImg ? { previewPath: absPath } : {}),
        item: workset.at(-1),
      }));
      return true;
    }

    // 兜底（浏览器）：在已绑定 root 下解析相对线索。
    const resolved = ctx.binder.resolveUnderRoot(rel);
    if (!resolved.ok) {
      const item = pushBlocked(ctx, body.name ?? rel, rel, 'file');
      ctx.send(httpStatusForCode(resolved.code), envelope(false, 'api.session.drop', { item }, {
        code: resolved.code,
        message: resolved.reason,
        hint: 'Drop image or document files (auto-bind when desktop paths are available)',
      }));
      return true;
    }
    const cfg = ctx.loadCfg();
    if (!ensureDocExt(resolved.path, cfg.scan.extensions)) {
      const item = pushBlocked(ctx, body.name ?? rel, rel, 'file');
      ctx.send(400, envelope(false, 'api.session.drop', { item }, {
        code: 'E_DOC_EXT',
        message: 'not a scanned document extension',
        path: resolved.path,
      }));
      return true;
    }
    if (!fs.existsSync(resolved.path)) {
      const item = pushBlocked(ctx, body.name ?? rel, rel, 'file');
      ctx.send(400, envelope(false, 'api.session.drop', { item }, {
        code: 'E_PATH_MISSING',
        message: 'resolved path not found under root',
        path: resolved.path,
      }));
      return true;
    }
    workset.push({
      name: body.name ?? rel,
      relativePath: rel,
      type: 'file',
      resolvedPath: resolved.path,
      status: 'ready',
    });
    ctx.send(200, envelope(true, 'api.session.drop', { action: 'ready', item: workset.at(-1) }));
    return true;
  }

  return false;
}
