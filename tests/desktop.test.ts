import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INDEX_HTML } from '../src/ui/static.js';
import { SPA_CSS } from '../src/ui/spa/styles.js';
import { detectUiDevMode } from '../src/ui/server.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spaApp = fs.readFileSync(path.join(repoRoot, 'src/ui/spa/app.js'), 'utf8');

describe('F24 desktop shell', () => {
  it('ships desktop sources and builder config', () => {
    expect(fs.existsSync(path.join(repoRoot, 'desktop/main.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'desktop/preload.cjs'))).toBe(true);
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
    expect(spaApp).toContain('getPathForFile');
    expect(spaApp).toContain('picbedNative');
    // removed panels
    expect(INDEX_HTML).not.toContain('id="rootCard"');
    expect(INDEX_HTML).not.toContain('id="workset"');
    expect(INDEX_HTML).not.toContain('id="planBody"');
    expect(INDEX_HTML).not.toContain('id="scan"');
  });

  it('SPA is split out of the template into served modules', () => {
    expect(INDEX_HTML).toContain('href="/styles.css"');
    expect(INDEX_HTML).toContain('type="module" src="/app.js"');
    expect(INDEX_HTML).not.toContain('collectDropItems'); // logic lives in app.ts, not markup
    expect(spaApp).toContain('collectDropItems');
    expect(SPA_CSS).toContain('Design Tokens');
    expect(SPA_CSS).not.toContain('`');
  });

  it('drop renders local blob previews before awaiting the server', () => {
    const handler = spaApp.slice(spaApp.indexOf('dz.addEventListener("drop"'));
    expect(handler).not.toBe('');
    const collect = handler.indexOf('collectDropItems(e.dataTransfer)');
    const render = handler.indexOf('setPreviewImages(blobPreviews)');
    const submit = handler.indexOf('await submitDrop(items)');
    expect(collect).toBeGreaterThan(-1);
    expect(render).toBeGreaterThan(collect);
    expect(submit).toBeGreaterThan(render);
  });

  it('server previewPath already covered by a dropped blob (same abs) is skipped', () => {
    expect(spaApp).toContain('b.abs && b.abs === p');
  });

  it('drop accepts only images/docs and preview never walks the scan root', () => {
    expect(spaApp).toContain('isAcceptedDrop');
    expect(spaApp).toContain('仅支持图片或文档');
    expect(spaApp).not.toContain('api/session/images');
    expect(spaApp).toContain('dropDocs');
    expect(spaApp).toContain('docSet');
  });

  it('served scripts are syntactically valid (app.ts stays plain JS; inline scripts stay tiny)', () => {
    expect(() => new Function(spaApp)).not.toThrow();
    const scripts = [...INDEX_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) {
      expect(s.length).toBeLessThan(200);
      expect(() => new Function(s)).not.toThrow();
    }
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
