import type http from 'node:http';
import { API_BODY_LIMIT } from './body.js';
import { normalizeHostname } from './envelope.js';
import { envelope } from './envelope.js';

export interface GuardRejection {
  status: number;
  command: string;
  code: string;
  message: string;
}

/**
 * 安检：Host 解析与绑定地址校验、/api 同源、POST 头与 Content-Type、请求体上限。
 * 这些是「一次读懂、不常改」的协议/安全策略，此前与 30 条业务路由挤在同一个函数里。
 */

/** Host 必须存在且可解析——不做静默回退（避免凭空构造请求 URL）。 */
export function parseHost(hostHeader: string): { ok: true; hostUrl: URL } | { ok: false; rejection: GuardRejection } {
  try {
    return { ok: true, hostUrl: new URL(`http://${hostHeader}`) };
  } catch {
    return {
      ok: false,
      rejection: {
        status: 400,
        command: 'api.host',
        code: 'E_USAGE',
        message: 'missing or malformed Host header',
      },
    };
  }
}

/**
 * Host 必须指向绑定的地址（decision 5）：阻断 DNS-rebinding（Origin 与 Host
 * 同时被攻击者控制）。通配绑定是显式暴露到局域网，跳过此检查；`localhost` 恒放行。
 */
export function checkHost(hostUrl: URL, bindHost: string): GuardRejection | null {
  const wildcard = bindHost === '0.0.0.0' || bindHost === '::';
  const name = normalizeHostname(hostUrl.hostname);
  if (!wildcard && bindHost !== '' && name !== bindHost && name !== 'localhost') {
    return {
      status: 403,
      command: 'api.host',
      code: 'E_HOST',
      message: 'Host header must name the bound address',
    };
  }
  return null;
}

/**
 * /api 请求安检：
 * - 携带 Origin 时必须同源（不发出任何 CORS 头，跨源页面无法伪造）
 * - POST 另需 `X-Picbed-UI: 1` 与 `application/json`（SPA 的 api() 提供）
 * - Content-Length 超限先行拒绝（覆盖从不调用 readBody 的 handler）
 */
export function checkApiRequest(
  req: http.IncomingMessage,
  pathname: string,
  hostUrl: URL,
): GuardRejection | null {
  if (!pathname.startsWith('/api/')) return null;

  const origin = req.headers.origin;
  if (origin !== undefined) {
    let sameOrigin = false;
    try {
      const o = new URL(origin);
      sameOrigin =
        (o.protocol === 'http:' || o.protocol === 'https:') && o.host === hostUrl.host;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) {
      return {
        status: 403,
        command: 'api.origin',
        code: 'E_ORIGIN',
        message: 'cross-origin request rejected',
      };
    }
  }

  if (req.method === 'POST') {
    if (req.headers['x-picbed-ui'] !== '1') {
      return {
        status: 403,
        command: 'api.header',
        code: 'E_HEADER',
        message: 'missing X-Picbed-UI: 1 header',
      };
    }
    const ct = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (ct !== 'application/json') {
      return {
        status: 415,
        command: 'api.content-type',
        code: 'E_CONTENT_TYPE',
        message: 'POST requires Content-Type: application/json',
      };
    }
    const cl = req.headers['content-length'];
    if (cl !== undefined) {
      const n = Number(cl);
      if (Number.isFinite(n) && n > API_BODY_LIMIT) {
        req.resume();
        return {
          status: 413,
          command: 'api.body',
          code: 'E_BODY_TOO_LARGE',
          message: 'request body exceeds 64 KiB',
        };
      }
    }
  }
  return null;
}

export function rejectionEnvelope(r: GuardRejection) {
  return envelope(false, r.command, undefined, { code: r.code, message: r.message });
}
