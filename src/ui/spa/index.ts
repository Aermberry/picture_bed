import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Single UI source of truth: renderer/index.html (Vite root). */
export const INDEX_HTML = fs.readFileSync(
  fileURLToPath(new URL('../../../renderer/index.html', import.meta.url)),
  'utf8',
);
