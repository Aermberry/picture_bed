import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../src/cli.js';
import { EXIT } from '../src/types.js';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'picbed-cli-'));
}

/** Local host repo: no token, writes land under <root>/bed. */
function localRepo(): string {
  const root = tmp();
  fs.writeFileSync(
    path.join(root, 'picbed.toml'),
    `[host]
type = "local"

[local]
root = "bed"
public_base = "https://img.example.com"
dir = "img"

[url]
style = "raw"
`,
  );
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'a.png'), Buffer.from([1, 2, 3]));
  fs.writeFileSync(path.join(root, 'docs', 'note.md'), '![a](./a.png)\n');
  return root;
}

async function runJson(args: string[]): Promise<{ code: number; payload: any }> {
  const out: string[] = [];
  const outSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(((chunk: unknown) => {
      out.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);
  const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  try {
    const code = await run(['node', 'picbed', ...args]);
    return { code, payload: JSON.parse(out.join('')) };
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
  }
}

describe('CLI -> app layer', () => {
  it('sync refuses to write without --yes', async () => {
    const root = localRepo();
    const { code, payload } = await runJson(['sync', 'docs', '--json', '--cwd', root]);
    expect(code).toBe(EXIT.CONFIRM);
    expect(payload.error.code).toBe('E_CONFIRM');
    expect(fs.readFileSync(path.join(root, 'docs', 'note.md'), 'utf8')).toContain('./a.png');
  });

  it('sync --dry-run reports the plan without writing', async () => {
    const root = localRepo();
    const { code, payload } = await runJson(['sync', 'docs', '--json', '--dry-run', '--cwd', root]);
    expect(code).toBe(EXIT.OK);
    expect(payload.data.summary.upload).toBe(1);
    expect(payload.data.plan[0].localPath).toContain('a.png');
    expect(fs.readFileSync(path.join(root, 'docs', 'note.md'), 'utf8')).toContain('./a.png');
    expect(fs.existsSync(path.join(root, '.picbed', 'manifest.json'))).toBe(false);
  });

  it('sync --yes uploads, rewrites docs and records a run', async () => {
    const root = localRepo();
    const { code, payload } = await runJson(['sync', 'docs', '--json', '--yes', '--cwd', root]);
    expect(code).toBe(EXIT.OK);
    expect(payload.data.uploaded).toBe(1);
    expect(payload.data.rewrittenDocs).toEqual(['docs/note.md']);
    expect(fs.readFileSync(path.join(root, 'docs', 'note.md'), 'utf8')).toContain(
      'https://img.example.com/img/',
    );

    const runs = fs.readdirSync(path.join(root, '.picbed', 'runs'));
    expect(runs.length).toBe(1);
    const record = JSON.parse(
      fs.readFileSync(path.join(root, '.picbed', 'runs', runs[0]), 'utf8'),
    ) as { command: string; ok: boolean; counts: Record<string, number>; errorCode?: string };
    expect(record.command).toBe('sync');
    expect(record.ok).toBe(true);
    expect(record.errorCode).toBeUndefined();
    expect(record.counts.uploaded).toBe(1);
    expect(record.counts.rewritten).toBe(1);
  });

  it('revert gates on --yes, dry-run lists planned docs, revert restores local refs', async () => {
    const root = localRepo();
    await runJson(['sync', 'docs', '--json', '--yes', '--cwd', root]);
    const remoteLine = fs.readFileSync(path.join(root, 'docs', 'note.md'), 'utf8');
    expect(remoteLine).toContain('https://img.example.com/img/');

    const refused = await runJson(['revert', 'docs', '--json', '--cwd', root]);
    expect(refused.code).toBe(EXIT.CONFIRM);
    expect(refused.payload.error.code).toBe('E_CONFIRM');

    const dry = await runJson(['revert', 'docs', '--json', '--dry-run', '--cwd', root]);
    expect(dry.code).toBe(EXIT.OK);
    expect(dry.payload.data.planned).toEqual(['docs/note.md']);
    expect(fs.readFileSync(path.join(root, 'docs', 'note.md'), 'utf8')).toBe(remoteLine);

    const done = await runJson(['revert', 'docs', '--json', '--yes', '--cwd', root]);
    expect(done.code).toBe(EXIT.OK);
    expect(done.payload.data.rewritten).toEqual(['docs/note.md']);
    expect(fs.readFileSync(path.join(root, 'docs', 'note.md'), 'utf8')).toContain('./a.png');
  });

  it('revert surfaces a corrupt manifest as E_MANIFEST_CORRUPT (exit 4)', async () => {
    const root = localRepo();
    fs.mkdirSync(path.join(root, '.picbed'), { recursive: true });
    fs.writeFileSync(path.join(root, '.picbed', 'manifest.json'), '{"version":2,"entries":[]}');
    const { code, payload } = await runJson([
      'revert',
      'docs',
      '--json',
      '--dry-run',
      '--cwd',
      root,
    ]);
    expect(code).toBe(EXIT.LOCAL);
    expect(payload.error.code).toBe('E_MANIFEST_CORRUPT');
  });

  it('github host without owner/repo fails as E_CONFIG before uploading', async () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, 'picbed.toml'), '[host]\ntype = "github"\n\n[github]\nowner = ""\nrepo = ""\n');
    fs.mkdirSync(path.join(root, 'docs'));
    fs.writeFileSync(path.join(root, 'docs', 'a.png'), Buffer.from([1, 2, 3]));
    fs.writeFileSync(path.join(root, 'docs', 'note.md'), '![a](./a.png)\n');

    const prev = process.env.PICBED_GITHUB_TOKEN;
    process.env.PICBED_GITHUB_TOKEN = 'dummy-token';
    try {
      const { code, payload } = await runJson(['sync', 'docs', '--json', '--yes', '--cwd', root]);
      expect(code).toBe(EXIT.CONFIG);
      expect(payload.error.code).toBe('E_CONFIG');
    } finally {
      if (prev === undefined) delete process.env.PICBED_GITHUB_TOKEN;
      else process.env.PICBED_GITHUB_TOKEN = prev;
    }
  });

  it('config get/set share the app-layer validation', async () => {
    const root = localRepo();
    const bad = await runJson([
      'config',
      'set',
      'url.style',
      'nope',
      '--json',
      '--yes',
      '--cwd',
      root,
    ]);
    expect(bad.code).toBe(EXIT.USAGE);
    expect(bad.payload.error.code).toBe('E_STYLE');

    const ok = await runJson([
      'config',
      'set',
      'url.style',
      'jsdelivr',
      '--json',
      '--yes',
      '--cwd',
      root,
    ]);
    expect(ok.code).toBe(EXIT.OK);
    expect(ok.payload.data.key).toBe('url.style');

    const got = await runJson(['config', 'get', 'url.style', '--json', '--cwd', root]);
    expect(got.payload.data).toBe('jsdelivr');
  });
});
