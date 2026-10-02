#!/usr/bin/env node
/**
 * Unified repo validator — replaces scripts/validate-design.ps1 + scripts/validate-bootstrap.ps1.
 * Written for Node so CI (ubuntu) can run it; the old PowerShell scripts were Windows-only
 * and had no npm/CI wiring at all (zero automated protection).
 *
 *   node scripts/validate.mjs                      # all profiles
 *   node scripts/validate.mjs --profile=design     # design deliverable layout
 *   node scripts/validate.mjs --profile=bootstrap  # AgentGo bootstrap layout + delivery rules
 *   node scripts/validate.mjs --profile=scripts    # npm scripts reference existing files
 *   node scripts/validate.mjs --profile=pack       # npm 包导出面 / tarball 内容（需先 npm run build）
 *
 * Exit 0 on pass, 1 on fail. No secrets, no network.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = [];
const args = process.argv.slice(2);
const requested = args
  .filter((a) => a.startsWith('--profile='))
  .flatMap((a) => a.slice('--profile='.length).split(','))
  .filter(Boolean);
const profiles = requested.length > 0 ? requested : ['design', 'bootstrap', 'scripts'];

const exists = (rel) => fs.existsSync(path.join(root, rel));
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const want = (label, rel) => {
  if (!exists(rel)) fail.push(`${label}: missing ${rel}`);
};

if (profiles.includes('design')) {
  for (const rel of [
    'docs/html/index.html',
    'docs/html/styles.css',
    'docs/html/app.js',
    'docs/architecture.md',
    'docs/features-index.md',
    'docs/design-reading-guide.md',
    'docs/design/module-ingest.md',
    'docs/design/module-transfer.md',
    'docs/design/module-rewrite.md',
    'docs/design/module-cliops.md',
    'docs/design/module-webui.md',
    'docs/design/module-webui-spa-split.md',
    'docs/design/module-desktop.md',
    'docs/design/module-app.md',
    'docs/design/cross-cutting.md',
    'docs/design/module-webui-http-hardening.md',
  ]) {
    want('design', rel);
  }

  if (exists('docs/html/index.html')) {
    const html = read('docs/html/index.html');
    for (const id of ['guide', 'features', 'architecture', 'modules', 'cli', 'docs']) {
      if (!html.includes(`id="${id}"`)) fail.push(`design: docs/html/index.html missing section #${id}`);
    }
  }

  if (exists('docs/features-index.md')) {
    const fi = read('docs/features-index.md');
    for (const token of ['F1 ', 'F4 ', 'F7 ', 'F10 ', 'P0', 'AC']) {
      if (!fi.includes(token)) fail.push(`design: features-index missing ${token.trim()}`);
    }
  }
}

if (profiles.includes('bootstrap')) {
  for (const rel of [
    'AGENTS.md',
    '.agents/changelog.md',
    '.agents/rules/delivery.md',
    '.agents/memory/project-overview.md',
    '.agents/memory/source-index.md',
    '.agents/memory/review-findings.md',
    '.agents/memory/open-items.md',
    '.agents/memory/outcomes.md',
    '.agents/memory/decisions.md',
    '.agents/memory/gotchas.md',
    '.agents/memory/patterns.md',
    '.agents/memory/secret-requirements.md',
  ]) {
    want('bootstrap', rel);
  }

  if (exists('.agents/rules/delivery.md')) {
    const delivery = read('.agents/rules/delivery.md');
    if (!delivery.includes('Commit after every change')) fail.push('bootstrap: delivery.md missing commit rule');
    if (!delivery.includes('Tests before delivery')) fail.push('bootstrap: delivery.md missing test rule');
  }
}

if (profiles.includes('scripts')) {
  // Every npm script must point at a file that exists — catches orphan/deleted scripts
  // (e.g. the dead scripts/extract-renderer.mjs) and typos in bin/ or scripts/ paths.
  if (exists('package.json')) {
    const pkg = JSON.parse(read('package.json'));
    for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
      const refs = String(cmd).match(/(?:scripts|bin)\/[\w.-]+/g) ?? [];
      for (const rel of refs) {
        if (!exists(rel)) fail.push(`scripts: npm run ${name} references missing ${rel}`);
      }
    }
  }
}

if (profiles.includes('pack')) {
  // 真实 tarball 审计：只有它能暴露 manifest 字面看不出的问题——
  // 例如 npm 会把 "main" 指向的文件硬塞进包（desktop/main.mjs 就是这样混进来的），
  // 即便 files 没有列出那个目录。需要 dist 已构建（CI 在 validate 前有 npm run build）。
  if (!exists('dist/cli.js')) {
    fail.push('pack: 缺少 dist/cli.js —— 先跑 npm run build 再做包面审计');
  } else {
    let raw = '';
    try {
      // Windows 下 spawn .cmd 直接调用会 EINVAL，走 shell 最稳（命令为静态字符串）
      raw = execSync('npm pack --dry-run --json', {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });
    } catch (err) {
      fail.push(`pack: npm pack --dry-run 执行失败：${String(err.message).slice(0, 160)}`);
    }
    const start = raw.indexOf('[');
    if (start === -1) {
      fail.push('pack: 无法解析 npm pack --json 输出');
    } else {
      let entries = [];
      try {
        entries = (JSON.parse(raw.slice(start))[0]?.files ?? []).map((f) => f.path);
      } catch {
        fail.push('pack: npm pack --json 输出不是合法 JSON');
      }
      if (entries.length) {
        const top = new Set(entries.map((p) => p.split('/')[0]));
        for (const bad of [
          'desktop',
          'renderer',
          'out',
          'release',
          'src',
          'tests',
          'docs',
          '.agents',
          'scripts',
          'node_modules',
          '.git',
        ]) {
          if (top.has(bad)) fail.push(`pack: tarball 含 ${bad}/（壳层 / UI 源码 / 源码测试不得发布）`);
        }
        for (const need of [
          'package.json',
          'README.md',
          'bin/picbed.js',
          'bin/picbed-mcp.js',
          'dist/cli.js',
          'dist/mcp/server.js',
        ]) {
          if (!entries.includes(need)) fail.push(`pack: tarball 缺少 ${need}`);
        }
      }
    }
  }
}

if (fail.length > 0) {
  for (const f of fail) console.log(`FAIL ${f}`);
  process.exit(1);
}
console.log(`PASS: ${profiles.join(', ')} validated`);
process.exit(0);
