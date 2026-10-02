import http from 'node:http';
import path from 'node:path';
import { resolvedConfig } from '../app/index.js';
import type { ResolvedConfig } from '../types.js';
import { RootBinder } from './root.js';
import { SPA_CSS } from './spa/styles.js';
import { WatchController } from './watch.js';
import { GhLoginStore } from './gh-login.js';
import type { UiRoute, UiRouteContext, WorksetItem } from './context.js';
import { envelope, makeSend, normalizeHostname, sendRaw } from './http/envelope.js';
import { readBody } from './http/body.js';
import { checkApiRequest, checkHost, parseHost, rejectionEnvelope } from './http/guard.js';
import { detectUiDevMode, renderIndexHtml, rendererMainJs, rendererAsset } from './http/static.js';
import { sendAppError } from './http/errors.js';
import { authRoutes } from './routes/auth.js';
import { branchRoutes } from './routes/branches.js';
import { configRoutes } from './routes/config.js';
import { galleryRoutes } from './routes/gallery.js';
import { healthRoute } from './routes/health.js';
import { planRoutes } from './routes/plan.js';
import { previewRoute } from './routes/preview.js';
import { revertRoute } from './routes/revert.js';
import { runsRoutes } from './routes/runs.js';
import { sessionRoutes } from './routes/session.js';
import { syncRoute } from './routes/sync.js';
import { systemRoutes } from './routes/system.js';
import { watchRoutes } from './routes/watch.js';

export interface UiServerOptions {
  cwd: string;
  configPath?: string;
  host?: string;
  port?: number;
  /** Show design-spec nav (local debug only). Auto-detected when omitted. */
  uiDev?: boolean;
}

export interface UiServerHandle {
  url: string;
  port: number;
  host: string;
  close: () => Promise<void>;
}

export { detectUiDevMode } from './http/static.js';

/**
 * 路由表：按资源分组；命中即响应并返回 true，未命中继续下一张表。
 * 新增接口 = 往这里加一张表，不再触碰协议/安检代码。
 */
const ROUTES: UiRoute[] = [
  healthRoute,
  sessionRoutes,
  previewRoute,
  planRoutes,
  syncRoute,
  revertRoute,
  galleryRoutes,
  branchRoutes,
  authRoutes,
  configRoutes,
  systemRoutes,
  runsRoutes,
  watchRoutes,
];

/**
 * 组装 UI 服务器：安检（http/guard）→ 静态下发（http/static）→ 路由表（routes/）。
 * 业务编排全部在 app/，本文件只做 HTTP 装配（<200 行）。
 */
export function createUiServer(opts: UiServerOptions): {
  server: http.Server;
  binder: RootBinder;
  listen: (port: number, host: string) => Promise<UiServerHandle>;
} {
  const cwd = path.resolve(opts.cwd);
  const binder = new RootBinder();
  const watchCtl = new WatchController();
  const ghLogin = new GhLoginStore();
  /** Actual bind address; captured in listen(). Wildcard binds skip Host name checks. */
  let bindHost = normalizeHostname(opts.host ?? '');

  const workset: WorksetItem[] = [];
  const loadCfg = (): ResolvedConfig => resolvedConfig(cwd, opts.configPath);

  const server = http.createServer(async (req, res) => {
    const send = makeSend(res);

    try {
      // ── 安检 ①：Host 必须存在且可解析 ──
      const host = parseHost(req.headers.host ?? '');
      if (!host.ok) {
        send(host.rejection.status, rejectionEnvelope(host.rejection));
        return;
      }
      // ── 安检 ②：Host 必须指向绑定地址（阻断 DNS-rebinding）──
      const hostReject = checkHost(host.hostUrl, bindHost);
      if (hostReject) {
        send(hostReject.status, rejectionEnvelope(hostReject));
        return;
      }

      const url = new URL(req.url ?? '/', host.hostUrl);
      const pathname = url.pathname;

      // ── 安检 ③：/api 同源 + POST 头 + 请求体上限 ──
      const apiReject = checkApiRequest(req, pathname, host.hostUrl);
      if (apiReject) {
        send(apiReject.status, rejectionEnvelope(apiReject));
        return;
      }

      // ── 静态下发 ──
      if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        send(200, renderIndexHtml(detectUiDevMode(opts.uiDev)));
        return;
      }
      if (req.method === 'GET' && pathname === '/styles.css') {
        sendRaw(res, 200, 'text/css; charset=utf-8', SPA_CSS);
        return;
      }
      // renderer/main.js 拆成 ESM 后，浏览器按相对路径回源 /src/**
      if (req.method === 'GET' && pathname.startsWith('/src/')) {
        const asset = rendererAsset(pathname);
        if (!asset) {
          send(404, envelope(false, 'api.static', undefined, {
            code: 'E_STATIC',
            message: `no renderer asset ${pathname}`,
          }));
          return;
        }
        sendRaw(res, 200, asset.type, asset.body);
        return;
      }
      if (req.method === 'GET' && (pathname === '/app.js' || pathname === '/main.js')) {
        const js = rendererMainJs();
        if (js === null) {
          send(500, envelope(false, 'api.static', undefined, {
            code: 'E_STATIC',
            message: 'renderer/main.js missing; renderer/ is the single UI source of truth (see docs/design/module-webui-spa-split.md)',
          }));
          return;
        }
        sendRaw(res, 200, 'text/javascript; charset=utf-8', js);
        return;
      }

      // ── 路由表 ──
      const ctx: UiRouteContext = {
        req,
        res,
        url,
        method: req.method ?? 'GET',
        pathname,
        send,
        readBody: () => readBody(req),
        cwd,
        binder,
        watch: watchCtl,
        workset,
        ghLogin,
        loadCfg,
      };
      for (const route of ROUTES) {
        if (await route(ctx)) return;
      }

      send(404, envelope(false, 'api.unknown', undefined, {
        code: 'E_USAGE',
        message: `no route ${req.method} ${pathname}`,
      }));
    } catch (err) {
      sendAppError(send, err);
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
