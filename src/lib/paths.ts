import path from 'node:path';

/**
 * 本地路径越界判定的唯一实现。
 * 规则：`abs` 相对 `root` 的 relative 结果不得为绝对路径、不得以 `..` 开头。
 * 原散落于 `resolve.ts` / `ui/root.ts` / `ui/server.ts` / `host/local.ts`（4 份副本）。
 *
 * 注：远端仓库目录路径（`app/repo-dir.ts` 的段字符白名单与长度上限）是**另一套**规则，
 * 不使用本函数，以免把远端语义混进本地 FS 判定。
 */
export function isUnderRoot(root: string, abs: string): boolean {
  const rel = path.relative(root, abs);
  return !(rel.startsWith('..') || path.isAbsolute(rel));
}
