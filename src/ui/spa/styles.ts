import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Single UI source of truth: renderer/styles.css (Vite root). */
export const SPA_CSS = fs.readFileSync(
  fileURLToPath(new URL('../../../renderer/styles.css', import.meta.url)),
  'utf8',
);
