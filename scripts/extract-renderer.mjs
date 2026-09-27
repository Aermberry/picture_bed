/** One-shot: extract src/ui/spa template strings into renderer/ (Vite root). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(root, 'renderer'), { recursive: true });

/** @param {string} src @param {string} exportName */
function extractTemplate(src, exportName) {
  const marker = `export const ${exportName} = \``;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`${exportName} not found`);
  const bodyStart = start + marker.length;
  const end = src.lastIndexOf('`;');
  if (end <= bodyStart) throw new Error(`${exportName} terminator not found`);
  let body = src.slice(bodyStart, end);
  body = body.replace(/\\`/g, '`').replace(/\\\$/g, '$').replace(/\\\\/g, '\\');
  return body;
}

const stylesTs = fs.readFileSync(path.join(root, 'src/ui/spa/styles.ts'), 'utf8');
const css = extractTemplate(stylesTs, 'SPA_CSS');
fs.writeFileSync(path.join(root, 'renderer/styles.css'), css, 'utf8');
console.log('styles.css', css.length);

const indexTs = fs.readFileSync(path.join(root, 'src/ui/spa/index.ts'), 'utf8');
let html = extractTemplate(indexTs, 'INDEX_HTML');
html = html.replace('href="/styles.css"', 'href="./styles.css"');
html = html.replace('src="/app.js"', 'src="./main.js"');
html = html.replace(
  'window.__PICBED_UI_DEV__ = __PICBED_UI_DEV_FLAG__;',
  'window.__PICBED_UI_DEV__ = window.__PICBED_UI_DEV__ ?? false;',
);
fs.writeFileSync(path.join(root, 'renderer/index.html'), html, 'utf8');
console.log('index.html', html.length);

const appJs = fs.readFileSync(path.join(root, 'src/ui/spa/app.js'), 'utf8');
fs.writeFileSync(path.join(root, 'renderer/main.js'), appJs, 'utf8');
console.log('main.js', appJs.length);
