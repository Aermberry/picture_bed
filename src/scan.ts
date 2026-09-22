import fs from 'node:fs';
import path from 'node:path';
import type { DocFile, DocKind, ScanConfig } from './types.js';

const DEFAULT_EXT = ['md', 'html', 'htm'];

function ignored(relPosix: string, patterns: string[]): boolean {
  const p = relPosix.replace(/\\/g, '/');
  for (const pat of patterns) {
    if (pat.includes('node_modules') && p.includes('node_modules')) return true;
    if (pat.includes('.git') && (p === '.git' || p.startsWith('.git/') || p.includes('/.git/'))) {
      return true;
    }
    if (pat.includes('.picbed') && p.includes('.picbed')) return true;
    const cleaned = pat.replace(/^\*\*\//, '').replace(/\/\*\*$/, '').replace(/\*\*/g, '');
    if (cleaned && p === cleaned) return true;
    if (cleaned && p.startsWith(cleaned + '/')) return true;
  }
  return false;
}

function kindOf(filePath: string): DocKind {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.md' || ext === '.markdown' ? 'markdown' : 'html';
}

export function scanDocs(root: string, scan: ScanConfig): DocFile[] {
  const exts = new Set(
    (scan.extensions?.length ? scan.extensions : DEFAULT_EXT).map((e) =>
      e.replace(/^\./, '').toLowerCase(),
    ),
  );
  const ignore = scan.ignore?.length
    ? scan.ignore
    : ['**/node_modules/**', '**/.git/**', '**/.picbed/**'];

  const out: DocFile[] = [];
  const rootAbs = path.resolve(root);

  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      const rel = path.relative(rootAbs, abs).split(path.sep).join('/');
      if (ignored(rel, ignore)) continue;
      if (ent.isDirectory()) {
        if (ent.isSymbolicLink()) continue;
        walk(abs);
        continue;
      }
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).replace(/^\./, '').toLowerCase();
      if (!exts.has(ext)) continue;
      out.push({ path: abs, kind: kindOf(abs) });
    }
  };

  walk(rootAbs);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}
