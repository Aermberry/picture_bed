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

  it('扩展名 → MIME 映射只在 src/lib/img.ts 出现', () => {
    // 只认图片专属 MIME 字面量，故 ui/http/static.ts 的**静态资源**表（.js/.css/.html/.svg）不算重复：
    // 那是下发 renderer 资源用的，与「图片资产」是两套语义。
    const offenders = files
      .filter((f) => f.rel !== 'lib/img.ts')
      .filter((f) => /'image\/(png|jpeg|gif|webp|avif|bmp|x-icon)'/.test(f.text));
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

  it('文档类型判定只在 src/lib/doc.ts 出现（md / markdown → markdown）', () => {
    expect(readSrc('lib/doc.ts')).toContain('export function kindOf');
    // 认的是「手搓 extname().toLowerCase() 再比对 markdown」这整套形态；
    // 仅出现 'markdown' 字样（类型名、注释、路由文案）不算重复实现。
    const offenders = files
      .filter((f) => f.rel !== 'lib/doc.ts')
      .filter((f) => /extname\([^)]*\)\.toLowerCase\(\)/.test(f.text) && /'markdown'/.test(f.text));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });

  it('「是否在根内」的前缀式判定只在 src/lib/paths.ts 出现', () => {
    // ui/http/static.ts 曾用 `file !== root && !file.startsWith(root + path.sep)` 手写第二份：
    // 那是 prefix 直觉，漏掉 path.isAbsolute 分支（Windows 跨盘场景），现已统一到 isUnderRoot。
    const offenders = files
      .filter((f) => f.rel !== 'lib/paths.ts')
      .filter((f) => /\.startsWith\([^()]*\+\s*path\.sep\)/.test(f.text));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });
});
