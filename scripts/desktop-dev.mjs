/**
 * Launch Electron shell for local desktop dev with hot rebuild.
 * Spawns electron.exe directly so PATH/shim node quirks cannot break startup.
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

console.log('[desktop:dev] electron (auto-relaunch on desktop/ or dist/ change)');
const child = spawn(electron, [distMain], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PICBED_UI_DEV: process.env.PICBED_UI_DEV ?? '1' },
});

function shutdown(code) {
  try {
    watch.kill();
  } catch {}
  try {
    child.kill();
  } catch {}
  process.exit(code ?? 0);
}

child.on('exit', (code, signal) => {
  if (signal) console.error('electron exited with signal', signal);
  shutdown(code ?? 0);
});
watch.on('exit', (code) => {
  console.error('tsc --watch exited', code);
  shutdown(code ?? 1);
});
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
