import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * §2.5 是给人和 Agent 读的「实现地图」：目录树、文件数、行数全是手写字面量。
 * 字面量一旦落后于实现就只剩误导 —— 历史上漂过三次且无人察觉：
 * cli.ts 行数差 31 行、ui/index.ts 未入树、tests 少算 ui-panels 一个用例文件。
 * 本文件把这些字面量变成活断言：文档与实现不一致就红，失败信息直接给出应改成的值。
 *
 * 设计取舍：
 * - **计数用相等**：地图声称「src/ 60 文件」就该是 60；增删文件必须同步改地图，这正是本守卫的目的。
 * - **行数用 ±15 容差**：行数随日常改动浮动，只有明显陈旧（如 cli.ts 差 31 行）才报错，避免每次编辑都红。
 * - **renderer/ 与 tests/ 不走树**：这两处用「一行注释汇总多个文件」的写法，树条目数天然少于真实文件数，
 *   改由「规模」行的计数断言兜把关（见 `规模行的目录文件数属实`）。
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
/** 行数：去掉末尾换行再数，与 Get-Content 口径一致（即 §2.5 里记的那个数） */
const linesOf = (rel: string): number => read(rel).replace(/\n$/, '').split('\n').length;

function countFilesIn(abs: string): number {
  return fs.readdirSync(abs, { withFileTypes: true }).reduce(
    (n, ent) => (ent.isDirectory() ? n + countFilesIn(path.join(abs, ent.name)) : n + 1),
    0,
  );
}
const countFiles = (rel: string): number => countFilesIn(path.join(repoRoot, rel));

/**
 * 解析 §2.5.3 全仓目录树（首行 `picbed/` 的 ```text 块），返回每个顶层目录下的**文件条目数**。
 * 依赖树的不变量：每层缩进固定 3 字符，文件条目不以 `/` 结尾，汇总行以「（」开头。
 */
function treeFileCounts(md: string): Map<string, number> {
  const lines = md.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '```text' && lines[i + 1]?.trim() === 'picbed/') {
      start = i + 1;
      break;
    }
  }
  if (start === -1) throw new Error('architecture.md: 找不到 §2.5.3 全仓目录树（```text + 首行 picbed/）');

  const counts = new Map<string, number>();
  let top = '';
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].trim() === '```') break;
    const entry = /^([│\s]*)([├└]─+)\s*(\S+)/.exec(lines[i].split('//')[0]);
    if (!entry) continue;
    const prefix = entry[1];
    const name = entry[3];
    if (prefix.length === 0) top = name.replace(/\/$/, ''); // 顶层目录：缩进为 0
    if (name.endsWith('/')) continue; // 目录条目不计入文件数
    if (/^[（【]/.test(name)) continue; // 「（其余 13 个用例文件：…）」这类汇总行
    counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return counts;
}

/** 从文档里抓一个数；抓不到直接失败（避免正则悄悄失效，让守卫变成摆设） */
function docNumber(md: string, re: RegExp, label: string): number {
  const m = re.exec(md);
  if (!m) throw new Error(`architecture.md: 抓不到 ${label} —— 正则或文档措辞已变，请更新本守卫`);
  return Number(m[1].replace(/,/g, ''));
}

describe('§2.5 实现地图与磁盘对齐', () => {
  const md = read('docs/architecture.md');
  const tree = treeFileCounts(md);

  it('逐文件列名的目录树条目数与磁盘一致（src / bin / desktop / scripts）', () => {
    for (const dir of ['src', 'bin', 'desktop', 'scripts']) {
      const real = countFiles(dir);
      expect(tree.get(dir), `§2.5.3 树的 ${dir}/ 条目数`).toBe(real);
    }
  });

  it('规模行的目录文件数属实（含注释汇总的 renderer）', () => {
    for (const dir of ['src', 'renderer', 'desktop', 'scripts']) {
      const n = docNumber(md, new RegExp(`\`${dir}/\`\\s+(\\d+)\\s+文件`), `规模行 ${dir} 文件数`);
      const real = countFiles(dir);
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

  it('文档点名的行数与实现相差不超过 ±15 行', () => {
    const claims: [string, RegExp, string][] = [
      ['src/cli.ts', /src\/cli\.ts（commander，(\d+) 行）/, '§2.5.1 cli.ts 行数'],
      ['src/ui/server.ts', /`createUiServer`（(\d+) 行/, '§2.5.1 server.ts 行数'],
      ['src/mcp/server.ts', /`src\/mcp\/server\.ts`（(\d+) 行）/, '§2.5.1 mcp/server.ts 行数'],
    ];
    for (const [file, re, label] of claims) {
      const claimed = docNumber(md, re, label);
      const real = linesOf(file);
      expect(Math.abs(claimed - real), `${label}：文档写 ${claimed} 行，实际 ${real} 行`).toBeLessThanOrEqual(15);
    }
  });

  it('四个宿主共用入口的契约仍在（ui/index.ts 是 createUiServer 的唯一出口）', () => {
    expect(read('src/ui/index.ts')).toMatch(/export\s*\{[^}]*createUiServer/);
    expect(read('src/cli.ts')).toMatch(/import\('\.\/ui\/index\.js'\)/);
    expect(read('desktop/main.mjs')).toMatch(/dist\/ui\/index\.js/);
  });
});
