import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { getToken, loadConfig } from '../config.js';
import type { JsonEnvelope, ResolvedConfig } from '../types.js';
import { applyConfigSet, doctorView, publicConfig } from './doctor.js';
import { publicPlanItem, runPlan, runSync } from './ops.js';
import { listManifestView, runRevert } from './revert.js';
import { RootBinder, ensureDocExt } from './root.js';
import { getRun, listRuns } from './runs.js';
import { INDEX_HTML } from './static.js';
import { WatchController } from './watch.js';

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
  const watchCtl = new WatchController();
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
        const out = applyConfigSet(cfg, body.key ?? '', body.value ?? '', Boolean(body.dryRun));
        send(200, envelope(true, 'api.config', out));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/doctor') {
        const cfg = loadCfg();
        const view = doctorView(cfg);
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
        const result = runRevert({ root, cfg, cwd, dryRun: Boolean(body.dryRun) });
        if (!result.ok && result.errors.some((e) => e.includes('manifest corrupt'))) {
          send(400, envelope(false, 'api.revert', result, {
            code: 'E_MANIFEST_CORRUPT',
            message: result.errors.join('; '),
          }));
          return;
        }
        send(result.ok ? 200 : 207, envelope(result.ok, 'api.revert', result, result.ok ? null : {
          code: 'E_PARTIAL',
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
              await runSync({ root, cfg, cwd, getToken });
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
