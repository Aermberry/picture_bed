import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getToken, loadConfig } from '../config.js';
import { clearUserToken, writeUserToken } from '../user-token.js';
import { probeGhToken, spawnGhLogin } from '../infra/gh-cli.js';
import type { JsonEnvelope, ResolvedConfig } from '../types.js';
import {
  asAppError,
  createRepoDir,
  doctorService,
  getRun,
  githubProbe,
  httpStatusForCode,
  listManifestView,
  listRuns,
  publicConfig,
  publicPlanItem,
  runPlan,
  runRevert,
  runSync,
  serializeConfigToml,
  importConfigToml,
  writeConfigKey,
} from '../app/index.js';
import { RootBinder, ensureDocExt } from './root.js';
import { INDEX_HTML } from './static.js';
import { SPA_CSS } from './spa/styles.js';
import { WatchController } from './watch.js';

export interface UiServerOptions {
  cwd: string;
  configPath?: string;
  host?: string;
  port?: number;
  /** Show design-spec nav (local debug only). Auto-detected when omitted. */
  uiDev?: boolean;
}

/**
 * 「规范」入口仅本地调试可见（F23/F24）。
 * PICBED_UI_DEV=1/0 优先；否则源码树（包根有 src/ui/static.ts）视为 dev。
 */
export function detectUiDevMode(explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit;
  const env = process.env.PICBED_UI_DEV;
  if (env === '1') return true;
  if (env === '0') return false;
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    return fs.existsSync(path.join(root, 'src', 'ui', 'static.ts'));
  } catch {
    return false;
  }
}

function renderIndexHtml(dev: boolean): string {
  return INDEX_HTML.replace(
    'window.__PICBED_UI_DEV__ = window.__PICBED_UI_DEV__ ?? false;',
    `window.__PICBED_UI_DEV__ = ${dev ? 'true' : 'false'};`,
  );
}

/** Renderer entry JS (Vite root `renderer/main.js`). Re-read so desktop reloads stay fresh. */
function rendererMainJs(): string | null {
  try {
    // server.ts lives at src/ui/server.ts (or dist/ui/server.js) → ../../renderer
    return fs.readFileSync(fileURLToPath(new URL('../../renderer/main.js', import.meta.url)), 'utf8');
  } catch {
    return null;
  }
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);

function isImagePath(p: string): boolean {
  const ext = path.extname(p).replace(/^\./, '').toLowerCase();
  return IMAGE_EXTS.has(ext);
}

export interface UiServerHandle {
  url: string;
  port: number;
  host: string;
  close: () => Promise<void>;
}

function envelope<T>(
  ok: boolean,
  command: string,
  data?: T,
  error?: JsonEnvelope['error'],
  warnings?: string[],
): JsonEnvelope<T> {
  return { schemaVersion: 1, ok, command, data, warnings, error: error ?? null };
}

/** Request body cap (docs/design/module-webui-http-hardening.md decision 4). */
const API_BODY_LIMIT = 64 * 1024;

function normalizeHostname(host: string): string {
  return host.replace(/^\[|\]$/g, '').toLowerCase();
}

function readBody(req: http.IncomingMessage, limit = API_BODY_LIMIT): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        // Drain the remainder so the 413 response can still be delivered, and stop buffering.
        req.removeAllListeners('data');
        req.resume();
        reject(Object.assign(new Error('request body exceeds 64 KiB'), { code: 'E_BODY_TOO_LARGE' }));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createUiServer(opts: UiServerOptions): {
  server: http.Server;
  binder: RootBinder;
  listen: (port: number, host: string) => Promise<UiServerHandle>;
} {
  const cwd = path.resolve(opts.cwd);
  const binder = new RootBinder();
  const watchCtl = new WatchController();
  /** Actual bind address; captured in listen(). Wildcard binds skip Host name checks. */
  let bindHost = normalizeHostname(opts.host ?? '');
  const workset: {
    name: string;
    relativePath: string;
    type: 'file' | 'dir';
    resolvedPath?: string;
    status: string;
  }[] = [];

  /** gh auth login 会话状态（单例，同时只允许一个登录流程） */
  let ghLoginSession: {
    status: 'running' | 'done' | 'error';
    output: string;
    error?: string;
  } | null = null;

  const loadCfg = (): ResolvedConfig => loadConfig({ cwd, configPath: opts.configPath });

  const server = http.createServer(async (req, res) => {
    const hostHeader = req.headers.host ?? '';
    const send = (status: number, body: unknown) => {
      const text = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      res.writeHead(status, {
        'Content-Type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(text);
    };

    try {
      // Host must exist and parse — no silent fallback base URL (hardens request URL construction).
      let hostUrl: URL;
      try {
        hostUrl = new URL(`http://${hostHeader}`);
      } catch {
        send(400, envelope(false, 'api.host', undefined, {
          code: 'E_USAGE',
          message: 'missing or malformed Host header',
        }));
        return;
      }

      // Host must name the bound address (decision 5): blocks DNS-rebinding where
      // Origin and Host are both attacker-controlled. Wildcard binds are explicit
      // LAN exposure and skip this check. `localhost` is always accepted.
      {
        const bound = bindHost;
        const wildcard = bound === '0.0.0.0' || bound === '::';
        const name = normalizeHostname(hostUrl.hostname);
        if (!wildcard && bound !== '' && name !== bound && name !== 'localhost') {
          send(403, envelope(false, 'api.host', undefined, {
            code: 'E_HOST',
            message: 'Host header must name the bound address',
          }));
          return;
        }
      }

      const url = new URL(req.url ?? '/', hostUrl);

      // Loopback-console CSRF hardening (docs/design/module-webui-http-hardening.md):
      // every /api request carrying Origin must be same-origin; POSTs additionally
      // require the X-Picbed-UI header and application/json. The SPA's api() helper
      // supplies both; cross-origin pages cannot (no CORS headers are ever emitted).
      if (url.pathname.startsWith('/api/')) {
        const origin = req.headers.origin;
        if (origin !== undefined) {
          let sameOrigin = false;
          try {
            const o = new URL(origin);
            sameOrigin = (o.protocol === 'http:' || o.protocol === 'https:') && o.host === hostUrl.host;
          } catch {
            sameOrigin = false;
          }
          if (!sameOrigin) {
            send(403, envelope(false, 'api.origin', undefined, {
              code: 'E_ORIGIN',
              message: 'cross-origin request rejected',
            }));
            return;
          }
        }
        if (req.method === 'POST') {
          if (req.headers['x-picbed-ui'] !== '1') {
            send(403, envelope(false, 'api.header', undefined, {
              code: 'E_HEADER',
              message: 'missing X-Picbed-UI: 1 header',
            }));
            return;
          }
          const ct = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
          if (ct !== 'application/json') {
            send(415, envelope(false, 'api.content-type', undefined, {
              code: 'E_CONTENT_TYPE',
              message: 'POST requires Content-Type: application/json',
            }));
            return;
          }
          // Layer ① of the body cap: reject oversized Content-Length before any
          // route runs — covers handlers that never call readBody (e.g. session/reset).
          const cl = req.headers['content-length'];
          if (cl !== undefined) {
            const n = Number(cl);
            if (Number.isFinite(n) && n > API_BODY_LIMIT) {
              req.resume();
              send(413, envelope(false, 'api.body', undefined, {
                code: 'E_BODY_TOO_LARGE',
                message: 'request body exceeds 64 KiB',
              }));
              return;
            }
          }
        }
      }
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        send(200, renderIndexHtml(detectUiDevMode(opts.uiDev)));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/styles.css') {
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(SPA_CSS);
        return;
      }

      if (req.method === 'GET' && (url.pathname === '/app.js' || url.pathname === '/main.js')) {
        const js = rendererMainJs();
        if (js === null) {
          send(500, envelope(false, 'api.static', undefined, {
            code: 'E_STATIC',
            message: 'renderer/main.js missing; renderer/ is the single UI source of truth (see docs/design/module-webui-spa-split.md)',
          }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(js);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/health') {
        send(200, envelope(true, 'api.health', { ok: true, rootBound: Boolean(binder.root) }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/session') {
        send(
          200,
          envelope(true, 'api.session', {
            root: binder.root,
            workset,
          }),
        );
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/session/reset') {
        workset.length = 0;
        send(200, envelope(true, 'api.session.reset', { ok: true }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/session/remove') {
        // Batch-remove dropped items (photo-wall selection). Match by resolved/relative path or name.
        const body = JSON.parse((await readBody(req)) || '{}') as { keys?: unknown };
        const keys: string[] = Array.isArray(body.keys)
          ? body.keys.map((k: unknown) => String(k ?? '').replace(/\\/g, '/')).filter(Boolean)
          : [];
        if (!keys.length) {
          send(400, envelope(false, 'api.session.remove', undefined, {
            code: 'E_BAD_REQUEST',
            message: 'keys (string[]) required',
          }));
          return;
        }
        const keySet = new Set(keys);
        const kept: typeof workset = [];
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
        send(200, envelope(true, 'api.session.remove', { removed, remaining: workset.length }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/session/images') {
        // Workset images only — do not enumerate the scan root (preview must not "grow" unexplained images).
        const droppedImgs: string[] = [];
        for (const w of workset) {
          const p = w.resolvedPath || '';
          if (p && isImagePath(p)) droppedImgs.push(p);
        }
        const seen = new Set<string>();
        const images = droppedImgs.filter((p) => {
          if (seen.has(p)) return false;
          seen.add(p);
          return true;
        });
        send(200, envelope(true, 'api.session.images', {
          root: binder.root,
          count: images.length,
          images,
        }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/preview') {
        const p = url.searchParams.get('path') || '';
        const root = binder.requireRoot();
        let abs = p;
        if (!path.isAbsolute(p)) abs = path.resolve(root, p);
        const rel = path.relative(root, abs);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
          send(400, envelope(false, 'api.preview', undefined, {
            code: 'E_PATH_ESCAPE',
            message: 'path outside scan root',
          }));
          return;
        }
        const ext = path.extname(abs).replace(/^\./, '').toLowerCase();
        const imageExt = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);
        if (!imageExt.has(ext)) {
          send(400, envelope(false, 'api.preview', undefined, {
            code: 'E_DOC_EXT',
            message: 'not an image',
          }));
          return;
        }
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
          send(404, envelope(false, 'api.preview', undefined, {
            code: 'E_PATH_MISSING',
            message: 'image not found',
          }));
          return;
        }
        const types: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
          svg: 'image/svg+xml',
          bmp: 'image/bmp',
          ico: 'image/x-icon',
          avif: 'image/avif',
        };
        const buf = fs.readFileSync(abs);
        res.writeHead(200, {
          'Content-Type': types[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(buf);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/session/bind-root') {
        const body = JSON.parse((await readBody(req)) || '{}') as { root?: string };
        if (!body.root) {
          send(400, envelope(false, 'api.session.bind-root', undefined, { code: 'E_USAGE', message: 'root required' }));
          return;
        }
        const root = binder.bind(body.root, cwd);
        send(200, envelope(true, 'api.session.bind-root', { root }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/session/drop') {
        const body = JSON.parse((await readBody(req)) || '{}') as {
          name?: string;
          relativePath?: string;
          type?: 'file' | 'dir';
          absPath?: string;
        };
        const rel = (body.relativePath || body.name || '').trim();
        const type = body.type === 'dir' ? 'dir' : 'file';
        const absRaw = (body.absPath || '').trim();
        const absPath = absRaw && path.isAbsolute(absRaw) ? absRaw : '';

        // Folders are not accepted: only image files or document files.
        if (type === 'dir') {
          workset.push({ name: body.name ?? rel, relativePath: rel, type: 'dir', status: 'blocked' });
          send(400, envelope(false, 'api.session.drop', { item: workset.at(-1) }, {
            code: 'E_USAGE',
            message: 'only image or document files are accepted (folders are not)',
            hint: 'Drop image files or md/html documents',
          }));
          return;
        }

        // Desktop drops carry absolute paths → auto-infer root (no manual bind step).
        if (absPath && type === 'file') {
          // Infer root from the file's directory when none bound yet.
          if (!binder.root) {
            try {
              const dir = path.dirname(absPath);
              binder.bind(dir, dir);
            } catch (err) {
              const e = err as Error & { code?: string };
              workset.push({ name: body.name ?? rel, relativePath: rel, type: 'file', status: 'blocked' });
              send(httpStatusForCode(e.code), envelope(false, 'api.session.drop', { item: workset.at(-1) }, {
                code: e.code ?? 'E_ROOT',
                message: e.message,
              }));
              return;
            }
          }
          if (!fs.existsSync(absPath)) {
            workset.push({ name: body.name ?? rel, relativePath: rel, type: 'file', status: 'blocked' });
            send(400, envelope(false, 'api.session.drop', { item: workset.at(-1) }, {
              code: 'E_PATH_MISSING',
              message: 'dropped file not found',
              path: absPath,
            }));
            return;
          }
          const cfgAbs = loadCfg();
          const isImg = isImagePath(absPath);
          if (!isImg && !ensureDocExt(absPath, cfgAbs.scan.extensions)) {
            workset.push({ name: body.name ?? rel, relativePath: rel, type: 'file', status: 'blocked' });
            send(400, envelope(false, 'api.session.drop', { item: workset.at(-1) }, {
              code: 'E_DOC_EXT',
              message: 'not a scanned document or image',
              path: absPath,
            }));
            return;
          }
          const rootNow = binder.requireRoot();
          const relFromRoot = path.relative(rootNow, absPath);
          workset.push({
            name: body.name ?? path.basename(absPath),
            relativePath: relFromRoot || path.basename(absPath),
            type: 'file',
            resolvedPath: absPath,
            status: isImg ? 'image' : 'in-root',
          });
          send(200, envelope(true, 'api.session.drop', {
            action: isImg ? 'image' : 'in-root',
            boundRoot: rootNow,
            image: isImg,
            // Only image files are previewable — dropping a document must not
            // put the doc path into the photo-wall count.
            ...(isImg ? { previewPath: absPath } : {}),
            item: workset.at(-1),
          }));
          return;
        }

        // Fallback (browser): resolve relative clue under bound root.
        const resolved = binder.resolveUnderRoot(rel);
        if (!resolved.ok) {
          workset.push({ name: body.name ?? rel, relativePath: rel, type: 'file', status: 'blocked' });
          send(httpStatusForCode(resolved.code), envelope(false, 'api.session.drop', { item: workset.at(-1) }, {
            code: resolved.code,
            message: resolved.reason,
            hint: 'Drop image or document files (auto-bind when desktop paths are available)',
          }));
          return;
        }
        const cfg = loadCfg();
        if (!ensureDocExt(resolved.path, cfg.scan.extensions)) {
          workset.push({ name: body.name ?? rel, relativePath: rel, type: 'file', status: 'blocked' });
          send(400, envelope(false, 'api.session.drop', { item: workset.at(-1) }, {
            code: 'E_DOC_EXT',
            message: 'not a scanned document extension',
            path: resolved.path,
          }));
          return;
        }
        if (!fs.existsSync(resolved.path)) {
          workset.push({ name: body.name ?? rel, relativePath: rel, type: 'file', status: 'blocked' });
          send(400, envelope(false, 'api.session.drop', { item: workset.at(-1) }, {
            code: 'E_PATH_MISSING',
            message: 'resolved path not found under root',
            path: resolved.path,
          }));
          return;
        }
        workset.push({
          name: body.name ?? rel,
          relativePath: rel,
          type: 'file',
          resolvedPath: resolved.path,
          status: 'ready',
        });
        send(200, envelope(true, 'api.session.drop', { action: 'ready', item: workset.at(-1) }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/scan') {
        const root = binder.requireRoot();
        const cfg = loadCfg();
        const { collected, plan } = await runPlan(root, cfg, cwd);
        send(
          200,
          envelope(true, 'api.scan', {
            root,
            docs: collected.docs.map((d) => path.relative(cwd, d.path).split(path.sep).join('/')),
            refCount: plan.length,
            assets: collected.assets.map((a) => ({
              localPath: a.localPath,
              sha256: a.sha256,
              bytes: a.bytes,
              refs: a.refs.length,
            })),
            blocked: collected.blocked.map((b) => ({
              raw: b.ref.raw,
              code: b.code,
              reason: b.reason,
            })),
            plan: plan.map(publicPlanItem),
          }, null, collected.warnings),
        );
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/plan') {
        const root = binder.requireRoot();
        const cfg = loadCfg();
        const { plan, summary, collected } = await runPlan(root, cfg, cwd);
        send(
          200,
          envelope(true, 'api.plan', { plan: plan.map(publicPlanItem), summary }, null, collected.warnings),
        );
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/sync') {
        const body = JSON.parse((await readBody(req)) || '{}') as {
          confirm?: boolean;
          dryRun?: boolean;
        };
        const root = binder.requireRoot();
        const cfg = loadCfg();
        // UI upload is scoped to the drop workset (images + docs only; folders are rejected).
        const worksetDocs: string[] = [];
        const worksetImages: string[] = [];
        for (const w of workset) {
          const p = w.resolvedPath || '';
          if (!p || w.type !== 'file') continue;
          if (isImagePath(p)) worksetImages.push(p);
          else if (ensureDocExt(p, cfg.scan.extensions)) worksetDocs.push(p);
        }
        const scoped = worksetDocs.length > 0 || worksetImages.length > 0;
        const includeDocs = scoped ? worksetDocs : undefined;
        const includeImages = scoped ? worksetImages : undefined;

        if (body.dryRun) {
          const { plan, summary, collected } = await runPlan(root, cfg, cwd, includeDocs ? { includeDocs } : undefined);
          send(200, envelope(true, 'api.sync', {
            dryRun: true,
            plan: plan.map(publicPlanItem),
            summary,
            uploaded: 0,
            rewrittenDocs: [],
            items: [],
          }, null, collected.warnings));
          return;
        }

        // ConfirmGate: writes require explicit confirm (exit-code 7 semantics)
        if (body.confirm !== true) {
          send(409, envelope(false, 'api.sync', undefined, {
            code: 'E_CONFIRM',
            message: 'sync writes documents and uploads; set confirm: true',
          }));
          return;
        }

        const result = await runSync({
          root,
          cfg,
          cwd,
          getToken,
          command: 'api.sync',
          includeDocs,
          includeImages,
        });
        const errorCode = result.errorCode ?? 'E_PARTIAL';
        send(
          result.ok ? 200 : httpStatusForCode(errorCode),
          envelope(result.ok, 'api.sync', {
            dryRun: false,
            uploaded: result.uploaded,
            rewrittenDocs: result.rewrittenDocs,
            summary: result.summary,
            items: result.items,
            errors: result.errors,
            partial: result.partial,
          }, result.ok ? null : { code: errorCode, message: result.errors.join('; ') }, result.warnings),
        );
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/gallery') {
        // 图库：列出当前仓库某目录下的文件夹与图片（GitHub Contents API）
        const cfg = loadCfg();
        const owner = cfg.github.owner;
        const repo = cfg.github.repo;
        const token = getToken();
        if (!owner || !repo) {
          send(400, envelope(false, 'api.gallery', undefined, {
            code: 'E_CONFIG',
            message: '请先在设置中配置 github.owner / github.repo',
          }));
          return;
        }
        if (!token) {
          send(401, envelope(false, 'api.gallery', undefined, {
            code: 'E_TOKEN',
            message: '需要 GitHub Token：请在设置中粘贴 PAT 保存、配置 PICBED_GITHUB_TOKEN，或本机 gh auth login 后自动读取',
          }));
          return;
        }
        const dir = (url.searchParams.get('path') || '').replace(/^\/+|\/+$/g, '');
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
            send(404, envelope(false, 'api.gallery', undefined, {
              code: 'E_NOT_FOUND',
              message: `目录不存在或无权访问：${dir || '/'}`,
            }));
            return;
          }
          if (!res.ok) {
            send(res.status, envelope(false, 'api.gallery', undefined, {
              code: 'E_REMOTE',
              message: `GitHub API ${res.status}`,
            }));
            return;
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
          send(200, envelope(true, 'api.gallery', {
            owner,
            repo,
            path: dir,
            items,
          }));
        } catch (e) {
          send(502, envelope(false, 'api.gallery', undefined, {
            code: 'E_REMOTE',
            message: e instanceof Error ? e.message : String(e),
          }));
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/gallery/delete') {
        // 图库批量删除：调用 GitHub Contents DELETE 逐个删除选中文件
        const cfg = loadCfg();
        const owner = cfg.github.owner;
        const repo = cfg.github.repo;
        const token = getToken();
        const branch = cfg.github.branch;
        if (!owner || !repo) {
          send(400, envelope(false, 'api.gallery.delete', undefined, {
            code: 'E_CONFIG',
            message: '请先在设置中配置 github.owner / github.repo',
          }));
          return;
        }
        if (!token) {
          send(401, envelope(false, 'api.gallery.delete', undefined, {
            code: 'E_TOKEN',
            message: '需要 GitHub Token：请在设置中粘贴 PAT 保存、配置 PICBED_GITHUB_TOKEN，或本机 gh auth login 后自动读取',
          }));
          return;
        }
        const body = JSON.parse((await readBody(req)) || '{}') as {
          items?: Array<{ path?: string; sha?: string; name?: string }>;
        };
        const targets = Array.isArray(body.items)
          ? body.items
              .filter((it) => it && it.path && it.sha)
              .map((it) => ({ path: String(it.path), sha: String(it.sha), name: String(it.name || it.path) }))
          : [];
        if (!targets.length) {
          send(400, envelope(false, 'api.gallery.delete', undefined, {
            code: 'E_BAD_REQUEST',
            message: 'items ({path,sha}[]) required',
          }));
          return;
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
        send(200, envelope(true, 'api.gallery.delete', { deleted: deleted.length, failed }, undefined, failed.length > 0 ? [`部分失败 ${failed.length} 个`] : undefined));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/auth/token') {
        // 粘贴 PAT：写入本机用户配置（~/.picbed/credentials.json），不写 picbed.toml
        const body = JSON.parse((await readBody(req)) || '{}') as {
          token?: string;
          clear?: boolean;
          confirm?: boolean;
        };
        if (body.confirm !== true) {
          send(409, envelope(false, 'api.auth.token', undefined, {
            code: 'E_CONFIRM',
            message: 'auth token writes local credentials; set confirm: true',
          }));
          return;
        }
        if (body.clear) {
          clearUserToken();
          send(200, envelope(true, 'api.auth.token', { cleared: true, tokenMask: '' }));
          return;
        }
        const tok = String(body.token ?? '').trim();
        if (!tok) {
          send(400, envelope(false, 'api.auth.token', undefined, {
            code: 'E_USAGE',
            message: 'token is empty；请粘贴 GitHub PAT 或改用 clear: true',
          }));
          return;
        }
        writeUserToken(tok);
        send(200, envelope(true, 'api.auth.token', {
          source: 'user',
          tokenMask: '••••••••',
        }));
        return;
      }

      // ── gh 一键登录：启动 / 轮询 ──
      if (req.method === 'POST' && url.pathname === '/api/auth/gh-login/start') {
        if (ghLoginSession && ghLoginSession.status === 'running') {
          send(409, envelope(false, 'api.auth.gh-login', undefined, {
            code: 'E_RUNNING',
            message: 'gh auth login 正在进行中，请先完成或等待结束',
          }));
          return;
        }
        // 先检查是否已安装 gh
        const probe = probeGhToken();
        if (probe.reason === 'not-installed') {
          send(400, envelope(false, 'api.auth.gh-login', undefined, {
            code: 'E_GH_NOT_FOUND',
            message: probe.message || '未检测到 GitHub CLI（gh）',
          }));
          return;
        }
        // 如果已有 token，提示无需登录
        if (probe.token) {
          writeUserToken(probe.token);
          ghLoginSession = { status: 'done', output: '已通过 gh CLI 获取 token，无需重复登录' };
          send(200, envelope(true, 'api.auth.gh-login', {
            status: 'done',
            message: 'gh 已登录，自动获取 token',
            tokenMask: '••••••••',
          }));
          return;
        }

        ghLoginSession = { status: 'running', output: '' };
        try {
          const { promise } = spawnGhLogin((chunk) => {
            if (ghLoginSession) {
              ghLoginSession.output += chunk;
            }
          });
          promise.then(() => {
            if (!ghLoginSession) return;
            // 登录成功后尝试读取 token
            const after = probeGhToken();
            if (after.token) {
              writeUserToken(after.token);
              ghLoginSession = {
                status: 'done',
                output: ghLoginSession.output + '\n✅ 登录成功，已保存 token',
              };
            } else {
              ghLoginSession = {
                status: 'done',
                output: ghLoginSession.output + '\n✅ gh auth login 已完成',
              };
            }
          }).catch((err) => {
            if (ghLoginSession) {
              ghLoginSession = {
                status: 'error',
                output: ghLoginSession.output,
                error: err instanceof Error ? err.message : String(err),
              };
            }
          });
          send(200, envelope(true, 'api.auth.gh-login', {
            status: 'running',
            message: 'gh auth login 已启动，请在弹出的浏览器中完成授权',
          }));
        } catch (err) {
          ghLoginSession = null;
          send(500, envelope(false, 'api.auth.gh-login', undefined, {
            code: 'E_SPAWN',
            message: err instanceof Error ? err.message : String(err),
          }));
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/auth/gh-login/status') {
        if (!ghLoginSession) {
          send(200, envelope(true, 'api.auth.gh-login', { status: 'idle' }));
          return;
        }
        const result: Record<string, unknown> = {
          status: ghLoginSession.status,
          output: ghLoginSession.output,
        };
        if (ghLoginSession.error) result.error = ghLoginSession.error;
        // 完成或出错后清理 session（但保留 output 供最后一次读取）
        const isTerminal = ghLoginSession.status === 'done' || ghLoginSession.status === 'error';
        send(200, envelope(true, 'api.auth.gh-login', result));
        if (isTerminal) {
          // 延迟清理，让前端有机会读取最终状态
          setTimeout(() => { ghLoginSession = null; }, 5000);
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/auth/gh-login/cancel') {
        if (ghLoginSession && ghLoginSession.status === 'running') {
          ghLoginSession = { status: 'error', output: ghLoginSession.output, error: '用户取消' };
        }
        send(200, envelope(true, 'api.auth.gh-login', { cancelled: true }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/config') {
        const cfg = loadCfg();
        send(200, envelope(true, 'api.config', publicConfig(cfg, { root: binder.root })));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/config') {
        const body = JSON.parse((await readBody(req)) || '{}') as {
          key?: string;
          value?: string;
          confirm?: boolean;
          dryRun?: boolean;
        };
        if (body.confirm !== true && !body.dryRun) {
          send(409, envelope(false, 'api.config', undefined, {
            code: 'E_CONFIRM',
            message: 'config set writes files; set confirm: true (or dryRun: true)',
          }));
          return;
        }
        const cfg = loadCfg();
        const out = writeConfigKey(cfg, body.key ?? '', body.value ?? '', Boolean(body.dryRun));
        send(200, envelope(true, 'api.config', out));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/repo/mkdir') {
        // 新建远程目录：GitHub 无空目录 API，以空 .gitkeep 占位提交
        const body = JSON.parse((await readBody(req)) || '{}') as {
          path?: string;
          confirm?: boolean;
        };
        try {
          const result = await createRepoDir({
            cfg: loadCfg(),
            getToken,
            path: body.path ?? '',
            confirm: body.confirm === true,
          });
          send(200, envelope(true, 'api.repo.mkdir', result));
        } catch (e) {
          const appErr = asAppError(e, 'E_REMOTE');
          send(
            httpStatusForCode(appErr.code),
            envelope(false, 'api.repo.mkdir', undefined, {
              code: appErr.code,
              message: appErr.message,
              ...(appErr.hint ? { hint: appErr.hint } : {}),
            }),
          );
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/config/export') {
        // 导出：可移植 picbed.toml 文本；绝不含 token
        const cfg = loadCfg();
        send(200, envelope(true, 'api.config.export', { toml: serializeConfigToml(cfg) }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/config/import') {
        // 导入：校验 + 归一化后整体写回配置文件（不含 token）
        const body = JSON.parse((await readBody(req)) || '{}') as {
          toml?: string;
          confirm?: boolean;
          dryRun?: boolean;
        };
        if (body.confirm !== true && !body.dryRun) {
          send(409, envelope(false, 'api.config.import', undefined, {
            code: 'E_CONFIRM',
            message: 'config import writes files; set confirm: true (or dryRun: true)',
          }));
          return;
        }
        const toml = String(body.toml ?? '');
        if (!toml.trim()) {
          send(400, envelope(false, 'api.config.import', undefined, {
            code: 'E_USAGE',
            message: 'toml is empty；请提供导出的 picbed.toml 文本',
          }));
          return;
        }
        try {
          const cfg = loadCfg();
          const out = importConfigToml(cfg, toml, Boolean(body.dryRun));
          send(200, envelope(true, 'api.config.import', {
            file: out.file,
            dryRun: out.dryRun,
            config: publicConfig(out.config),
          }));
        } catch (e) {
          const appErr = asAppError(e);
          send(httpStatusForCode(appErr.code), envelope(false, 'api.config.import', undefined, appErr));
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/doctor') {
        const cfg = loadCfg();
        const view = await doctorService({ cfg, getToken, probeApi: githubProbe });
        send(view.ok ? 200 : 400, envelope(view.ok, 'api.doctor', view, view.ok ? null : {
          code: 'E_DOCTOR',
          message: 'doctor failed: ' + view.failures.join(','),
          hint: 'token: PICBED_GITHUB_TOKEN / GITHUB_TOKEN / gh auth token',
        }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/manifest') {
        const view = listManifestView(cwd);
        if (!view.ok) {
          send(400, envelope(false, 'api.manifest', { entries: [] }, view.error));
          return;
        }
        send(200, envelope(true, 'api.manifest', view));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/revert') {
        const body = JSON.parse((await readBody(req)) || '{}') as {
          confirm?: boolean;
          dryRun?: boolean;
        };
        const root = binder.requireRoot();
        const cfg = loadCfg();
        if (!body.dryRun && body.confirm !== true) {
          send(409, envelope(false, 'api.revert', undefined, {
            code: 'E_CONFIRM',
            message: 'revert writes files; set confirm: true (or dryRun: true)',
          }));
          return;
        }
        const result = runRevert({ root, cfg, cwd, dryRun: Boolean(body.dryRun), command: 'api.revert' });
        if (!result.ok && result.errorCode === 'E_MANIFEST_CORRUPT') {
          send(400, envelope(false, 'api.revert', result, {
            code: 'E_MANIFEST_CORRUPT',
            message: result.errors.join('; '),
          }));
          return;
        }
        send(result.ok ? 200 : httpStatusForCode(result.errorCode), envelope(result.ok, 'api.revert', result, result.ok ? null : {
          code: result.errorCode ?? 'E_PARTIAL',
          message: result.errors.join('; '),
        }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/runs') {
        send(200, envelope(true, 'api.runs', { runs: listRuns(cwd) }));
        return;
      }

      const runMatch = /^\/api\/runs\/([a-zA-Z0-9_-]+)$/.exec(url.pathname);
      if (req.method === 'GET' && runMatch) {
        const run = getRun(cwd, runMatch[1]);
        if (!run) {
          send(404, envelope(false, 'api.runs.get', undefined, { code: 'E_USAGE', message: 'run not found' }));
          return;
        }
        send(200, envelope(true, 'api.runs.get', run));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/watch') {
        send(200, envelope(true, 'api.watch', watchCtl.state));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/watch/start') {
        const body = JSON.parse((await readBody(req)) || '{}') as {
          mode?: 'preview' | 'confirm-each' | 'auto';
          debounceMs?: number;
          confirm?: boolean;
        };
        const root = binder.requireRoot();
        const mode = body.mode ?? 'preview';
        if (mode === 'auto' && body.confirm !== true) {
          send(409, envelope(false, 'api.watch.start', undefined, {
            code: 'E_CONFIRM',
            message: 'auto mode must be explicitly enabled with confirm: true',
          }));
          return;
        }
        const cfg = loadCfg();
        const state = watchCtl.start({
          root,
          debounceMs: body.debounceMs,
          mode,
          onBatch: async (changed, m) => {
            if (m === 'confirm-each') {
              watchCtl.state.events.push({
                at: new Date().toISOString(),
                message: 'awaiting confirm for batch (call /api/sync)',
                changed,
              });
              return;
            }
            if (m === 'auto') {
              await runSync({ root, cfg, cwd, getToken, command: 'api.sync' });
            }
          },
        });
        send(200, envelope(true, 'api.watch.start', state));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/watch/stop') {
        send(200, envelope(true, 'api.watch.stop', watchCtl.stop()));
        return;
      }

      send(404, envelope(false, 'api.unknown', undefined, { code: 'E_USAGE', message: `no route ${req.method} ${url.pathname}` }));
    } catch (err) {
      const e = asAppError(err);
      send(httpStatusForCode(e.code), envelope(false, 'api.error', undefined, {
        code: e.code,
        message: e.message,
        path: e.path,
        hint: e.hint,
      }));
    }
  });

  return {
    server,
    binder,
    listen(port, host) {
      bindHost = normalizeHostname(host);
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          const addr = server.address();
          const actualPort = typeof addr === 'object' && addr ? addr.port : port;
          resolve({
            url: `http://${host.includes(':') ? `[${host}]` : host}:${actualPort}`,
            port: actualPort,
            host,
            close: () =>
              new Promise<void>((done) => {
                try {
                  watchCtl.stop();
                } catch {
                  /* ignore */
                }
                server.close(() => done());
              }),
          });
        });
      });
    },
  };
}
