import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

/** 不得出现在 npm 包里的东西：Electron 壳、UI 源码/POC、构建产物、源码与测试。 */
const forbiddenTop = [
  'desktop',
  'renderer',
  'out',
  'release',
  'src',
  'tests',
  'docs',
  '.agents',
  'scripts',
  'electron.vite.config.mjs',
  'electron-builder.yml',
];
/** files 里允许「尚未构建」的条目（tsc 产物目录）。 */
const buildOutputs = new Set(['dist']);

/** @param {string} rel */
function topSegment(rel) {
  return String(rel).replace(/^\.\//, '').split('/')[0];
}

describe('npm 导出面（package.json）', () => {
  it('files 不含壳层 / UI 源码 / 源码与测试目录', () => {
    for (const entry of pkg.files) {
      expect(forbiddenTop, `files 含 ${entry}`).not.toContain(topSegment(entry));
    }
  });

  it('files 条目都存在（或属于 tsc 产物目录）', () => {
    for (const entry of pkg.files) {
      const rel = topSegment(entry);
      if (buildOutputs.has(rel)) continue;
      expect(fs.existsSync(path.join(repoRoot, entry)), `files 引用不存在的 ${entry}`).toBe(true);
    }
  });

  it('没有落在发布面之外的入口（历史上 main 曾是 desktop/main.mjs）', () => {
    // `"main"` 一旦指向 files 之外的路径，npm 会把那个文件硬塞进 tarball：
    // desktop/main.mjs 就是这样混进 npm 包的（require('picbed') 会直接起 Electron）。
    const published = new Set([...pkg.files.map(topSegment), 'package.json']);
    for (const field of ['main', 'module', 'types', 'typings']) {
      if (!pkg[field]) continue;
      expect(published, `"${field}": ${pkg[field]} 不在发布面内`).toContain(topSegment(pkg[field]));
    }
  });

  it('bin 目标存在，且落在发布面内', () => {
    const published = new Set([...pkg.files.map(topSegment), 'package.json']);
    for (const [name, target] of Object.entries(pkg.bin ?? {})) {
      expect(fs.existsSync(path.join(repoRoot, target)), `bin ${name} → ${target} 不存在`).toBe(true);
      expect(published, `bin ${name} → ${target} 不在发布面内`).toContain(topSegment(target));
    }
  });

  it('bin 只依赖发布面内的产物', () => {
    const published = new Set([...pkg.files.map(topSegment), 'package.json']);
    for (const target of Object.values(pkg.bin ?? {})) {
      const src = fs.readFileSync(path.join(repoRoot, target), 'utf8');
      const refs = [...src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
      for (const ref of refs) {
        // bin/*.js → ../dist/... ；解析后必须仍落在发布面里
        const resolved = path.posix.join(path.posix.dirname(target), ref).replace(/^\.\.\//, '');
        expect(published, `${target} 依赖 ${ref}（→ ${resolved}）不在发布面内`).toContain(
          topSegment(resolved),
        );
      }
    }
  });

  it('exports 关闭深导入：目标限于发布面内，且不含通配符', () => {
    const entries = Object.entries(pkg.exports ?? {});
    expect(entries.length, '缺少 exports：dist/** 可被任意深导入').toBeGreaterThan(0);
    const allowed = new Set([...pkg.files.map(topSegment), 'package.json']);
    for (const [key, value] of entries) {
      expect(key, 'exports 不得用通配符重新打开导出面').not.toContain('*');
      const targets = typeof value === 'string' ? [value] : Object.values(value);
      for (const t of targets) {
        expect(allowed, `exports ${key} → ${t} 不在发布面内`).toContain(topSegment(t));
      }
    }
  });
});
