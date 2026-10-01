import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { AppError } from '../src/app/errors.js';
import { createRepoDir, normalizeRepoDirPath, parentDirPath } from '../src/app/repo-dir.js';
import type { ResolvedConfig } from '../src/types.js';

const TOKEN = 'ghp_' + 'x'.repeat(20);

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'picbed-repo-dir-'));
}

/** Config with a github repo; `token` flows in through getToken like the UI/CLI do. */
function cfgWith(over: { owner?: string; repo?: string } = {}): ResolvedConfig {
  const cfg = loadConfig({ cwd: tmp() });
  cfg.github = {
    owner: over.owner ?? 'me',
    repo: over.repo ?? 'bed',
    branch: 'main',
    dir: 'img',
  };
  return cfg;
}

interface FetchCall {
  method: string;
  url: string;
  body?: Record<string, unknown>;
}

/** Stub the Contents API: entries map repoPath → 'dir' | 'file' (absent → 404). */
function stubContents(
  entries: Record<string, 'dir' | 'file'>,
  opts: { putStatus?: number } = {},
): FetchCall[] {
  const calls: FetchCall[] = [];
  const respond = (status: number, body: unknown) =>
    ({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as unknown as Response;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown, init: { method?: string; body?: string } = {}) => {
      const url = String(input);
      const method = init.method || 'GET';
      if (method === 'PUT') {
        calls.push({ method, url, body: JSON.parse(init.body || '{}') });
        return respond(opts.putStatus ?? 200, { content: { name: '.gitkeep' } });
      }
      calls.push({ method, url });
      const m = /\/contents\/([^?]+)/.exec(url);
      const repoPath = decodeURIComponent(m ? m[1] : '');
      const kind = entries[repoPath];
      if (!kind) return respond(404, { message: 'Not Found' });
      return respond(200, kind === 'dir' ? [{ name: 'a.png', type: 'file' }] : { name: 'a.png', type: 'file' });
    }),
  );
  return calls;
}

async function expectCode(p: Promise<unknown>, code: string): Promise<AppError> {
  const err = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
  return err as AppError;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('F20.1 remote directory creation (app layer)', () => {
  it('normalizes remote dir paths and rejects traversal', () => {
    expect(normalizeRepoDirPath('')).toBe('');
    expect(normalizeRepoDirPath('/img/2026/')).toBe('img/2026');
    expect(normalizeRepoDirPath(' img/10 ')).toBe('img/10');
    expect(normalizeRepoDirPath('中文目录')).toBe('中文目录');
    expect(() => normalizeRepoDirPath('../etc')).toThrow(/不允许/);
    expect(() => normalizeRepoDirPath('a//b')).toThrow(/空层级/);
    expect(() => normalizeRepoDirPath('a\\b')).toThrow(/反斜杠/);
    expect(() => normalizeRepoDirPath('a/b\0')).toThrow(/非法字符/);
    expect(parentDirPath('img/2026/10')).toBe('img/2026');
    expect(parentDirPath('img')).toBe('');
    expect(parentDirPath('')).toBe(null);
  });

  it('commits an empty .gitkeep placeholder to create the directory', async () => {
    const calls = stubContents({ img: 'dir' });
    const out = await createRepoDir({
      cfg: cfgWith(),
      getToken: () => TOKEN,
      path: 'img/2026',
      confirm: true,
    });
    expect(out).toEqual({ path: 'img/2026', placeholder: '.gitkeep', created: true });
    const put = calls.find((c) => c.method === 'PUT');
    expect(put).toBeTruthy();
    expect(put?.url).toContain('/contents/img/2026/.gitkeep');
    expect(put?.body?.content).toBe('');
    expect(put?.body?.branch).toBe('main');
    // token never travels in the payload; only the Authorization header carries it
    expect(JSON.stringify(calls)).not.toContain(TOKEN);
  });

  it('is idempotent: an existing directory returns created:false without a commit', async () => {
    const calls = stubContents({ img: 'dir', 'img/2026': 'dir' });
    const out = await createRepoDir({
      cfg: cfgWith(),
      getToken: () => TOKEN,
      path: 'img/2026',
      confirm: true,
    });
    expect(out.created).toBe(false);
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('refuses to overwrite a same-named file (E_CONFLICT)', async () => {
    stubContents({ img: 'dir', 'img/2026': 'file' });
    await expectCode(
      createRepoDir({ cfg: cfgWith(), getToken: () => TOKEN, path: 'img/2026', confirm: true }),
      'E_CONFLICT',
    );
  });

  it('reports a missing parent directory (E_NOT_FOUND)', async () => {
    stubContents({});
    await expectCode(
      createRepoDir({ cfg: cfgWith(), getToken: () => TOKEN, path: 'img/2026', confirm: true }),
      'E_NOT_FOUND',
    );
  });

  it('requires confirm, credentials and a non-empty name', async () => {
    stubContents({});
    await expectCode(
      createRepoDir({ cfg: cfgWith(), getToken: () => TOKEN, path: 'img/x', confirm: false }),
      'E_CONFIRM',
    );
    await expectCode(
      createRepoDir({ cfg: cfgWith({ owner: '' }), getToken: () => TOKEN, path: 'img/x', confirm: true }),
      'E_CONFIG',
    );
    const noTok = await expectCode(
      createRepoDir({ cfg: cfgWith(), getToken: () => undefined, path: 'img/x', confirm: true }),
      'E_TOKEN',
    );
    expect(noTok.hint).toBeTruthy();
    await expectCode(
      createRepoDir({ cfg: cfgWith(), getToken: () => TOKEN, path: '  ', confirm: true }),
      'E_BAD_REQUEST',
    );
  });

  it('surfaces remote failures as E_REMOTE without leaking the token', async () => {
    stubContents({ img: 'dir' }, { putStatus: 500 });
    const err = await expectCode(
      createRepoDir({ cfg: cfgWith(), getToken: () => TOKEN, path: 'img/2026', confirm: true }),
      'E_REMOTE',
    );
    expect(err.message).not.toContain(TOKEN);
  });
});
