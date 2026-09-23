import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUiServer, type UiServerHandle } from '../src/ui/server.js';
import { loadConfig } from '../src/config.js';
import { runSync } from '../src/ui/ops.js';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'picbed-ui2-'));
}

describe('ui F19–F22', () => {
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
    fs.writeFileSync(path.join(cwd, 'docs', 'img', 'a.png'), Buffer.from([9, 9, 9]));
    fs.writeFileSync(path.join(cwd, 'docs', 'post.md'), '![a](img/a.png)\n');
    const ui = createUiServer({ cwd });
    handle = await ui.listen(0, '127.0.0.1');
    base = handle.url;
    await fetch(base + '/api/session/bind-root', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: path.join(cwd, 'docs') }),
    });
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

  it('F20 doctor works for local host and config is masked', async () => {
    const doc = await api('/api/doctor', {});
    expect(doc.data.ok).toBe(true);
    const cfg = await api('/api/config');
    const masked = String(cfg.data.data.token ?? '');
    // 无 token 时为空串；有 token 时必须掩码（不得回显原文）
    expect(masked === '' || /\*{4}/.test(masked)).toBe(true);
    const raw = JSON.stringify(cfg.data);
    expect(raw).not.toMatch(/ghp_[A-Za-z0-9]{10,}/);
    expect(raw).not.toMatch(/gho_[A-Za-z0-9]{10,}/);
  });

  it('F20 config set requires confirm', async () => {
    const denied = await api('/api/config', { key: 'github.branch', value: 'main' });
    expect(denied.status).toBe(409);
    const ok = await api('/api/config', {
      key: 'url.style',
      value: 'raw',
      confirm: true,
    });
    expect(ok.data.ok).toBe(true);
  });

  it('F21 records runs after sync and lists them', async () => {
    const cfg = loadConfig({ cwd });
    const result = await runSync({
      root: path.join(cwd, 'docs'),
      cfg,
      cwd,
      getToken: () => undefined,
    });
    expect(result.ok).toBe(true);
    const runs = await api('/api/runs');
    expect(runs.data.data.runs.length).toBeGreaterThan(0);
    const id = runs.data.data.runs[0].id;
    const one = await api('/api/runs/' + id);
    expect(one.data.ok).toBe(true);
    expect(one.data.data.command).toContain('api.');
  });

  it('F19 revert dry-run then revert restores local path', async () => {
    const before = fs.readFileSync(path.join(cwd, 'docs', 'post.md'), 'utf8');
    expect(before).toContain('https://cdn.example.test');
    const dry = await api('/api/revert', { dryRun: true, confirm: true });
    expect(dry.data.ok).toBe(true);
    expect(dry.data.data.planned.length).toBeGreaterThan(0);
    expect(fs.readFileSync(path.join(cwd, 'docs', 'post.md'), 'utf8')).toBe(before);

    const denied = await api('/api/revert', {});
    expect(denied.status).toBe(409);

    const done = await api('/api/revert', { confirm: true, dryRun: false });
    expect(done.data.ok).toBe(true);
    expect(fs.readFileSync(path.join(cwd, 'docs', 'post.md'), 'utf8')).toContain('img/a.png');
  });

  it('F22 watch preview default and stop', async () => {
    const started = await api('/api/watch/start', {});
    expect(started.data.ok).toBe(true);
    expect(started.data.data.mode).toBe('preview');
    expect(started.data.data.active).toBe(true);

    const autoDenied = await api('/api/watch/start', { mode: 'auto' });
    // may fail confirm or restart; if started without confirm that's a bug
    if (!autoDenied.data.ok) {
      expect(autoDenied.data.error.code).toBe('E_CONFIRM');
    } else {
      // if previous preview was replaced incorrectly — assert mode not auto without confirm
      expect(autoDenied.data.data.mode).not.toBe('auto');
    }

    const stopped = await api('/api/watch/stop', {});
    expect(stopped.data.data.active).toBe(false);
  });

  it('console includes F19–F22 panels', async () => {
    const html = await (await fetch(base + '/')).text();
    expect(html).toContain('回滚');
    expect(html).toContain('doctor');
    expect(html).toContain('watch');
    expect(html).toContain('审计');
  });
});
