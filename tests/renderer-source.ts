import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rendererRoot = path.join(repoRoot, 'renderer');

/** Vite root entry: renderer/main.js（也是 UI 服务器 /main.js 下发的原文）。 */
export function rendererEntryJs(): string {
  return fs.readFileSync(path.join(rendererRoot, 'main.js'), 'utf8');
}

/** renderer/src 下所有 .js 子模块的相对路径（稳定排序，便于断言顺序相关行为）。 */
export function rendererModuleRelPaths(): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else if (entry.name.endsWith('.js')) out.push(rel);
    }
  };
  walk(path.join(rendererRoot, 'src'), 'src');
  return out.sort();
}

/** 渲染器全部 JS（入口 + 子模块）。UI 契约断言针对整体，不针对单个文件位置。 */
export function rendererJsAll(): string {
  const parts = [rendererEntryJs()];
  for (const rel of rendererModuleRelPaths()) {
    parts.push(fs.readFileSync(path.join(rendererRoot, rel), 'utf8'));
  }
  return parts.join('\n');
}

/**
 * 以 ESM 模块语法解析一段代码，返回语法错误（没有则 null）。
 * 用 data: URL 让 Node 按模块解析：顶层碰 document / localStorage 会 ReferenceError，
 * 依赖解析会 ERR_MODULE_NOT_FOUND——二者都不是语法问题。
 */
export async function esmSyntaxError(code: string): Promise<string | null> {
  try {
    await import(`data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`);
    return null;
  } catch (err) {
    return err instanceof SyntaxError ? String((err as Error).message) : null;
  }
}

export { rendererRoot };
