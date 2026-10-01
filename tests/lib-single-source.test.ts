import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(repoRoot, 'src');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(srcRoot, rel), 'utf8');
}

function allTs(rel = ''): { rel: string; text: string }[] {
  const dir = path.join(srcRoot, rel);
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((ent) => {
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) return allTs(childRel);
      return ent.name.endsWith('.ts') ? [{ rel: childRel, text: readSrc(childRel) }] : [];
    });
}

const files = allTs();

describe('src/lib 单点收敛', () => {
  it('图片扩展名白名单只在 src/lib/img.ts 出现', () => {
    const offenders = files
      .filter((f) => f.rel !== 'lib/img.ts')
      .filter((f) => /new Set\(\[[^\]]*'png'/.test(f.text) || /IMAGE_EXTS\b/.test(f.text));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });

  it('sha256 只在 src/lib/hash.ts 里计算', () => {
    const offenders = files
      .filter((f) => f.rel !== 'lib/hash.ts')
      .filter((f) => f.text.includes("createHash('sha256')"));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });

  it('越界判定只在 src/lib/paths.ts 里出现（.. 转义判定）', () => {
    // watch.ts 是**唯一**例外：根外事件被有意退化为绝对路径（不是越界守卫），语义不同。
    const offenders = files
      .filter((f) => f.rel !== 'lib/paths.ts' && f.rel !== 'watch.ts')
      .filter((f) => /rel\w*\.startsWith\('\.\.'\)/.test(f.text));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });

  it('token 掩码只有一个实现，且不使用硬编码掩码串', () => {
    expect(readSrc('lib/mask.ts')).toContain('export function maskToken');
    const offenders = files.filter((f) => f.text.includes('••••••••'));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });
});
