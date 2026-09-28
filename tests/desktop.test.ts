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
    expect(SPA_CSS).toContain('columns:');
    expect(SPA_CSS).toContain('break-inside:avoid');
    expect(SPA_CSS).toContain('.photo-wall .tile .name');
    expect(SPA_CSS).toContain('has-photos');
    expect(spaApp).toContain('class="tile"');
    expect(spaApp).toContain('has-photos');
    expect(spaApp).toContain('photoWallTitle');
  });

  it('photo wall follows Material Tailwind masonry gallery: 2/3/4 cols, gap 16, r16', () => {
    // responsive column ladder (mobile → tablet → desktop)
    expect(SPA_CSS).toContain('columns:2');
    expect(SPA_CSS).toContain('.photo-wall{columns:3}');
    expect(SPA_CSS).toContain('.photo-wall{columns:4}');
    // MT rounded-2xl + gap-4 rhythm
    expect(SPA_CSS).toContain('column-gap:16px');
    expect(SPA_CSS).toContain('margin:0 0 16px');
    expect(SPA_CSS).toContain('border-radius:16px');
  });

  it('photo wall hover zoom uses DOTween-style doscale (1→1.22→1, interruptible)', () => {
    // rAF tween engine with DOTween-like easing
    expect(spaApp).toContain('function doscale');
    expect(spaApp).toContain('function dotween');
    expect(spaApp).toContain('outCubic');
    expect(spaApp).toContain('inOutSine');
    expect(spaApp).toContain('requestAnimationFrame');
    expect(spaApp).toContain('cancelAnimationFrame');
    // hover wires: enter scale up, leave scale back
    expect(spaApp).toContain('mouseenter');
    expect(spaApp).toContain('mouseleave');
    expect(spaApp).toContain('1.22');
    // CSS must not fight the JS-driven transform (scoped to .photo-wall .tile)
    expect(SPA_CSS).toContain('transform-origin:center center');
    const tileRule = SPA_CSS.slice(
      SPA_CSS.indexOf('.photo-wall .tile{'),
      SPA_CSS.indexOf('.photo-wall .tile img'),
    );
    expect(tileRule).not.toContain('transition:transform');
    expect(tileRule).not.toContain('transform:');
    expect(SPA_CSS).not.toMatch(/\.photo-wall \.tile:hover\{[^}]*transform/);
  });

  it('photo wall hover focus: neighbours never sit under the enlarged tile', () => {
    expect(spaApp).toContain('function applyWallFocus');
    // enlarged bounds + gap define a clearance zone neighbours must exit
    expect(spaApp).toContain('GAP');
    expect(spaApp).toContain('oX');
    expect(spaApp).toContain('oY');
    // MTV push: exit along the cheaper axis, away from the hovered centre
    expect(spaApp).toContain('pushX');
    expect(spaApp).toContain('pushY');
    // transform-free layout measurement (restore after read)
    expect(spaApp).toContain('transform = "none"');
    expect(spaApp).toContain('measure');
    // hovered draws above while zooming; cleared on leave
    expect(spaApp).toContain('zIndex');
    expect(spaApp).toContain('applyWallFocus(null)');
    // composite transform: translate + scale
    expect(spaApp).toContain('translate(');
    expect(spaApp).toContain(') scale(');
  });

  it('photo wall zoom grows toward scan-area centre and never clips on the dashed frame', () => {
    // no overflow:hidden — the dashed frame must not crop the zoom
    const dropzoneRule = SPA_CSS.slice(
      SPA_CSS.indexOf('.dropzone{'),
      SPA_CSS.indexOf('.dropzone:hover'),
    );
    expect(dropzoneRule).not.toContain('overflow:hidden');
    // adaptive scale + origin toward the frame centre
    expect(spaApp).toContain('transformOrigin');
    expect(spaApp).toContain('HOVER_SCALE');
    expect(spaApp).toContain('maxS');
    expect(spaApp).toContain('targetS');
    // neighbour targets stay inside the frame without extra drift gaps
    expect(spaApp).toContain('MARGIN');
    expect(spaApp).toContain('clampedX');
  });

  it('photo wall zoom pins edges that hug a dashed line (no expansion toward it)', () => {
    // per-edge proximity gates which sides may expand
    expect(spaApp).toContain('NEAR');
    expect(spaApp).toContain('nearLeft');
    expect(spaApp).toContain('nearRight');
    expect(spaApp).toContain('nearTop');
    expect(spaApp).toContain('nearBottom');
    // opposite edges both near → that axis does not expand
    expect(spaApp).toContain('allowX');
    expect(spaApp).toContain('allowY');
    expect(spaApp).toContain('targetSx');
    expect(spaApp).toContain('targetSy');
    // non-uniform scale keeps a pinned axis at 1
    expect(spaApp).toContain('scale(" + s.sx + "," + s.sy + ")');
    // free sides still use the original up-to-1.22 zoom
    expect(spaApp).toContain('1.22');
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
