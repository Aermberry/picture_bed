import type { DocKind } from '../types.js';
import { normalizeExt } from './img.js';

/**
 * 文档类型（markdown / html）判定的唯一实现。
 * 此前 `scan.ts` 与 `extract.ts` 各有一份逐字符相同的副本（`extname → toLowerCase → 比对 .md/.markdown`）。
 * 两份副本的风险是单向漂移：一侧新增后缀（如 .markdown）另一侧不跟，
 * 结果就是「扫描认为它不是文档（不进工作集）、抽取却按 markdown 语法解析」这类只在某条路径上出现的 bug。
 *
 * 复用 `img.ts` 的 normalizeExt，避免把「扩展名归一化」散落成第二份。
 * 注：这里管的是**文档**类型，与 `lib/img.ts` 管的**图片资产**是两套语义，别互相套用。
 */
const MARKDOWN_EXT = new Set(['md', 'markdown']);

export function kindOf(docPath: string): DocKind {
  return MARKDOWN_EXT.has(normalizeExt(docPath)) ? 'markdown' : 'html';
}
