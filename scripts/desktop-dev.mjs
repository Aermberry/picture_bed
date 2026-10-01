/**
 * Launch Electron shell for local desktop dev with hot rebuild.
 *
 * Layering (module-desktop · electron-vite):
 * - tsc -w           → CLI/app core (dist/) used by createUiServer
 * - electron-vite dev → main/preload restart + renderer Vite HMR
 *
 * PICBED_DESKTOP_SUPERVISED=1 is set so main.mjs yields lifecycle to us
 * if it must process-restart (fallback path). Renderer HMR does not restart Electron.
 *
 * ELECTRON_ENTRY / --entry: electron-vite 需要 Electron 入口 —— 传 desktop/main.mjs
 * （ESM 源码，Electron 原生加载；out/main 是 electron-vite 的 CJS 打包产物）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktopMain = path.join(root, 'desktop', 'main.mjs');
// Source entry: rollup-bundled main (out/main) hits Electron 33 ESM/CJS interop bugs.
// desktop/main.mjs is ESM and Electron loads it natively (same as packaged extraMetadata.main).
const electronEntryRel = path.join('desktop', 'main.mjs');
const electronEntryAbs = path.join(root, electronEntryRel);
const tscJs = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const electronVite = path.join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js');
const node = process.execPath;

if (!fs.existsSync(desktopMain)) {
  console.error(`missing ${desktopMain}`);
  process.exit(1);
}
if (!fs.existsSync(electronVite)) {
  console.error(`missing electron-vite — run: npm install -D electron-vite vite`);
  process.exit(1);
}

// npm run desktop:dev 已经跑过一次 tsc -p（package.json），这里只负责 watch，
// 避免每次启动白跑一次全量编译。
console.log('[desktop:dev] tsc --watch (core dist/)');
const watch = spawn(node, [tscJs, '-w', '-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' });

/** @type {import('node:child_process').ChildProcess | null} */
let child = null;
let shuttingDown = false;
let respawnTimer = null;
let consecutiveFailures = 0;

function spawnElectronVite() {
  console.log('[desktop:dev] electron-vite dev (renderer HMR + main/preload restart)');
  const env = {
    ...process.env,
    PICBED_UI_DEV: process.env.PICBED_UI_DEV ?? '1',
    PICBED_DESKTOP_SUPERVISED: '1',
    PICBED_DESKTOP_DEV: '1',
    // package.json has no "main" (CLI package) — tell electron-vite the entry
    ELECTRON_ENTRY: electronEntryRel,
  };
  // A leaked ELECTRON_RUN_AS_NODE makes require('electron') return a path string.
  delete env.ELECTRON_RUN_AS_NODE;
  child = spawn(
    node,
    [electronVite, 'dev', '--entry', electronEntryRel],
    {
      cwd: root,
      stdio: 'inherit',
      env,
    },
  );
  const startedAt = Date.now();
  child.on('exit', (code, signal) => {
    child = null;
    if (shuttingDown) return;
    // Quick exit (config/entry error) → backoff and cap retries; long run → reset.
    const ranMs = Date.now() - startedAt;
    if (ranMs > 3000) consecutiveFailures = 0;
    consecutiveFailures += 1;
    if (signal) console.error('[desktop:dev] electron-vite exited with signal', signal);
    else console.log('[desktop:dev] electron-vite exited code', code);
    if (consecutiveFailures >= 5) {
      console.error('[desktop:dev] too many failed starts — giving up (check ELECTRON_ENTRY / config)');
      shutdown(code ?? 1);
      return;
    }
    const delay = Math.min(300 * consecutiveFailures, 2000);
    console.log(`[desktop:dev] respawning in ${delay}ms… (attempt ${consecutiveFailures}/5)`);
    if (respawnTimer) clearTimeout(respawnTimer);
    respawnTimer = setTimeout(() => {
      respawnTimer = null;
      if (!shuttingDown) spawnElectronVite();
    }, delay);
  });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (respawnTimer) {
    clearTimeout(respawnTimer);
    respawnTimer = null;
  }
  try {
    watch.kill();
  } catch {}
  try {
    if (child) child.kill();
  } catch {}
  process.exit(code ?? 0);
}

// Entry must exist before electron-vite tries to spawn Electron (it builds first).
if (!fs.existsSync(electronEntryAbs)) {
  console.log('[desktop:dev] prebuilding electron entry…');
  const pre = spawnSync(node, [electronVite, 'build'], { cwd: root, stdio: 'inherit' });
  if (pre.status !== 0) {
    console.error('[desktop:dev] electron-vite build failed');
    process.exit(pre.status ?? 1);
  }
}

spawnElectronVite();

watch.on('exit', (code) => {
  if (shuttingDown) return;
  console.error('[desktop:dev] tsc --watch exited', code);
  shutdown(code ?? 1);
});
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
