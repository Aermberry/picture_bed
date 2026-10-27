/**
 * 内嵌图的内存字节缓存（预览用）。
 *
 * 内嵌图（`data:image/*`）解码后只存在于内存，`Asset.localPath` 是合成占位名
 * （`inline/<sha12>.<ext>`），磁盘上没有对应文件。照片墙却统一用
 * `/api/preview?path=<localPath>` 取图，于是内嵌图必然 404、图块被移除，
 * 用户只看到「未扫描到本地图片」——这正是本次要修的静默失败。
 *
 * 这里不新造持久状态：由 plan/scan 在收集时登记 sha12 → 字节，
 * preview 按占位名反查。缓存按 sha12 索引，天然与内容去重一致。
 */

/** sha12 → { bytes, mime }。进程内、只增；内嵌图总量受单张 10MB 上限约束。 */
const cache = new Map<string, { bytes: Buffer; mime: string }>();

/** `inline/<sha12>.<ext>` → sha12；非合成路径返回 null。 */
export function inlineShaOf(localPath: string): string | null {
  const m = /^inline\/([0-9a-f]{12})\.[A-Za-z0-9]+$/.exec(String(localPath || ''));
  return m ? m[1] : null;
}

/**
 * 按合成占位名登记字节。`localPath` 即 `inline/<sha12>.<ext>`，
 * 与 plan 暴露给前端的路径完全一致，避免两处各算一遍导致取不到。
 */
export function rememberInline(localPath: string, data: Buffer, mime: string): void {
  const sha12 = inlineShaOf(localPath);
  if (!sha12) return;
  if (!cache.has(sha12)) cache.set(sha12, { bytes: data, mime });
}

/** 按占位名取内存字节；`ext` 用于确认前缀匹配（避免同名不同扩展名串味）。 */
export function inlineAssetBytes(localPath: string): { bytes: Buffer; mime: string } | null {
  const sha12 = inlineShaOf(localPath);
  if (!sha12) return null;
  return cache.get(sha12) ?? null;
}

/** 测试用：清空缓存（生产无需调用）。 */
export function __clearInlineCache(): void {
  cache.clear();
}
