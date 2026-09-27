/**
 * Launch Electron shell for local desktop dev with hot rebuild.
 *
 * Layering (module-desktop · electron-vite):
 * - tsc -w           → CLI/app core (dist/) used by createUiServer
 * - electron-vite dev → main/preload restart + renderer Vite HMR
 *
 * PICBED_DESKTOP_SUPERVISED=1 is set so main.mjs yields lifecycle to us
 * if it must process-restart (fallback path). Renderer HMR does not restart Electron.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distMain = path.join(root, 'desktop', 'main.mjs');
const tscJs = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const electronVite = path.join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js');
const node = process.execPath;

if (!fs.existsSync(distMain)) {
  console.error(`missing ${distMain}`);
  process.exit(1);
}
if (!fs.existsSync(electronVite)) {
  console.error(`missing electron-vite — run: npm install -D electron-vite vite`);
  process.exit(1);
}

console.log('[desktop:dev] initial tsc build…');
const first = spawnSync(node, [tscJs, '-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' });
if (first.status !== 0) {
  console.error('[desktop:dev] tsc failed');
  process.exit(first.status ?? 1);
}

console.log('[desktop:dev] tsc --watch (core dist/)');
const watch = spawn(node, [tscJs, '-w', '-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' });

/** @type {import('node:child_process').ChildProcess | null} */
let child = null;
let shuttingDown = false;
let respawnTimer = null;

function spawnElectronVite() {
  console.log('[desktop:dev] electron-vite dev (renderer HMR + main/preload restart)');
  child = spawn(node, [electronVite, 'dev'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PICBED_UI_DEV: process.env.PICBED_UI_DEV ?? '1',
      PICBED_DESKTOP_SUPERVISED: '1',
      PICBED_DESKTOP_DEV: '1',
    },
  });
  child.on('exit', (code, signal) => {
    child = null;
    if (shuttingDown) return;
    if (signal) console.error('[desktop:dev] electron-vite exited with signal', signal);
    else console.log('[desktop:dev] electron-vite exited code', code, '— respawning…');
    if (respawnTimer) clearTimeout(respawnTimer);
    respawnTimer = setTimeout(() => {
      respawnTimer = null;
      if (!shuttingDown) spawnElectronVite();
    }, 300);
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

spawnElectronVite();

watch.on('exit', (code) => {
  if (shuttingDown) return;
  console.error('[desktop:dev] tsc --watch exited', code);
  shutdown(code ?? 1);
});
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
