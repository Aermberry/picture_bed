import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { getToken, maskToken, loadConfig } from '../config.js';
import type { JsonEnvelope, ResolvedConfig } from '../types.js';
import { publicPlanItem, runPlan, runSync } from './ops.js';
import { RootBinder, ensureDocExt } from './root.js';
import { INDEX_HTML } from './static.js';

export interface UiServerOptions {
  cwd: string;
  configPath?: string;
  host?: string;
  port?: number;
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

function httpStatusFor(code: string | undefined): number {
  if (code === 'E_CONFIRM') return 409;
  if (code === 'E_TOKEN' || code === 'E_AUTH') return 401;
  if (code === 'E_NO_ROOT' || code === 'E_ROOT') return 400;
  if (code === 'E_PATH' || code === 'E_PATH_ABS' || code === 'E_PATH_ESCAPE' || code === 'E_PATH_MISSING') return 400;
  if (code === 'E_USAGE' || code === 'E_STYLE') return 400;
  return 500;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
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
  const workset: {
    name: string;
    relativePath: string;
    type: 'file' | 'dir';
    resolvedPath?: string;
    status: string;
  }[] = [];

  const loadCfg = (): ResolvedConfig => loadConfig({ cwd, configPath: opts.configPath });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    const send = (status: number, body: unknown) => {
      const text = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      res.writeHead(status, {
        'Content-Type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(text);
    };

    try {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        send(200, INDEX_HTML);
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
        };
        const rel = (body.relativePath || body.name || '').trim();
        const type = body.type === 'dir' ? 'dir' : 'file';

        // Policy A: dir drop may bind root by its resolved path under cwd if absolute not allowed —
        // for dir we accept relative name as root subpath OR bind if it exists under cwd.
        if (type === 'dir') {
          if (!binder.root) {
            const candidate = path.resolve(cwd, rel);
            if (!path.relative(cwd, candidate).startsWith('..')) {
              try {
                const bound = binder.bind(rel, cwd);
                workset.push({
                  name: body.name ?? rel,
                  relativePath: rel,
                  type: 'dir',
                  resolvedPath: bound,
                  status: 'bound-root',
                });
                send(200, envelope(true, 'api.session.drop', { action: 'bound-root', boundRoot: bound, item: workset.at(-1) }));
                return;
              } catch (err) {
                const e = err as Error & { code?: string };
                workset.push({
                  name: body.name ?? rel,
                  relativePath: rel,
                  type: 'dir',
                  status: 'blocked',
                });
                send(httpStatusFor(e.code), envelope(false, 'api.session.drop', { item: workset.at(-1) }, {
                  code: e.code ?? 'E_ROOT',
                  message: e.message,
                }));
                return;
              }
            }
          }
          const resolved = binder.resolveUnderRoot(rel);
          if (!resolved.ok) {
            workset.push({ name: body.name ?? rel, relativePath: rel, type: 'dir', status: 'blocked' });
            send(httpStatusFor(resolved.code), envelope(false, 'api.session.drop', { item: workset.at(-1) }, {
              code: resolved.code,
              message: resolved.reason,
            }));
            return;
          }
          workset.push({
            name: body.name ?? rel,
            relativePath: rel,
            type: 'dir',
            resolvedPath: resolved.path,
            status: 'in-root',
          });
          send(200, envelope(true, 'api.session.drop', { action: 'in-root', item: workset.at(-1) }));
          return;
        }

        // file drop — policy A requires bound root
        const resolved = binder.resolveUnderRoot(rel);
        if (!resolved.ok) {
          workset.push({ name: body.name ?? rel, relativePath: rel, type: 'file', status: 'blocked' });
          send(httpStatusFor(resolved.code), envelope(false, 'api.session.drop', { item: workset.at(-1) }, {
            code: resolved.code,
            message: resolved.reason,
            hint: 'Bind root first (policy A), then drop files under that root',
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

        if (body.dryRun) {
          const { plan, summary, collected } = await runPlan(root, cfg, cwd);
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
        });
        send(
          result.ok ? 200 : 207,
          envelope(result.ok, 'api.sync', {
            dryRun: false,
            uploaded: result.uploaded,
            rewrittenDocs: result.rewrittenDocs,
            summary: result.summary,
            items: result.items,
            errors: result.errors,
            partial: !result.ok && result.uploaded + result.rewrittenDocs.length > 0,
          }, result.ok ? null : { code: 'E_PARTIAL', message: result.errors.join('; ') }, result.warnings),
        );
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/config') {
        const cfg = loadCfg();
        send(200, envelope(true, 'api.config', {
          host: cfg.host,
          github: cfg.github,
          url: cfg.url,
          scan: cfg.scan,
          upload: cfg.upload,
          rewrite: cfg.rewrite,
          token: maskToken(getToken()),
          configPath: cfg.configPath,
          root: binder.root,
        }));
        return;
      }

      send(404, envelope(false, 'api.unknown', undefined, { code: 'E_USAGE', message: `no route ${req.method} ${url.pathname}` }));
    } catch (err) {
      const e = err as Error & { code?: string; hint?: string; path?: string };
      send(httpStatusFor(e.code), envelope(false, 'api.error', undefined, {
        code: e.code ?? 'E_GENERAL',
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
                server.close(() => done());
              }),
          });
        });
      });
    },
  };
}
