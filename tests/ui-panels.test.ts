import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUiServer, type UiServerHandle } from '../src/ui/server.js';
import { loadConfig } from '../src/config.js';
import { runSync } from '../src/app/sync.js';
import { maskToken } from '../src/lib/mask.js';

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
      headers: { 'Content-Type': 'application/json', 'X-Picbed-UI': '1' },
      body: JSON.stringify({ root: path.join(cwd, 'docs') }),
    });
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

  it('token paste login writes user store and never echoes the PAT', async () => {
    const cred = path.join(cwd, 'user-cred.json');
    const prev = process.env.PICBED_USER_TOKEN_PATH;
    process.env.PICBED_USER_TOKEN_PATH = cred;
    try {
      const denied = await api('/api/auth/token', { token: 'ghp_secret_value_x' });
      expect(denied.status).toBe(409);

      const saved = await api('/api/auth/token', {
        token: 'ghp_secret_value_x',
        confirm: true,
      });
      expect(saved.data.ok).toBe(true);
      // 掩码走唯一实现（src/lib/mask.ts），与 doctor / 配置视图表现一致
      expect(saved.data.data.tokenMask).toBe(maskToken('ghp_secret_value_x'));
      expect(JSON.stringify(saved.data)).not.toContain('ghp_secret_value_x');
      expect(fs.existsSync(cred)).toBe(true);

      const cfg = await api('/api/config');
      const masked = String(cfg.data.data.token ?? '');
      expect(masked === '' || /\*{4}/.test(masked)).toBe(true);
      expect(JSON.stringify(cfg.data)).not.toContain('ghp_secret_value_x');

      const cleared = await api('/api/auth/token', { clear: true, confirm: true });
      expect(cleared.data.ok).toBe(true);
      expect(fs.existsSync(cred)).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.PICBED_USER_TOKEN_PATH;
      else process.env.PICBED_USER_TOKEN_PATH = prev;
    }
  });

  it('F21 records runs after sync and lists them', async () => {
    const cfg = loadConfig({ cwd });
    const result = await runSync({
      root: path.join(cwd, 'docs'),
      cfg,
      cwd,
      getToken: () => undefined,
      command: 'api.sync',
    });
    expect(result.ok).toBe(true);
    const runs = await api('/api/runs');
    expect(runs.data.data.runs.length).toBeGreaterThan(0);
    const id = runs.data.data.runs[0].id;
    const one = await api('/api/runs/' + id);
    expect(one.data.ok).toBe(true);
    expect(one.data.data.command).toContain('api.');
  });

  it('F23 /api/manifest dedupes by sha256 so one image shows one card', async () => {
    // 存储是引用级（上传缓存 1 条 + 每处文档引用 1 条，revert/skip-cache 依赖其主键），不能改存储；
    // 管理页唯一消费方是 /api/manifest，视图层按 sha256 去重后一张图只出一张卡。
    const disk = JSON.parse(fs.readFileSync(path.join(cwd, '.picbed', 'manifest.json'), 'utf8')) as {
      entries: { sha256: string }[];
    };
    const shas = new Set(disk.entries.map((e) => e.sha256));
    expect(disk.entries.length).toBeGreaterThanOrEqual(shas.size);
    const res = await api('/api/manifest');
    expect(res.data.ok).toBe(true);
    expect(res.data.data.entries.length).toBe(shas.size);
  });

  it('F23 already-remote references are not listed as uploaded images', async () => {
    // 已托管外链引用（无本地文件、无 sha256、从未上传到图床）仍按引用级留在存储（revert 语义），
    // 但不得进入「已上传图片库」视图——否则会出现图库里不存在的图 + 指向外部占位的假外链卡。
    const post = path.join(cwd, 'docs', 'post.md');
    fs.appendFileSync(post, '\n![remote](https://example.com/already-hosted.png)\n');
    const cfg = loadConfig({ cwd });
    const synced = await runSync({
      root: path.join(cwd, 'docs'),
      cfg,
      cwd,
      getToken: () => undefined,
      command: 'api.sync',
    });
    expect(synced.ok).toBe(true);
    const disk = JSON.parse(fs.readFileSync(path.join(cwd, '.picbed', 'manifest.json'), 'utf8')) as {
      entries: { sha256: string }[];
    };
    expect(disk.entries.some((e) => !e.sha256 && !e.localPath)).toBe(true); // 存储仍保留该引用
    const res = await api('/api/manifest');
    expect(res.data.ok).toBe(true);
    expect(res.data.data.entries.every((e: { sha256: string }) => e.sha256)).toBe(true);
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

  it('F25 delete removes remote asset, cleans manifest, reverts doc', async () => {
    // 复 sync 让 post.md 回到外链态、远端文件就位，以便完整验证「删远端+清 manifest+回写文档」
    const cfg = loadConfig({ cwd });
    await runSync({
      root: path.join(cwd, 'docs'),
      cfg,
      cwd,
      getToken: () => undefined,
      command: 'api.sync',
    });
    const disk = JSON.parse(fs.readFileSync(path.join(cwd, '.picbed', 'manifest.json'), 'utf8')) as {
      entries: { sha256: string; publicUrl: string }[];
    };
    const entry = disk.entries.find((e) => e.sha256);
    if (!entry) throw new Error('no sha in manifest');
    const sha = entry.sha256;

    // dryRun：只列计划，不触远端/不写盘
    const dry = await api('/api/delete', { sha256: sha, dryRun: true });
    expect(dry.data.ok).toBe(true);
    expect(dry.data.data.planned.length).toBeGreaterThan(0);
    expect(dry.data.data.remotePath).toBeTruthy();

    // 缺 confirm 必须被拦
    const denied = await api('/api/delete', { sha256: sha });
    expect(denied.status).toBe(409);

    // 真删
    const del = await api('/api/delete', { sha256: sha, confirm: true });
    expect(del.data.ok).toBe(true);
    expect(del.data.data.deletedRemote).toBe(true);
    expect(del.data.data.remotePath).toBeTruthy();

    // 远端文件已删（local host：bed 下该文件不存在）
    const bedFile = path.join(cwd, 'bed', del.data.data.remotePath);
    expect(fs.existsSync(bedFile)).toBe(false);

    // manifest 已清该 sha 的全部条目
    const after = JSON.parse(fs.readFileSync(path.join(cwd, '.picbed', 'manifest.json'), 'utf8')) as {
      entries: { sha256: string }[];
    };
    expect(after.entries.some((e) => e.sha256 === sha)).toBe(false);

    // 文档引用已还原回本地路径
    expect(fs.readFileSync(path.join(cwd, 'docs', 'post.md'), 'utf8')).toContain('img/a.png');
    expect(fs.readFileSync(path.join(cwd, 'docs', 'post.md'), 'utf8')).not.toContain('cdn.example.test');
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

  it('console drops F19–F22 panels (revert/audit/watch removed from UI)', async () => {
    const html = await (await fetch(base + '/')).text();
    expect(html).not.toContain('回滚');
    expect(html).not.toContain('审计 run');
    expect(html).not.toContain('watch（F22）');
    expect(html).not.toContain('上传偏好');
    expect(html).not.toContain('自检 doctor');
    expect(html).toContain('外链调用');
    expect(html).toContain('fileGrid');
  });
});
