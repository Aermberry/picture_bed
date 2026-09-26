import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INDEX_HTML } from '../src/ui/static.js';
import { detectUiDevMode } from '../src/ui/server.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('F24 desktop shell', () => {
  it('ships desktop sources and builder config', () => {
    expect(fs.existsSync(path.join(repoRoot, 'desktop/main.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'desktop/preload.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'desktop/icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'electron-builder.yml'))).toBe(true);
  });

  it('npm pack stays CLI-only (no desktop runtime in files whitelist)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      files: string[];
      devDependencies: Record<string, string>;
    };
    expect(pkg.files).toEqual(expect.arrayContaining(['bin', 'dist', 'README.md']));
    expect(pkg.files.join(' ')).not.toMatch(/desktop|electron|release/);
    expect(pkg.devDependencies.electron).toBeTruthy();
    expect(pkg.devDependencies['electron-builder']).toBeTruthy();
  });

  it('upload view is drop-only; native path bridge for drag-drop', () => {
    expect(INDEX_HTML).toContain('id="dropzone"');
    expect(INDEX_HTML).toContain('getPathForFile');
    expect(INDEX_HTML).toContain('picbedNative');
    // removed panels
    expect(INDEX_HTML).not.toContain('id="rootCard"');
    expect(INDEX_HTML).not.toContain('id="workset"');
    expect(INDEX_HTML).not.toContain('id="planBody"');
    expect(INDEX_HTML).not.toContain('id="scan"');
  });

  it('「规范」nav is hidden by default and gated on __PICBED_UI_DEV__', () => {
    expect(INDEX_HTML).toContain('id="navDoc"');
    expect(INDEX_HTML).toMatch(/id="navDoc"[^>]*\bhidden\b/);
    expect(INDEX_HTML).toContain('__PICBED_UI_DEV_FLAG__');
    expect(INDEX_HTML).toContain('__PICBED_UI_DEV__');
    // packaged installs must not reveal via source-only tree marker in HTML
    expect(INDEX_HTML).not.toContain('src/ui/static.ts');
  });

  it('detectUiDevMode: env override wins; source tree is dev; no src is not', () => {
    expect(detectUiDevMode(true)).toBe(true);
    expect(detectUiDevMode(false)).toBe(false);
    const prev = process.env.PICBED_UI_DEV;
    try {
      process.env.PICBED_UI_DEV = '1';
      expect(detectUiDevMode()).toBe(true);
      process.env.PICBED_UI_DEV = '0';
      expect(detectUiDevMode()).toBe(false);
      delete process.env.PICBED_UI_DEV;
      // repo checkout has src/ui/static.ts → local debug
      expect(detectUiDevMode()).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.PICBED_UI_DEV;
      else process.env.PICBED_UI_DEV = prev;
    }
  });

  it('desktop main forces PICBED_UI_DEV off when packaged', () => {
    const main = fs.readFileSync(path.join(repoRoot, 'desktop/main.mjs'), 'utf8');
    expect(main).toContain('app.isPackaged');
    expect(main).toContain('PICBED_UI_DEV');
  });

  it('desktop main hosts same createUiServer contract on loopback', () => {
    const main = fs.readFileSync(path.join(repoRoot, 'desktop/main.mjs'), 'utf8');
    expect(main).toContain('createUiServer');
    expect(main).toContain("listen(0, '127.0.0.1')");
    expect(main).toContain('dialog:selectDirectory');
    expect(main).toMatch(/contextIsolation:\s*true/);
    expect(main).toMatch(/nodeIntegration:\s*false/);
    // no token handling in the shell
    expect(main).not.toMatch(/GITHUB_TOKEN|PICBED_GITHUB_TOKEN/);
  });
});
