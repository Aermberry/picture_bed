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
