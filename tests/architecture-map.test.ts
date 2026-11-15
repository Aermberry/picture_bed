import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * §2.5 是实现地图：目录树、文件数、行数都需与仓库保持一致。
 *
 * 设计取舍：
 * - **目录集合与文件数精确相等**：增删 git 跟踪目录或文件必须同步改 §2.5.3。
 * - **行数用 ±15 容差**：行数随日常改动浮动，只有明显陈旧（如 cli.ts 差 31 行）才报错，避免每次编辑都红。
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
/** 行数：去掉末尾换行再数，与 Get-Content 口径一致（即 §2.5 里记的那个数） */
const linesOf = (rel: string): number => read(rel).replace(/\n$/, '').split('\n').length;

const trackedFiles = execSync('git ls-files', { cwd: repoRoot, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((file) => file.replace(/\\/g, '/'));

function trackedDirectoryCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of trackedFiles) {
    const parts = file.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      const dir = parts.slice(0, i).join('/');
      counts.set(dir, (counts.get(dir) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * 解析 §2.5.3 全仓目录树，读取目录路径和其 git 跟踪文件数。
 */
function treeDirectoryCounts(md: string): Map<string, number> {
  const lines = md.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '```text' && lines[i + 1]?.trim() === 'picbed/') {
      start = i + 1;
      break;
    }
  }
  if (start === -1) throw new Error('architecture.md: 找不到 §2.5.3 全仓目录树（```text + 首行 picbed/）');

  const result = new Map<string, number>();
  const parents: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].trim() === '```') break;
    const entry = /^([│\s]*)([├└]─)\s+(.+?) · (\d+) 文件 · /.exec(lines[i]);
    if (!entry) continue;
    const depth = Math.floor(entry[1].length / 3);
    const name = entry[3].replace(/\/+$/, '');
    parents.length = depth;
    const dir = [...parents, name].join('/');
    result.set(dir, Number(entry[4]));
    parents[depth] = name;
  }
  return result;
}

/** 从文档里抓一个数；抓不到直接失败（避免正则悄悄失效，让守卫变成摆设） */
function docNumber(md: string, re: RegExp, label: string): number {
  const m = re.exec(md);
  if (!m) throw new Error(`architecture.md: 抓不到 ${label} —— 正则或文档措辞已变，请更新本守卫`);
  return Number(m[1].replace(/,/g, ''));
}

describe('§2.5 实现地图与磁盘对齐', () => {
  const md = read('docs/architecture.md');
  const tree = treeDirectoryCounts(md);
  const trackedDirs = trackedDirectoryCounts();
  const maxDepth = Math.max(...[...tree.keys()].map((dir) => dir.split('/').length));
  const expectedDirs = new Set([...trackedDirs.keys()].filter((dir) => dir.split('/').length <= maxDepth));

  it('目录树中的目录均存在于 tracked files', () => {
    for (const dir of tree.keys()) {
      expect(trackedDirs.has(dir), `§2.5.3 树中的目录 ${dir}/ 应含 git 跟踪文件`).toBe(true);
    }
  });

  it('目录树与 git 跟踪目录集合双向相等', () => {
    expect([...tree.keys()].sort(), '§2.5.3 树中目录集合').toEqual([...expectedDirs].sort());
  });

  it('目录树文件数与 git 跟踪文件数一致', () => {
    for (const [dir, claimed] of tree) {
      expect(claimed, `§2.5.3 树中 ${dir}/ 声明 ${claimed} 个文件`).toBe(trackedDirs.get(dir));
    }
  });

  it('规模行的目录文件数属实', () => {
    for (const dir of ['src', 'renderer', 'desktop', 'scripts']) {
      const n = docNumber(md, new RegExp(`\`${dir}/\`\\s+(\\d+)\\s+文件`), `规模行 ${dir} 文件数`);
      const real = trackedDirs.get(dir);
      expect(n, `§2.5.3 规模行写明 ${dir}/ ${n} 文件`).toBe(real);
    }
  });

  it('tests 的用例文件数与辅助文件数属实（两处计数口径一致）', () => {
    const files = fs.readdirSync(path.join(repoRoot, 'tests'));
    const cases = files.filter((f) => f.endsWith('.test.ts')).length;
    const helpers = files.filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).length;

    const scaleCases = docNumber(md, /`tests\/`\s+(\d+)\s+个用例文件/, '规模行 tests 用例文件数');
    const scaleHelpers = docNumber(md, /`tests\/`\s+\d+\s+个用例文件\s+\+\s+(\d+)\s+个辅助/, '规模行 tests 辅助数');
    expect(scaleCases, '§2.5.3 规模行 tests 用例文件数').toBe(cases);
    expect(scaleHelpers, '§2.5.3 规模行 tests 辅助数').toBe(helpers);

    // tests/ 小结行的同一数字也要同步（历史上这里比实际少算一个 ui-panels）
    const head = /vitest（\d+ 用例 \/ (\d+) 个用例文件 \+ (\d+) 个辅助/.exec(md);
    if (!head) throw new Error('architecture.md: 抓不到 tests/ 小结行计数 —— 措辞已变，请更新本守卫');
    expect(Number(head[1]), '§2.5.3 tests 小结行 用例文件数').toBe(cases);
    expect(Number(head[2]), '§2.5.3 tests 小结行 辅助数').toBe(helpers);
  });

  it('文档写的用例总数与磁盘一致（静态 it( 口径）', () => {
    // 用例内部取不到 vitest 的运行总数，故用「静态 it( / test( 计数」作代理。
    // 静态 it( / test( 计数用于同步 §2.5.3 的用例总数。
    // 若将来引入 it.each，本断言会先红——届时把文档改成运行总数并放宽此断言。
    const cases = fs
      .readdirSync(path.join(repoRoot, 'tests'))
      .filter((f) => f.endsWith('.test.ts'))
      .reduce((n, f) => n + (read(`tests/${f}`).match(/^\s*(?:it|test)\(/gm) ?? []).length, 0);
    const claimed = docNumber(md, /vitest（(\d+) 用例/, 'tests 小结行用例总数');
    expect(claimed, '§2.5.3 tests 小结行 用例总数').toBe(cases);
  });

  it('文档点名的行数与实现相差不超过 ±15 行', () => {
    const claims: [string, RegExp, string][] = [
      ['src/ui/server.ts', /`createUiServer`（(\d+) 行/, '§2.5.1 server.ts 行数'],
    ];
    for (const [file, re, label] of claims) {
      const claimed = docNumber(md, re, label);
      const real = linesOf(file);
      expect(Math.abs(claimed - real), `${label}：文档写 ${claimed} 行，实际 ${real} 行`).toBeLessThanOrEqual(15);
    }
  });

  it('Electron 唯一宿主的契约仍在（ui/index.ts 是 createUiServer 的唯一出口）', () => {
    expect(read('src/ui/index.ts')).toMatch(/export\s*\{[^}]*createUiServer/);
    expect(read('desktop/main.mjs')).toMatch(/dist\/ui\/index\.js/);
    // CLI 与 MCP 宿主已删除（2026-11-10）：dist/cli.js、dist/mcp/server.js、bin/* 不应再出现。
    expect(fs.existsSync(path.join(repoRoot, 'src', 'cli.ts'))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, 'src', 'mcp'))).toBe(false);
    expect(fs.existsSync(path.join(repoRoot, 'bin'))).toBe(false);
  });
});
