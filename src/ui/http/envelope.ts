import type http from 'node:http';
import type { JsonEnvelope } from '../../types.js';

/** 统一的 JSON 信封构造器（CLI / MCP / WebUI 共用同一形状）。 */
export function envelope<T>(
  ok: boolean,
  command: string,
  data?: T,
  error?: JsonEnvelope['error'],
  warnings?: string[],
): JsonEnvelope<T> {
  return { schemaVersion: 1, ok, command, data, warnings, error: error ?? null };
}

/** `send(status, body)`：body 为 string 时按 HTML 下发，否则按 JSON。 */
export function makeSend(res: http.ServerResponse): (status: number, body: unknown) => void {
  return (status, body) => {
    const text = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    res.writeHead(status, {
      'Content-Type':
        typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(text);
  };
}

export function sendRaw(
  res: http.ServerResponse,
  status: number,
  contentType: string,
  body: string | Buffer,
): void {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(body);
}

/** Host 头归一化：去 IPv6 方括号 + 小写（与 bindHost 比较用）。 */
export function normalizeHostname(host: string): string {
  return host.replace(/^\[|\]$/g, '').toLowerCase();
}
