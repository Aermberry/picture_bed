import type http from 'node:http';

/** 请求体上限（docs/design/module-webui-http-hardening.md decision 4）。 */
export const API_BODY_LIMIT = 64 * 1024;

/**
 * 读取请求体并在超限时提前失败。
 * 超限后仍 drain 剩余数据，保证 413 响应能被送达。
 */
export function readBody(req: http.IncomingMessage, limit = API_BODY_LIMIT): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
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
