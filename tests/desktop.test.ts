import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INDEX_HTML } from '../src/ui/static.js';
import { SPA_CSS } from '../src/ui/spa/styles.js';
import { detectUiDevMode } from '../src/ui/server.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spaApp = fs.readFileSync(path.join(repoRoot, 'renderer', 'main.js'), 'utf8');

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

  it('SPA lives in renderer/ (Vite root) and is served as modules', () => {
    expect(INDEX_HTML).toContain('styles.css');
    expect(INDEX_HTML).toMatch(/src="\.\/main\.js"/);
    expect(INDEX_HTML).not.toContain('collectDropItems'); // logic lives in main.js, not markup
    expect(spaApp).toContain('collectDropItems');
    expect(SPA_CSS).toContain('Design Tokens');
    expect(SPA_CSS).not.toContain('`');
    expect(fs.existsSync(path.join(repoRoot, 'renderer', 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'renderer', 'styles.css'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'renderer', 'main.js'))).toBe(true);
  });

  it('drop renders local blob previews before awaiting the server', () => {
    const handler = spaApp.slice(spaApp.indexOf('dz.addEventListener("drop"'));
    expect(handler).not.toBe('');
    const collect = handler.indexOf('collectDropItems(e.dataTransfer)');
    const render = handler.indexOf('mergeWallItems(blobPreviews)');
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

  it('scan results render as a photo wall (masonry tiles + filename overlay)', () => {
    expect(INDEX_HTML).toContain('class="photo-wall"');
    expect(INDEX_HTML).toContain('id="previewGrid"');
    expect(INDEX_HTML).toContain('id="dropHero"');
    expect(INDEX_HTML).toContain('id="previewActions"');
    expect(SPA_CSS).toContain('.photo-wall');
    expect(SPA_CSS).toContain('.photo-wall .tile');
    expect(SPA_CSS).toContain('display:flex');
    expect(SPA_CSS).toContain('.photo-wall .pw-col');
    expect(SPA_CSS).toContain('.photo-wall .tile .name');
    expect(SPA_CSS).toContain('has-photos');
    expect(spaApp).toContain('class="tile"');
    expect(spaApp).toContain('has-photos');
    expect(spaApp).toContain('photoWallTitle');
  });

  it('photo wall follows shortest-column masonry with tight packing', () => {
    // flex columns, not CSS multi-column (which leaves height-balance holes)
    expect(SPA_CSS).toContain('display:flex');
    expect(SPA_CSS).toContain('.photo-wall .pw-col');
    expect(SPA_CSS).toContain('gap:6px');
    // JS packs each tile into the currently shortest column
    expect(spaApp).toContain('layoutPhotoWall');
    expect(spaApp).toContain('pw-col');
    expect(spaApp).toContain('offsetHeight');
    // restack on image load and resize
    expect(spaApp).toContain('addEventListener("load"');
    expect(spaApp).toContain('resize');
  });

  it('photo wall never accumulates empty columns (load must not shrink tiles)', () => {
    // old .pw-col wrappers are stripped before re-stack
    expect(spaApp).toContain('querySelectorAll(".pw-col")');
    expect(spaApp).toContain('removeChild(c)');
    // load/resize go through a debounced scheduler
    expect(spaApp).toContain('schedulePhotoWallLayout');
    expect(spaApp).toContain('layoutWallTimer');
  });

  it('photo wall action bar stays visible while scrolling (sticky)', () => {
    // sticky only when the wall is showing; idle head is not sticky / has no plate
    expect(SPA_CSS).toMatch(/\.dropzone\.has-photos \.dz-head\{[\s\S]*position:sticky/);
    expect(SPA_CSS).toMatch(/\.dropzone\.has-photos \.dz-head\{[\s\S]*top:0/);
    expect(SPA_CSS).toMatch(/\.dropzone\.has-photos \.dz-head\{[\s\S]*z-index:10|\.dropzone \.dz-head\{[\s\S]*z-index:10/);
    // plate only when photo wall is shown (idle title has no white bar)
    expect(SPA_CSS).toMatch(/\.dropzone\.has-photos \.dz-head::before/);
    expect(SPA_CSS).toMatch(/\.dropzone:not\(\.has-photos\) \.dz-head::before\{content:none\}/);
    expect(SPA_CSS).toMatch(/has-photos\{[\s\S]*padding-top:0/);
    // full-width plate + gradient fade to the dashed frame (no hard shadow)
    expect(SPA_CSS).toMatch(/margin-left:calc\(-1 \* var\(--sp-6\)\)/);
    expect(SPA_CSS).toContain('dz-head::after');
    expect(SPA_CSS).toContain('linear-gradient');
    const beforeRule = SPA_CSS.slice(
      SPA_CSS.indexOf('.dropzone.has-photos .dz-head::before{'),
      SPA_CSS.indexOf('.dropzone.has-photos .dz-head::after{'),
    );
    expect(beforeRule).not.toContain('box-shadow');
    // background fades with scroll but never reaches full transparency
    expect(SPA_CSS).toContain('--dz-head-alpha');
    expect(spaApp).toContain('updateWallBarFade');
    expect(spaApp).toContain('0.82');
    // quota meter is gone from the shell
    expect(INDEX_HTML).not.toContain('quota');
  });

  it('photo wall supports click-select batch delete of preview tiles', () => {
    // selection state + chrome
    expect(spaApp).toContain('selectedKeys');
    expect(spaApp).toContain('data-key');
    expect(spaApp).toContain('btnDelete');
    expect(spaApp).toContain('syncDeleteChrome');
    expect(INDEX_HTML).toContain('id="btnDelete"');
    // selected state is obvious but stays inside the tile (no overlap)
    expect(SPA_CSS).toContain('.photo-wall .tile.selected');
    expect(SPA_CSS).toContain('sel-tag');
    expect(SPA_CSS).toMatch(/tile\.selected::after/);
    expect(SPA_CSS).toMatch(/inset 0 0 0 3px/);
    expect(spaApp).toContain('已选');
    // outer ring / lift must not exist (they covered neighbours)
    const selRule = SPA_CSS.slice(
      SPA_CSS.indexOf('.photo-wall .tile.selected{'),
      SPA_CSS.indexOf('.photo-wall .tile.selected::after'),
    );
    expect(selRule).not.toContain('translateY');
    expect(selRule).not.toMatch(/box-shadow:\s*\n?\s*0 0 0/);
    // delete removes from wall + session workset
    expect(spaApp).toContain('api/session/remove');
    expect(spaApp).toContain('clearSelection');
  });

  it('photo wall has no hover zoom / neighbour shift (feature cancelled)', () => {
    // no tween engine or focus layout left in the SPA
    expect(spaApp).not.toContain('applyWallFocus');
    expect(spaApp).not.toContain('function dotween');
    expect(spaApp).not.toContain('function doscale');
    expect(spaApp).not.toContain('HOVER_SCALE');
    expect(spaApp).not.toContain('wallFocusPhase2');
    // tiles never get a JS transform
    expect(spaApp).not.toContain('style.transform');
    // hover keeps only the filename overlay + shadow
    expect(SPA_CSS).toContain('.photo-wall .tile:hover .name');
    expect(SPA_CSS).not.toMatch(/\.photo-wall \.tile:hover\{[^}]*transform/);
  });

  it('photo wall count matches tiles: doc drop is not previewed, failed loads update the headline', () => {
    // previewPath must be image-only (server + client)
    expect(spaApp).toContain('pp && isImageName(pp)');
    // headline comes from live tile count, not the raw path list
    expect(spaApp).toContain('$("dropTitle").textContent = photoWallTitle()');
    // failed image removes its tile and refreshes the count
    expect(spaApp).toContain('img.addEventListener("error"');
  });

  it('reset/upload actions appear only when the photo wall has tiles', () => {
    expect(INDEX_HTML).toMatch(/id="previewActions"[^>]*\bhidden\b/);
    expect(SPA_CSS).toContain('[hidden]{display:none !important}');
    expect(spaApp).toContain('syncWallChrome');
    expect(spaApp).toContain('a.hidden = n === 0');
  });

  it('later drops accumulate into the photo wall instead of replacing it', () => {
    expect(spaApp).toContain('wallItems');
    expect(spaApp).toContain('mergeWallItems');
    // drop merges blobs; scan merges results — neither assigns a fresh list over the wall
    expect(spaApp).toContain('mergeWallItems(blobPreviews)');
    expect(spaApp).toContain('mergeWallItems(paths)');
    // reset/upload still clear the wall
    expect(spaApp).toContain('wallItems = []');
    // desktop drop test previously asserted setPreviewImages(blobPreviews) order; that path now merges
    const handler = spaApp.slice(spaApp.indexOf('dz.addEventListener("drop"'));
    const collect = handler.indexOf('collectDropItems(e.dataTransfer)');
    const render = handler.indexOf('mergeWallItems(blobPreviews)');
    const submit = handler.indexOf('await submitDrop(items)');
    expect(collect).toBeGreaterThan(-1);
    expect(render).toBeGreaterThan(collect);
    expect(submit).toBeGreaterThan(render);
  });

  it('desktop:dev uses electron-vite (renderer HMR) with supervised respawn', () => {
    const dev = fs.readFileSync(path.join(repoRoot, 'scripts', 'desktop-dev.mjs'), 'utf8');
    expect(dev).toContain('electron-vite');
    expect(dev).toContain('PICBED_DESKTOP_SUPERVISED');
    expect(dev).toContain('spawnElectronVite');
    // must NOT treat child exit as terminal shutdown (root cause of broken hot reload)
    expect(dev).toContain('respawning');
    expect(dev).toMatch(/shuttingDown/);
    // electron-vite needs an Electron entry — pass desktop/main.mjs explicitly
    expect(dev).toContain('ELECTRON_ENTRY');
    expect(dev).toContain('--entry');
    expect(dev).toContain('desktop/main.mjs');
    expect(fs.existsSync(path.join(repoRoot, 'electron.vite.config.mjs'))).toBe(true);
  });

  it('package.json main points at Electron source entry (desktop/main.mjs)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      main?: string;
      files: string[];
    };
    expect(pkg.main).toBe('desktop/main.mjs');
    // npm pack still excludes desktop runtime
    expect(pkg.files.join(' ')).not.toMatch(/desktop|electron|release/);
  });

  it('main.mjs loads Vite dev URL in dev and local UI server in prod', () => {
    const main = fs.readFileSync(path.join(repoRoot, 'desktop', 'main.mjs'), 'utf8');
    expect(main).toContain('ELECTRON_RENDERER_URL');
    expect(main).toContain('startUiServer');
    expect(main).toContain('PICBED_DESKTOP_SUPERVISED');
    expect(main).toContain('processExitForReload');
    // packaged builds must not load the Vite dev URL
    expect(main).toContain('app.isPackaged');
    expect(main).toContain('uiHandle.url');
  });

  it('vite session keeps window on HMR URL (fs.watch must not navigate away)', () => {
    const main = fs.readFileSync(path.join(repoRoot, 'desktop', 'main.mjs'), 'utf8');
    expect(main).toContain('isViteDevSession');
    expect(main).toMatch(/if \(mainWindow && !mainWindow\.isDestroyed\(\) && !isViteDevSession\(\)\)/);
    expect(main).toContain('keep window URL');
    // desktop/* left to electron-vite when Vite owns the renderer
    expect(main).toContain('vite session → electron-vite restarts');
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
    expect(INDEX_HTML).toContain('PICBED_UI_DEV_FLAG');
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
    expect(main).toContain("listen(port, '127.0.0.1')");
    expect(main).toContain('dialog:selectDirectory');
    expect(main).toMatch(/contextIsolation:\s*true/);
    expect(main).toMatch(/nodeIntegration:\s*false/);
    // no token handling in the shell
    expect(main).not.toMatch(/GITHUB_TOKEN|PICBED_GITHUB_TOKEN/);
  });
});
