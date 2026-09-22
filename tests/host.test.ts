import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createHostAdapter, hostRequiresToken, LocalHostAdapter } from '../src/host/index.js';
import { uploadAsset } from '../src/host/github.js';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'picbed-host-'));
}

describe('F13 HostAdapter factory', () => {
  it('creates local host without token and keeps AC7 upload/URL semantics', async () => {
    const root = tmp();
    const hostRoot = path.join(root, 'bed');
    const cfg = loadConfig({ cwd: root });
    cfg.host = { type: 'local' };
    cfg.local = {
      root: hostRoot,
      publicBase: 'https://img.example.com',
      dir: 'img',
    };
    cfg.url = { style: 'raw' };
    cfg.rootDir = root;

    expect(hostRequiresToken(cfg)).toBe(false);
    const host = createHostAdapter(cfg);
    expect(host.type).toBe('local');
    expect(host).toBeInstanceOf(LocalHostAdapter);

    const bytes = Buffer.from('png-bytes');
    const sha256 = 'a'.repeat(64);
    const remote = await uploadAsset(host, {
      asset: { localPath: path.join(root, 'pic.png'), sha256 },
      bytes,
      cfg,
      now: new Date('2026-09-22T00:00:00Z'),
    });

    expect(remote.sha256).toBe(sha256);
    expect(remote.publicUrl).toContain('https://img.example.com/img/2026/09/');
    expect(remote.rawUrl).toBe(remote.publicUrl);
    expect(await host.exists(remote.repoPath)).toBe(true);
    const written = fs.readFileSync(path.join(hostRoot, remote.repoPath));
    expect(written.equals(bytes)).toBe(true);
  });

  it('resolves local.root relative to rootDir not process.cwd', async () => {
    const root = tmp();
    const cfg = loadConfig({ cwd: root });
    cfg.host = { type: 'local' };
    cfg.local = { root: 'bed', publicBase: 'https://img.example.com', dir: 'img' };
    cfg.url = { style: 'raw' };
    cfg.rootDir = root;
    const host = createHostAdapter(cfg);
    const remote = await uploadAsset(host, {
      asset: { localPath: path.join(root, 'x.png'), sha256: 'b'.repeat(64) },
      bytes: Buffer.from('x'),
      cfg,
      now: new Date('2026-09-22T00:00:00Z'),
    });
    expect(fs.existsSync(path.join(root, 'bed', remote.repoPath))).toBe(true);
  });

  it('requires token for github host and rejects unknown type', () => {
    const root = tmp();
    const cfg = loadConfig({ cwd: root });
    expect(hostRequiresToken(cfg)).toBe(true);
    expect(() => createHostAdapter(cfg)).toThrow(/missing token/);
    cfg.host = { type: 'github' as never };
    (cfg.host as { type: string }).type = 's3';
    expect(() => createHostAdapter(cfg, 'tok')).toThrow(/unknown host/);
  });

  it('github composeUrls still match raw/jsdelivr styles', () => {
    const root = tmp();
    const cfg = loadConfig({
      cwd: root,
      overrides: {
        github: { owner: 'o', repo: 'r', branch: 'main', dir: 'img' },
        url: { style: 'jsdelivr' },
      },
    });
    const host = createHostAdapter(cfg, 'tok');
    const urls = host.composeUrls('img/a.png');
    expect(urls.rawUrl).toBe('https://raw.githubusercontent.com/o/r/main/img/a.png');
    expect(urls.publicUrl).toBe('https://cdn.jsdelivr.net/gh/o/r@main/img/a.png');
  });
});
