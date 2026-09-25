import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RootBinder } from '../src/ui/root.js';
import { createUiServer, type UiServerHandle } from '../src/ui/server.js';
import { loadConfig } from '../src/config.js';
import { runSync } from '../src/ui/ops.js';

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
      headers: { 'Content-Type': 'application/json' },
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

  it('serves console HTML', async () => {
    const res = await fetch(base + '/');
    const html = await res.text();
    expect(html).toContain('picbed 本地控制台');
    expect(html).toContain('拖拽');
  });

  it('F23 shell: four nav views, theme tokens, logo and dropzone', async () => {
    const html = await (await fetch(base + '/')).text();
    for (const label of ['上传', '管理', '设置', '规范']) {
      expect(html).toContain('>' + label + '</button>');
    }
    expect(html).toContain('#4E86AD');
    expect(html).toContain('#E39A6B');
    expect(html).toContain('#F3F7FA');
    expect(html).toContain('dropzone');
    expect(html).toContain('g-scan');
    expect(html).toContain('g-up');
    expect(html).toContain('文件放置');
  });
});
