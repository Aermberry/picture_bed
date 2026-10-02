import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(repoRoot, 'src');

function collect(rel = ''): { rel: string; text: string }[] {
  const dir = path.join(srcRoot, rel);
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((ent) => {
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) return collect(childRel);
      return ent.name.endsWith('.ts') ? [{ rel: childRel, text: fs.readFileSync(path.join(srcRoot, childRel), 'utf8') }] : [];
    });
}

const files = collect();
const textOf = (rel: string): string => files.find((f) => f.rel === rel)?.text ?? '';
/** 取所有静态 import 的说明符（不含注释里的同名文本） */
function importsOf(text: string): string[] {
  return [...text.matchAll(/(?:^|\n)\s*import[^;\n]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

describe('分层（CLI/WebUI → app → 领域 → host 适配器）', () => {
  it('呈现层不直连适配器 / 凭据存储 / gh CLI', () => {
    const forbidden = ['./host/', './infra/', './user-token.js', './host/index.js'];
    const offenders: string[] = [];
    for (const rel of ['cli.ts', ...files.filter((f) => f.rel.startsWith('ui/')).map((f) => f.rel)]) {
      const specs = importsOf(textOf(rel));
      // ui/ 下的相对路径以 ../ 开头
      const banned = forbidden.flatMap((f) => [f, f.replace('./', '../')]);
      if (specs.some((s) => banned.some((b) => s === b || s.startsWith(b)))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('ui 层不直连 config.ts（配置一律走 app/settings.ts 的 resolvedConfig）', () => {
    const offenders = files
      .filter((f) => f.rel.startsWith('ui/'))
      // 排除 ui/routes/config.ts 这类「自身文件名叫 config」的情况，只禁真正的 config.ts 直连
      .filter((f) => importsOf(f.text).some((s) => s.endsWith('config.js') && !s.includes('routes/')));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });

  it('app 层不深连具体适配器实现，只走 host 端口', () => {
    const offenders = files
      .filter((f) => f.rel.startsWith('app/'))
      .filter((f) => importsOf(f.text).some((s) => /(?:^|\/)host\/(?:github|local)\.js$/.test(s)));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });

  it('app 层零呈现依赖（不碰 node:http / commander / ui）', () => {
    const offenders = files
      .filter((f) => f.rel.startsWith('app/'))
      .filter((f) => /from '(node:http|commander)'/.test(f.text) || importsOf(f.text).some((s) => s.includes('/ui/')));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });

  it('ui 服务器只做装配：不含业务路由字面量、且保持精简', () => {
    const server = textOf('ui/server.ts');
    // 路由字面量必须住在 routes/，server.ts 只负责 安检→静态→路由表
    expect(server).not.toMatch(/'\/api\//);
    expect(server.split('\n').length).toBeLessThan(250);
  });

  it('业务路由都在 ui/routes/ 下，且每个文件都在可控体量内', () => {
    const routes = files.filter((f) => f.rel.startsWith('ui/routes/'));
    expect(routes.length).toBeGreaterThan(5);
    for (const r of routes) {
      expect(r.text.split('\n').length).toBeLessThan(250);
    }
  });

  it('适配器层不反向依赖 app 层', () => {
    const offenders = files
      .filter((f) => f.rel.startsWith('host/'))
      .filter((f) => importsOf(f.text).some((s) => s.includes('/app/')));
    expect(offenders.map((f) => f.rel)).toEqual([]);
  });
});
