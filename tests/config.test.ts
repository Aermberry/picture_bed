import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, normalizeGithubRef, parseSimpleToml } from '../src/config.js';
import { importConfigToml, serializeConfigToml } from '../src/app/config.js';

describe('normalizeGithubRef', () => {
  it('keeps a bare owner/repo unchanged', () => {
    expect(normalizeGithubRef('Aermberry', 'picture_bed')).toEqual({
      owner: 'Aermberry',
      repo: 'picture_bed',
    });
  });

  it('extracts owner/repo from an https URL in the repo field', () => {
    expect(
      normalizeGithubRef('', 'https://github.com/Aermberry/FigureBedBySalmon'),
    ).toEqual({ owner: 'Aermberry', repo: 'FigureBedBySalmon' });
  });

  it('strips a .git suffix and trailing slash', () => {
    expect(
      normalizeGithubRef('', 'https://github.com/Aermberry/picture_bed.git/'),
    ).toEqual({ owner: 'Aermberry', repo: 'picture_bed' });
  });

  it('parses the scp-style ssh form', () => {
    expect(normalizeGithubRef('', 'git@github.com:Aermberry/picture_bed.git')).toEqual({
      owner: 'Aermberry',
      repo: 'picture_bed',
    });
  });

  it('parses an owner/repo slug', () => {
    expect(normalizeGithubRef('', 'Aermberry/picture_bed')).toEqual({
      owner: 'Aermberry',
      repo: 'picture_bed',
    });
  });

  it('a parsed URL owner wins over a stale owner field', () => {
    expect(
      normalizeGithubRef('WrongOwner', 'https://github.com/Aermberry/picture_bed'),
    ).toEqual({ owner: 'Aermberry', repo: 'picture_bed' });
  });

  it('keeps a separate owner field when repo is a bare name', () => {
    expect(normalizeGithubRef('Aermberry', 'picture_bed')).toEqual({
      owner: 'Aermberry',
      repo: 'picture_bed',
    });
  });

  it('sanitizes a URL accidentally placed in the owner field', () => {
    expect(normalizeGithubRef('https://github.com/Aermberry', 'picture_bed')).toEqual({
      owner: 'Aermberry',
      repo: 'picture_bed',
    });
  });

  it('tolerates empty input', () => {
    expect(normalizeGithubRef('', '')).toEqual({ owner: '', repo: '' });
  });
});

describe('loadConfig normalizes github.repo', () => {
  const prev = { ...process.env };
  afterEach(() => {
    process.env.PICBED_GITHUB_OWNER = prev.PICBED_GITHUB_OWNER;
    process.env.PICBED_GITHUB_REPO = prev.PICBED_GITHUB_REPO;
  });

  it('reduces an env-provided repo URL to owner/repo', () => {
    process.env.PICBED_GITHUB_OWNER = 'Aermberry';
    process.env.PICBED_GITHUB_REPO = 'https://github.com/Aermberry/FigureBedBySalmon';
    const cfg = loadConfig({ cwd: process.cwd(), configPath: 'nonexistent.toml' });
    expect(cfg.github.owner).toBe('Aermberry');
    expect(cfg.github.repo).toBe('FigureBedBySalmon');
  });
});

function baseCfg() {
  return loadConfig({ cwd: process.cwd(), configPath: 'nonexistent.toml' });
}

describe('serializeConfigToml', () => {
  it('round-trips through parseSimpleToml', () => {
    const cfg = baseCfg();
    const text = serializeConfigToml(cfg);
    const parsed = parseSimpleToml(text);
    expect(parsed.github?.repo).toBe(cfg.github.repo);
    expect(parsed.github?.owner).toBe(cfg.github.owner);
    expect(parsed.url?.style).toBe(cfg.url.style);
    expect(parsed.upload?.concurrency).toBe(String(cfg.upload.concurrency));
    expect(parsed.rewrite?.backup).toBe(String(cfg.rewrite.backup));
  });

  it('never emits a token field', () => {
    const text = serializeConfigToml(baseCfg());
    expect(text).not.toMatch(/token/i);
  });

  it('escapes quotes in values', () => {
    const cfg = baseCfg();
    cfg.github.repo = 'we"ird';
    const parsed = parseSimpleToml(serializeConfigToml(cfg));
    expect(parsed.github?.repo).toBe('we"ird');
  });
});

describe('importConfigToml', () => {
  it('dryRun does not write the file and returns merged config', () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'picbed-')), 'picbed.toml');
    const cfg = { ...baseCfg(), configPath: tmp };
    const out = importConfigToml(
      cfg,
      '[github]\nowner = "Aermberry"\nrepo = "https://github.com/Aermberry/picture_bed"\n',
      true,
    );
    expect(out.dryRun).toBe(true);
    expect(fs.existsSync(tmp)).toBe(false);
    expect(out.config.github.repo).toBe('picture_bed');
    expect(out.config.github.owner).toBe('Aermberry');
  });

  it('writes the file when not dryRun', () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'picbed-')), 'picbed.toml');
    const cfg = { ...baseCfg(), configPath: tmp };
    importConfigToml(cfg, '[github]\nrepo = "Aermberry/picture_bed"\n', false);
    expect(fs.existsSync(tmp)).toBe(true);
    const parsed = parseSimpleToml(fs.readFileSync(tmp, 'utf8'));
    expect(parsed.github?.repo).toBe('picture_bed');
  });

  it('rejects a bad url.style', () => {
    const cfg = baseCfg();
    expect(() => importConfigToml(cfg, '[url]\nstyle = "bogus"\n', true)).toThrow(/url\.style/);
  });

  it('rejects a bad host.type', () => {
    const cfg = baseCfg();
    expect(() => importConfigToml(cfg, '[host]\ntype = "ftp"\n', true)).toThrow(/host\.type/);
  });

  it('rejects a non-positive concurrency', () => {
    const cfg = baseCfg();
    expect(() => importConfigToml(cfg, '[upload]\nconcurrency = 0\n', true)).toThrow(/concurrency/);
  });
});
