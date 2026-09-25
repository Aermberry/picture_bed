/**
 * Launch Electron shell for local desktop dev.
 * Spawns electron.exe directly so PATH/shim node quirks cannot break startup.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distMain = path.join(root, 'desktop', 'main.mjs');
const electron =
  process.platform === 'win32'
    ? path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(root, 'node_modules', 'electron', 'dist', 'electron');

if (!fs.existsSync(distMain)) {
  console.error(`missing ${distMain}`);
  process.exit(1);
}
if (!fs.existsSync(electron)) {
  console.error(`missing electron binary at ${electron} — run: npm install electron`);
  process.exit(1);
}

const child = spawn(electron, [distMain], { cwd: root, stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) {
    console.error('electron exited with signal', signal);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
