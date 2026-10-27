import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RootBinder } from '../src/ui/root.js';
import { createUiServer, type UiServerHandle } from '../src/ui/server.js';
import { SPA_CSS } from '../src/ui/spa/styles.js';
import { INDEX_HTML } from '../src/ui/spa/index.js';
import { IMAGE_EXT } from '../src/lib/img.js';
import { isImageName } from '../renderer/src/lib/files.js';
import { loadConfig } from '../src/config.js';
import { runSync } from '../src/app/sync.js';
import { rendererEntryJs, rendererJsAll } from './renderer-source.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// UI 契约针对「渲染器整体源码」：main.js 入口 + src/** 子模块
const spaApp = rendererJsAll();
const spaEntry = rendererEntryJs();

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'picbed-ui-'));
}

describe('RootBinder policy A', () => {
  it('requires bound root before resolving files', () => {
    const b = new RootBinder();
    const r = b.resolveUnderRoot('a.md');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('E_NO_ROOT');
  });

  it('rejects absolute and escaping paths', () => {
    const root = tmp();
    const b = new RootBinder(root);
    const abs = b.resolveUnderRoot('/etc/passwd');
    expect(abs.ok).toBe(false);
    const esc = b.resolveUnderRoot('../outside.md');
    expect(esc.ok).toBe(false);
    if (!esc.ok) expect(esc.code).toBe('E_PATH_ESCAPE');
  });

  it('resolves relative path under root', () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, 'note.md'), '# hi');
    const b = new RootBinder(root);
    const r = b.resolveUnderRoot('note.md');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(path.join(root, 'note.md'));
  });
});

describe('ui server F16–F18', () => {
  let handle: UiServerHandle;
  let cwd: string;
  let base: string;

  beforeAll(async () => {
    cwd = tmp();
    fs.writeFileSync(
      path.join(cwd, 'picbed.toml'),
      [
        '[host]',
        'type = "local"',
        '[local]',
        `root = "${(cwd + '/bed').replace(/\\/g, '/')}"`,
        'public_base = "https://cdn.example.test"',
        'dir = "img"',
        '[github]',
        'owner = ""',
        'repo = ""',
        'branch = "main"',
        'dir = "img"',
        '[url]',
        'style = "raw"',
      ].join('\n'),
    );
    fs.mkdirSync(path.join(cwd, 'docs', 'img'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'docs', 'img', 'a.png'), Buffer.from([1, 2, 3, 4]));
    // 含脚本的 SVG：预览必须原样下发字节，同时带上沙箱头（不执行脚本）
    fs.writeFileSync(
      path.join(cwd, 'docs', 'img', 'evil.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>',
    );
    fs.writeFileSync(path.join(cwd, 'docs', 'post.md'), '![a](img/a.png)\n');
    const ui = createUiServer({ cwd });
    handle = await ui.listen(0, '127.0.0.1');
    base = handle.url;
  });

  afterAll(async () => {
    await handle.close();
  });

  async function api(pathname: string, body?: unknown) {
    const res = await fetch(base + pathname, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Picbed-UI': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
  }

  it('F16 health ok without token in body', async () => {
    const { status, data } = await api('/api/health');
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.schemaVersion).toBe(1);
    expect(JSON.stringify(data)).not.toMatch(/ghp_/);
  });

  it('F17 plan without root is blocked (policy A)', async () => {
    const { status, data } = await api('/api/plan', {});
    expect(status).toBe(400);
    expect(data.error.code).toBe('E_NO_ROOT');
  });

  it('F20.1 /api/repo/mkdir enforces the confirm gate and reports config gaps', async () => {
    // no confirm → 409 (same gate as every other write endpoint)
    const noConfirm = await api('/api/repo/mkdir', { path: 'img/2026' });
    expect(noConfirm.status).toBe(409);
    expect(noConfirm.data.error.code).toBe('E_CONFIRM');
    // confirm but no owner/repo configured in this fixture → E_CONFIG 400
    const noRepo = await api('/api/repo/mkdir', { path: 'img/2026', confirm: true });
    expect(noRepo.status).toBe(400);
    expect(noRepo.data.error.code).toBe('E_CONFIG');
    expect(JSON.stringify(noRepo.data)).not.toMatch(/ghp_/);
  });

  it('F20.3 GET /api/branches reports config gaps (no owner/repo in fixture)', async () => {
    const { status, data } = await api('/api/branches');
    expect(status).toBe(400);
    expect(data.error.code).toBe('E_CONFIG');
    expect(JSON.stringify(data)).not.toMatch(/ghp_/);
  });

  it('F20.1 /api/repo/mkdir rejects requests without the UI header (hardening)', async () => {
    const res = await fetch(base + '/api/repo/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'img/2026', confirm: true }),
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('E_HEADER');
  });

  it('F17 bind root then drop file and plan', async () => {
    const bind = await api('/api/session/bind-root', { root: path.join(cwd, 'docs') });
    expect(bind.data.ok).toBe(true);

    const drop = await api('/api/session/drop', {
      name: 'post.md',
      relativePath: 'post.md',
      type: 'file',
    });
    expect(drop.data.ok).toBe(true);
    expect(drop.data.data.item.status).toBe('ready');

    const bad = await api('/api/session/drop', {
      name: 'x.md',
      relativePath: '../x.md',
      type: 'file',
    });
    expect(bad.data.ok).toBe(false);
    expect(bad.data.error.code).toBe('E_PATH_ESCAPE');

    const plan = await api('/api/plan', {});
    expect(plan.data.ok).toBe(true);
    expect(plan.data.data.plan.length).toBeGreaterThan(0);
    expect(plan.data.data.summary.upload + plan.data.data.summary['skip-cache']).toBeGreaterThan(0);
  });

  it('F17 dropping a file outside the bound root rebinds root (else plan silently empty)', async () => {
    await api('/api/session/reset', {});
    const docsRoot = path.join(cwd, 'docs');
    await api('/api/session/bind-root', { root: docsRoot });
    await api('/api/session/drop', { name: 'post.md', relativePath: 'post.md', type: 'file' });

    // 另一个目录里的文档：root 已绑在 docs，旧行为会「接受但不扫描」它
    const otherRoot = path.join(cwd, 'other');
    fs.mkdirSync(path.join(otherRoot, 'img'), { recursive: true });
    fs.writeFileSync(path.join(otherRoot, 'img', 'b.png'), Buffer.from([9, 9, 9]));
    fs.writeFileSync(path.join(otherRoot, 'note.md'), '![b](img/b.png)\n');

    const drop = await api('/api/session/drop', {
      name: 'note.md',
      relativePath: 'note.md',
      type: 'file',
      absPath: path.join(otherRoot, 'note.md'),
    });
    expect(drop.data.ok).toBe(true);
    // 换根必须显式告知前端，否则旧墙会残留不属于新根的图块
    expect(drop.data.data.rebind).toBeTruthy();
    expect(drop.data.data.boundRoot).toBe(otherRoot);
    expect(drop.data.data.item.relativePath).not.toMatch(/\.\./);

    const session = await api('/api/session');
    expect(session.data.data.root).toBe(otherRoot);
    expect(session.data.data.workset).toHaveLength(1);

    const plan = await api('/api/plan', {});
    expect(plan.data.data.summary.upload + plan.data.data.summary['skip-cache']).toBeGreaterThan(0);
    expect(plan.data.data.plan.map((p: { doc?: string }) => p.doc)).toContain(
      path.join(otherRoot, 'note.md'),
    );

    // 复原：后续用例依赖 root 绑在 docs
    await api('/api/session/reset', {});
    await api('/api/session/bind-root', { root: docsRoot });
  });

  it('UI 图片格式提示覆盖 IMAGE_EXT 全部扩展名（提示不得落后于白名单）', () => {
    // 提示文案曾写「JPG / PNG / GIF / WebP」，漏掉 svg/avif/bmp/ico——
    // SVG 明明早已在白名单里，用户却看不到支持声明。
    const hint = INDEX_HTML.match(/支持 ([^·]+)·/);
    expect(hint, '未找到图片格式提示行').toBeTruthy();
    const shown = hint![1].toLowerCase();
    const missing = [...IMAGE_EXT].filter((ext) => !shown.includes(ext));
    expect(missing, `提示缺少扩展名: ${missing.join(', ')}`).toEqual([]);
  });

  it('图库与拖拽共用同一份前端图片清单（不得内联第二份正则）', () => {
    // gallery.js 曾内联 /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/，漏掉 ico
    const gallery = fs.readFileSync(
      path.join(repoRoot, 'renderer', 'src', 'features', 'gallery.js'),
      'utf8',
    );
    expect(gallery).toContain('isImageName');
    // 内联写死扩展名清单即视为第二份真源（曾漏掉 ico）。按「出现图片扩展名枚举」判定，
    // 不依赖具体转义写法——否则换个正则写法就能绕过守卫。
    expect(gallery).not.toMatch(/\b(jpe?g|webp)\b.*\|.*\b(svg|bmp|avif|ico)\b/i);
    // 前端清单必须覆盖后端白名单，否则「能上传但界面不认」
    for (const ext of IMAGE_EXT) {
      expect(isImageName(`x.${ext}`), `前端不认 .${ext}`).toBe(true);
    }
  });

  it('F17 drop rejects folders (images/docs only)', async () => {
    const drop = await api('/api/session/drop', {
      name: 'img',
      relativePath: 'img',
      type: 'dir',
    });
    expect(drop.status).toBe(400);
    expect(drop.data.ok).toBe(false);
    expect(drop.data.error.code).toBe('E_USAGE');
    expect(String(drop.data.error.message)).toMatch(/image or document/i);
  });

  it('F17 session/remove batch-deletes workset items by key', async () => {
    await api('/api/session/reset', {});
    await api('/api/session/drop', {
      name: 'post.md',
      relativePath: 'post.md',
      type: 'file',
    });
    const before = await api('/api/session');
    expect(before.data.data.workset.length).toBeGreaterThan(0);
    const bad = await api('/api/session/remove', { keys: [] });
    expect(bad.status).toBe(400);
    const rm = await api('/api/session/remove', { keys: ['post.md'] });
    expect(rm.data.ok).toBe(true);
    expect(rm.data.data.removed).toBe(1);
    const after = await api('/api/session');
    expect(after.data.data.workset.some((w: { name?: string }) => w.name === 'post.md')).toBe(false);
  });

  it('F17 drop of a document does not set previewPath (photo wall is images only)', async () => {
    await api('/api/session/reset', {});
    await api('/api/session/bind-root', { root: path.join(cwd, 'docs') });
    const dropDoc = await api('/api/session/drop', {
      name: 'post.md',
      relativePath: 'post.md',
      type: 'file',
      absPath: path.join(cwd, 'docs', 'post.md'),
    });
    expect(dropDoc.data.ok).toBe(true);
    expect(dropDoc.data.data.image).toBe(false);
    expect(dropDoc.data.data.previewPath).toBeUndefined();

    const dropImg = await api('/api/session/drop', {
      name: 'a.png',
      relativePath: 'img/a.png',
      type: 'file',
      absPath: path.join(cwd, 'docs', 'img', 'a.png'),
    });
    expect(dropImg.data.ok).toBe(true);
    expect(dropImg.data.data.image).toBe(true);
    expect(dropImg.data.data.previewPath).toBe(path.join(cwd, 'docs', 'img', 'a.png'));
  });

  it('F17 preview serves svg bytes unchanged with sandbox headers', async () => {
    await api('/api/session/reset', {});
    await api('/api/session/bind-root', { root: path.join(cwd, 'docs') });
    const abs = path.join(cwd, 'docs', 'img', 'evil.svg');
    const onDisk = fs.readFileSync(abs);
    const res = await fetch(base + '/api/preview?path=' + encodeURIComponent(abs));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toBe("sandbox; default-src 'none'");
    // 字节原样：不做消毒，脚本仍在文件里（安全性靠上下文与响应头）
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(onDisk)).toBe(true);
  });

  it('F17 preview serves inline data:image assets from memory (no disk file)', async () => {
    await api('/api/session/reset', {});
    // 独立的根，避免与其它用例的文档互相干扰
    const inlineRoot = path.join(cwd, 'inline-root');
    fs.mkdirSync(inlineRoot, { recursive: true });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="3" height="3"/></svg>';
    const b64 = Buffer.from(svg).toString('base64');
    fs.writeFileSync(
      path.join(inlineRoot, 'doc.md'),
      `# t\n\n<img src="data:image/svg+xml;base64,${b64}" />\n`,
    );
    await api('/api/session/bind-root', { root: inlineRoot });

    const plan = await api('/api/plan', {});
    expect(plan.data.ok).toBe(true);
    const item = (plan.data.data.plan as { localPath?: string; action: string }[])[0];
    // 内嵌图的 localPath 是合成占位名，磁盘上并不存在
    expect(item.localPath).toMatch(/^inline\/[0-9a-f]{12}\.svg$/);
    expect(fs.existsSync(path.join(inlineRoot, item.localPath!))).toBe(false);

    // 照片墙正是按该 localPath 取预览——必须能拿到字节，否则图块被移除
    const res = await fetch(base + '/api/preview?path=' + encodeURIComponent(item.localPath!));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(res.headers.get('content-security-policy')).toBe("sandbox; default-src 'none'");
    expect(Buffer.from(await res.arrayBuffer()).equals(Buffer.from(svg))).toBe(true);
  });

  it('F17 session/images lists workset images only (no root walk)', async () => {
    await api('/api/session/reset', {});
    // sibling image under root must NOT appear unless dropped
    const dropImg = await api('/api/session/drop', {
      name: 'a.png',
      relativePath: 'img/a.png',
      type: 'file',
      absPath: path.join(cwd, 'docs', 'img', 'a.png'),
    });
    expect(dropImg.data.ok).toBe(true);
    const imgs = await api('/api/session/images');
    expect(imgs.data.ok).toBe(true);
    expect(imgs.data.data.images).toEqual([path.join(cwd, 'docs', 'img', 'a.png')]);
    // restore doc workset for later tests
    await api('/api/session/drop', {
      name: 'post.md',
      relativePath: 'post.md',
      type: 'file',
    });
  });

  it('F18 skip-cache still rewrites the doc (cache hit must not skip rewriting)', async () => {
    // 复现：图片已在 manifest 缓存中（skip-cache），但文档里的引用还是原样。
    // runSync 只在 upload 资产循环里填 urlBySha；skip-cache 项不在其中，
    // 若改写时只查 urlBySha 就会把整条改写丢掉——文档一直不变且无报错。
    const root = path.join(cwd, 'cache-rewrite');
    fs.mkdirSync(root, { recursive: true });
    const doc = path.join(root, 'note.md');
    const img = path.join(root, 'pic.png');
    fs.writeFileSync(img, Buffer.from([7, 7, 7, 7]));
    fs.writeFileSync(doc, '![p](pic.png)\n');

    const cfg = loadConfig({ cwd });
    // 第一次：上传并建立缓存
    const first = await runSync({ root, cfg, cwd, getToken: () => undefined });
    expect(first.ok).toBe(true);
    expect(first.uploaded).toBe(1);
    expect(fs.readFileSync(doc, 'utf8')).toContain('https://cdn.example.test');

    // 第二次：文档被还原成原始引用，图片命中缓存 → 必须仍然完成改写
    fs.writeFileSync(doc, '![p](pic.png)\n');
    const second = await runSync({ root, cfg, cwd, getToken: () => undefined });
    expect(second.ok).toBe(true);
    expect(second.uploaded).toBe(0); // 缓存命中，不重复上传
    expect(second.rewrittenDocs).toContain(path.relative(cwd, doc).split(path.sep).join('/'));
    expect(fs.readFileSync(doc, 'utf8')).toContain('https://cdn.example.test');
    // 远端路径保留原文件名，故不能断言「不含 pic.png」——要断言本地相对引用已消失
    expect(fs.readFileSync(doc, "utf8")).not.toContain("](pic.png)");
  });

  it('F18 sync requires confirm then succeeds with local host', async () => {
    const denied = await api('/api/sync', {});
    expect(denied.status).toBe(409);
    expect(denied.data.error.code).toBe('E_CONFIRM');

    const dry = await api('/api/sync', { confirm: true, dryRun: true });
    expect(dry.data.ok).toBe(true);
    expect(dry.data.data.dryRun).toBe(true);
    expect(dry.data.data.uploaded).toBe(0);

    const cfg = loadConfig({ cwd });
    const result = await runSync({
      root: path.join(cwd, 'docs'),
      cfg,
      cwd,
      getToken: () => undefined,
    });
    expect(result.ok).toBe(true);
    expect(result.uploaded).toBe(1);
    expect(result.rewrittenDocs.length).toBe(1);
    const text = fs.readFileSync(path.join(cwd, 'docs', 'post.md'), 'utf8');
    expect(text).toContain('https://cdn.example.test');
  });

  it('inline data:image/* refs become uploadable assets (not blocked)', async () => {
    await api('/api/session/reset', {});
    fs.writeFileSync(
      path.join(cwd, 'docs', 'inline.md'),
      '# inline\n\n<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="i" />\n',
    );
    await api('/api/session/bind-root', { root: path.join(cwd, 'docs') });
    const { data } = await api('/api/plan', {});
    expect(data.ok).toBe(true);
    const plan = data.data.plan as any[];
    // 内嵌图现在是可上传资产，不再是 blocked
    const blocked = plan.filter((p) => p.action === 'blocked');
    expect(blocked).toHaveLength(0);
    const inline = plan.find((p) => String(p.raw).startsWith('data:image/svg+xml'));
    expect(inline).toBeTruthy();
    expect(inline.action).toBe('upload');
    // 合成占位名由 MIME 反查扩展名得出（仅用于推导远端文件名）
    expect(String(inline.localPath)).toMatch(/^inline\/[0-9a-f]{12}\.svg$/);
    // 去重键是解码后字节的 sha256
    expect(String(inline.sha256)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('non-image data: URI still blocked with code exposed', async () => {
    await api('/api/session/reset', {});
    fs.writeFileSync(
      path.join(cwd, 'docs', 'plain.md'),
      '# plain\n\n<img src="data:text/plain;base64,aGk=" alt="i" />\n',
    );
    await api('/api/session/bind-root', { root: path.join(cwd, 'docs') });
    const { data } = await api('/api/plan', {});
    const blocked = (data.data.plan as any[]).filter((p) => p.action === 'blocked');
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked[0].code).toBe('E_SKIP_REF');
    expect(blocked[0].doc).toContain('plain.md');
  });

  it('svg uploads byte-identical (sha256 unchanged; no sanitize/transcode)', async () => {
    const { sha256Hex } = await import('../src/lib/hash.js');
    // 前序用例写入的 inline/plain 文档会带来额外内嵌资产，先清掉保证本用例只测这一个文件
    for (const f of ['inline.md', 'plain.md']) {
      const p = path.join(cwd, 'docs', f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    const abs = path.join(cwd, 'docs', 'img', 'evil.svg');
    const before = fs.readFileSync(abs);
    const cfg = loadConfig({ cwd });
    const result = await runSync({
      root: path.join(cwd, 'docs'),
      cfg,
      cwd,
      getToken: () => undefined,
      includeImages: [abs],
    });
    expect(result.ok).toBe(true);
    expect(result.uploaded).toBe(1);
    // 落盘到 local host root 的字节必须与源文件完全一致（未消毒、未转码）
    const bed = path.join(cwd, 'bed', 'img');
    const uploaded = fs
      .readdirSync(bed, { recursive: true })
      .map(String)
      .find((f) => f.endsWith('.svg'));
    expect(uploaded).toBeTruthy();
    const onHost = fs.readFileSync(path.join(bed, uploaded!));
    expect(onHost.equals(before)).toBe(true);
    expect(sha256Hex(onHost)).toBe(sha256Hex(before));
  });

  it('runSync includeDocs scopes rewrite; includeImages uploads standalone', async () => {
    const cfg = loadConfig({ cwd });
    // second doc not referenced by includeDocs must stay untouched
    fs.writeFileSync(path.join(cwd, 'docs', 'other.md'), '![x](img/a.png)\n');
    const scoped = await runSync({
      root: path.join(cwd, 'docs'),
      cfg,
      cwd,
      getToken: () => undefined,
      includeDocs: [path.join(cwd, 'docs', 'post.md')],
      includeImages: [path.join(cwd, 'docs', 'img', 'a.png')],
    });
    expect(scoped.ok).toBe(true);
    const other = fs.readFileSync(path.join(cwd, 'docs', 'other.md'), 'utf8');
    expect(other).toContain('img/a.png');
    expect(other).not.toContain('https://cdn.example.test');
  });

  it('serves console HTML', async () => {
    const res = await fetch(base + '/');
    const html = await res.text();
    expect(html).toContain('picbed 本地控制台');
    expect(html).toContain('拖拽');
  });

  it('F23 shell: four nav views, dropzone; theme tokens live in styles.css', async () => {
    const html = await (await fetch(base + '/')).text();
    for (const label of ['上传', '管理', '设置', '规范']) {
      expect(html).toContain('>' + label + '</button>');
    }
    expect(html).toContain('dropzone');
    expect(html).toContain('g-scan');
    expect(html).toContain('g-up');
    expect(html).toContain('文件放置');
    expect(SPA_CSS).toContain('#4E93C0');
    expect(SPA_CSS).toContain('#FFC978');
    expect(SPA_CSS).toContain('#EDF4FA');
  });

  it('F23 theme system: themes/logo/icon CSS in styles.css, whitelist in app.js', async () => {
    const html = await (await fetch(base + '/')).text();
    // three themes (KyoAni palette) as CSS selectors
    expect(SPA_CSS).toContain('data-theme="klein"');
    expect(SPA_CSS).toContain('data-theme="cream"');
    expect(SPA_CSS).toContain('#6484CE');
    expect(SPA_CSS).toContain('#D37493');
    // air gradient + colored soft shadow
    expect(SPA_CSS).toContain('--c-shadow');
    expect(SPA_CSS).toContain('--c-bg-2');
    expect(SPA_CSS).toContain('radial-gradient');
    // logo tokenized (consumed via CSS vars, fallbacks present)
    expect(SPA_CSS).toContain('--logo-bg');
    expect(SPA_CSS).toContain('--logo-line');
    expect(SPA_CSS).toContain('--logo-ring');
    expect(SPA_CSS).toContain('var(--logo-bg');
    // candidate lift + RGB ring
    expect(SPA_CSS).toContain('data-logo="v2"');
    expect(SPA_CSS).toContain('rgba(var(--logo-ring');
    // icon tokens (no hardcoded stroke color in markup symbols)
    expect(SPA_CSS).toContain('--ico-stroke');
    // topbar theme pills stay in markup; quota bar removed
    expect(html).toContain('themePills');
    expect(html).not.toContain('quota');
    expect(html).toContain('data-theme-btn');
    expect(html).toContain('class="ico-s"');
    expect(html).not.toContain('stroke="#2E4B7E"');
    // whitelist + multi-format copy + no JS fill injection live in app.js
    expect(spaApp).toContain('THEME_WHITELIST');
    expect(spaApp).toContain('data-copy="md"');
    expect(spaApp).not.toMatch(/querySelector\("\.bg"\)\.setAttribute/);
  });

  it('serves renderer ESM submodules under /src/** and blocks escapes', async () => {
    const mod = await fetch(base + '/src/features/theme.js');
    expect(mod.status).toBe(200);
    expect(mod.headers.get('content-type')).toContain('javascript');
    expect(await mod.text()).toContain('THEME_WHITELIST');

    // 白名单外 / 目录逃逸一律 404（不泄漏包内文件）
    for (const bad of ['/src/../package.json', '/src/../src/ui/server.ts', '/src/features/theme.css']) {
      const res = await fetch(base + bad);
      // undici 会先在客户端归一化 `/src/..`，服务端再兜一层：两者都不得 200
      expect([200].includes(res.status)).toBe(false);
    }
  });

  it('serves SPA assets as external routes (/styles.css, /main.js)', async () => {
    const html = await (await fetch(base + '/')).text();
    expect(html).toContain('styles.css');
    expect(html).toMatch(/src="\.\/main\.js"|src="\/main\.js"|src="\/app\.js"/);

    const css = await fetch(base + '/styles.css');
    expect(css.status).toBe(200);
    expect(css.headers.get('content-type')).toContain('text/css');
    expect(await css.text()).toBe(SPA_CSS);

    // renderer/main.js is the Vite root entry (also served at /app.js for older clients)
    const js = await fetch(base + '/main.js');
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('javascript');
    expect(await js.text()).toBe(spaEntry);
    const legacy = await fetch(base + '/app.js');
    expect(legacy.status).toBe(200);
    expect(await legacy.text()).toBe(spaEntry);
  });
});

describe('HTTP hardening (review finding 4)', () => {
  let handle: UiServerHandle;
  let base: string;

  beforeAll(async () => {
    handle = await createUiServer({ cwd: tmp() }).listen(0, '127.0.0.1');
    base = handle.url;
  });

  afterAll(async () => {
    await handle.close();
  });

  const port = () => Number(new URL(base).port);

  /** Raw HTTP request so we control headers browsers/undici forbid (Origin, missing Host). */
  function raw(requestText: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const sock = net.connect(port(), '127.0.0.1', () => sock.write(requestText));
      let data = '';
      sock.on('data', (c) => (data += c));
      sock.on('end', () => resolve(data));
      sock.on('error', reject);
      sock.setTimeout(3000, () => {
        sock.destroy();
        reject(new Error('raw request timed out'));
      });
    });
  }

  it('POST /api requires X-Picbed-UI header', async () => {
    const res = await fetch(base + '/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('E_HEADER');
  });

  it('POST /api requires application/json', async () => {
    const res = await fetch(base + '/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'X-Picbed-UI': '1' },
      body: '{"confirm":true}',
    });
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe('E_CONTENT_TYPE');
  });

  it('cross-origin /api requests are rejected; same-origin and Origin-less pass', async () => {
    const evil = await raw(
      `GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:${port()}\r\nOrigin: http://evil.example\r\nConnection: close\r\n\r\n`,
    );
    expect(evil).toContain('403');
    expect(evil).toContain('E_ORIGIN');

    const nullOrigin = await raw(
      `GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:${port()}\r\nOrigin: null\r\nConnection: close\r\n\r\n`,
    );
    expect(nullOrigin).toContain('403');

    const same = await raw(
      `GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:${port()}\r\nOrigin: ${base}\r\nConnection: close\r\n\r\n`,
    );
    expect(same).toContain('200');

    const noOrigin = await fetch(base + '/api/health');
    expect(noOrigin.status).toBe(200);
  });

  it('non-loopback Host with matching Origin is still rejected (Host must name bind address)', async () => {
    const rebinding = await raw(
      `GET /api/health HTTP/1.1\r\nHost: evil.example:${port()}\r\nOrigin: http://evil.example:${port()}\r\nConnection: close\r\n\r\n`,
    );
    expect(rebinding).toContain('403');
    expect(rebinding).toContain('E_HOST');
    expect(rebinding).not.toContain('evil.example'); // no origin/host echo
  });

  it('request body over 64 KiB gets 413', async () => {
    const res = await fetch(base + '/api/session/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Picbed-UI': '1' },
      body: 'a'.repeat(64 * 1024 + 1),
    });
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe('E_BODY_TOO_LARGE');
  });

  it('HTTP/1.0 request without Host gets 400 (no silent fallback base)', async () => {
    const res = await raw('GET /api/health HTTP/1.0\r\n\r\n');
    expect(res).toContain('400');
    expect(res).toContain('E_USAGE');
  });

  it('CORS preflight gets no special handling (no Access-Control headers)', async () => {
    // Refined design: cross-origin preflight hits the Origin guard first (403);
    // same-origin OPTIONS falls through to the unknown-route 404.
    const cross = await raw(
      `OPTIONS /api/sync HTTP/1.1\r\nHost: 127.0.0.1:${port()}\r\nOrigin: http://evil.example\r\nAccess-Control-Request-Method: POST\r\nConnection: close\r\n\r\n`,
    );
    expect(cross).toContain('403');
    expect(cross).toContain('E_ORIGIN');
    expect(cross).not.toContain('Access-Control-Allow-Origin');

    const same = await raw(
      `OPTIONS /api/sync HTTP/1.1\r\nHost: 127.0.0.1:${port()}\r\nOrigin: ${base}\r\nAccess-Control-Request-Method: POST\r\nConnection: close\r\n\r\n`,
    );
    expect(same).toContain('404');
    expect(same).not.toContain('Access-Control-Allow-Origin');
  });

  it('static assets are not subject to the /api guards', async () => {
    const res = await fetch(base + '/styles.css');
    expect(res.status).toBe(200);
  });
});
