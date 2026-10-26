/**
 * 文档内 `data:image/*` 内嵌图的解析。
 *
 * 此前 `resolve.ts` 把所有 `data:` 引用一律 blocked（E_SKIP_REF）——但内嵌图
 * 是「有图却传不了」的静默失败：图在文档里，没有对应本地文件。这里把它解码成
 * 内存资产，让上传链路与本地图片同池去重。
 */

import { IMAGE_MIME } from './img.js';

/** 单张内嵌图解码后的上限（10 MB）。 */
export const INLINE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * MIME → 扩展名：由 `IMAGE_MIME`（唯一真源）反查，不另立一份表。
 * 同一 MIME 可能对应多个扩展名（image/jpeg → jpg / jpeg），取首个。
 */
const MIME_EXT: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [ext, mime] of Object.entries(IMAGE_MIME)) {
    if (!(mime in out)) out[mime] = ext;
  }
  return out;
})();

export interface InlineImage {
  mime: string;
  ext: string;
  data: Buffer;
}

export type InlineParseResult =
  | { ok: true; image: InlineImage }
  | { ok: false; code: string; reason: string };

/** 是否为 data URI（大小写不敏感，允许前导空白）。 */
export function isDataUri(raw: string): boolean {
  return /^data:/i.test(raw.trim());
}

/**
 * 解析 `data:image/*` 内嵌图。非图片 data URI 或非法编码返回失败原因。
 * 支持 `;base64,` 与 URL-encoded 两种编码。
 */
export function parseInlineImage(raw: string, maxBytes = INLINE_MAX_BYTES): InlineParseResult {
  const s = raw.trim();
  const comma = s.indexOf(',');
  if (comma < 0) return { ok: false, code: 'E_INLINE_DATA', reason: 'malformed data URI (no comma)' };

  const header = s.slice(5, comma); // 去掉 "data:"
  const payload = s.slice(comma + 1);
  const parts = header.split(';').map((p) => p.trim());
  const mime = (parts[0] || '').toLowerCase();
  const isBase64 = parts.some((p) => p.toLowerCase() === 'base64');

  if (!mime.startsWith('image/')) {
    return { ok: false, code: 'E_SKIP_REF', reason: 'non-image data URI' };
  }
  const ext = MIME_EXT[mime];
  if (!ext) {
    return { ok: false, code: 'E_INLINE_MIME', reason: `unsupported inline image type ${mime}` };
  }

  let data: Buffer;
  try {
    data = isBase64
      ? Buffer.from(decodeBase64Lenient(payload), 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8');
  } catch (err) {
    return { ok: false, code: 'E_INLINE_DATA', reason: `cannot decode data URI: ${String(err)}` };
  }

  if (!data.length) {
    return { ok: false, code: 'E_INLINE_DATA', reason: 'empty data URI payload' };
  }
  if (data.length > maxBytes) {
    return {
      ok: false,
      code: 'E_INLINE_TOO_LARGE',
      reason: `inline image ${data.length} bytes exceeds limit ${maxBytes}`,
    };
  }
  return { ok: true, image: { mime, ext, data } };
}

/** base64 允许 URL-safe 变体与内嵌换行；Buffer.from 遇到非法字符会静默截断，故先归一化。 */
function decodeBase64Lenient(payload: string): string {
  return payload.replace(/[\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
}

/** 内存资产的合成占位名：仅用于推导远端文件名，绝不落盘。 */
export function inlineLocalPath(sha12: string, ext: string): string {
  return `inline/${sha12}.${ext}`;
}
