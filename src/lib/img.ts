import path from 'node:path';

/**
 * 图片扩展名的唯一真源。
 * 此前：`src/extract.ts` 的 IMAGE_EXT、`src/ui/server.ts` 的 IMAGE_EXTS、
 * 以及 server.ts 里 `/api/preview` 内联的第三份 —— 三份副本会各自漂移。
 */
export const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico']);

/** 归一化「扩展名字符串」本身（如 `md` / `.MD`；不是路径）。原散落 4 处 */
export function normalizeExtToken(ext: string): string {
  return ext.replace(/^\./, '').toLowerCase();
}

/** 取路径的扩展名并归一化（仅用于路径，不要传裸扩展名） */
export function normalizeExt(p: string): string {
  return normalizeExtToken(path.extname(p));
}

export function isImageExt(p: string): boolean {
  return IMAGE_EXT.has(normalizeExt(p));
}

/**
 * 扩展名 → MIME 的唯一真源（键为归一化扩展名，不带点）。
 * 此前 `resolve.ts` / `app/sync.ts` / `ui/routes/preview.ts` 各有一份字面相同、顺序不同的副本，
 * 任何一侧加格式（如 avif）另一侧都会漏，故收敛于此。
 */
export const IMAGE_MIME: Record<string, string> = {
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

/** 按路径取 MIME；未知扩展名退化为 application/octet-stream（保持收敛前各处行为一致） */
export function mimeOf(p: string): string {
  return IMAGE_MIME[normalizeExt(p)] ?? 'application/octet-stream';
}
