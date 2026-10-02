import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RootBinder } from '../src/ui/root.js';
import { createUiServer, type UiServerHandle } from '../src/ui/server.js';
import { SPA_CSS } from '../src/ui/spa/styles.js';
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
