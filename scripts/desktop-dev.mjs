/**
 * Launch Electron shell for local desktop dev with hot rebuild.
 *
 * Supervisor contract (module-desktop · 本地开发热更新):
 * - tsc --watch keeps running across Electron restarts.
 * - Electron exits (relaunch / crash) → respawn; do NOT kill the harness.
 * - PICBED_DESKTOP_SUPERVISED=1 tells main.mjs to app.exit(0) instead of
 *   app.relaunch(), so this process owns the lifecycle (single instance).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distMain = path.join(root, 'desktop', 'main.mjs');
const electron =
  process.platform === 'win32'
    ? path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(root, 'node_modules', 'electron', 'dist', 'electron');
const tscJs = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const node = process.execPath;

if (!fs.existsSync(distMain)) {
  console.error(`missing ${distMain}`);
  process.exit(1);
}
if (!fs.existsSync(electron)) {
  console.error(`missing electron binary at ${electron} — run: npm install electron`);
  process.exit(1);
}

console.log('[desktop:dev] initial tsc build…');
const first = spawnSync(node, [tscJs, '-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' });
if (first.status !== 0) {
  console.error('[desktop:dev] tsc failed');
  process.exit(first.status ?? 1);
}

console.log('[desktop:dev] tsc --watch (hot rebuild)');
const watch = spawn(node, [tscJs, '-w', '-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' });

/** @type {import('node:child_process').ChildProcess | null} */
let child = null;
let shuttingDown = false;
let respawnTimer = null;

function spawnElectron() {
  console.log('[desktop:dev] electron (tiered hot reload: app.js reload · dist UI restart · desktop relaunch)');
  child = spawn(electron, [distMain], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PICBED_UI_DEV: process.env.PICBED_UI_DEV ?? '1',
      PICBED_DESKTOP_SUPERVISED: '1',
    },
  });
  child.on('exit', (code, signal) => {
    child = null;
    if (shuttingDown) return;
    // Relaunch/crash must NOT take down tsc --watch or this supervisor.
    if (signal) console.error('[desktop:dev] electron exited with signal', signal);
    else console.log('[desktop:dev] electron exited code', code, '— respawning…');
    if (respawnTimer) clearTimeout(respawnTimer);
    respawnTimer = setTimeout(() => {
      respawnTimer = null;
      if (!shuttingDown) spawnElectron();
    }, 200);
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

spawnElectron();

watch.on('exit', (code) => {
  if (shuttingDown) return;
  console.error('[desktop:dev] tsc --watch exited', code);
  shutdown(code ?? 1);
});
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
