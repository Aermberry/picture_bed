import fs from 'node:fs';
import path from 'node:path';
import type { ImageRef, Manifest, ManifestEntry } from './types.js';
import { upsertEntry } from './manifest.js';

export interface RewriteMapItem {
  ref: ImageRef;
  publicUrl: string;
  localPath: string;
  sha256: string;
}

export interface RewriteOptions {
  backup: boolean;
  outDir?: string;
  rootDir: string;
}

export function rewriteDoc(
  content: string,
  items: RewriteMapItem[],
  opts: RewriteOptions & { docPath: string },
): string {
  const sorted = [...items].sort((a, b) => b.ref.start - a.ref.start);
  let out = content;
  for (const item of sorted) {
    const { start, end, raw } = item.ref;
    if (out.slice(start, start + raw.length) !== raw) {
      throw new Error(`offset drift in ${opts.docPath} at ${start}`);
    }
    out = out.slice(0, start) + item.publicUrl + out.slice(start + raw.length);
    // end was start+raw.length before; after replace lengths change but we go reverse
    void end;
  }
  return out;
}

function backupPath(rootDir: string, docPath: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const rel = path.basename(docPath);
  return path.join(rootDir, '.picbed', 'backup', `${rel}.${ts}.bak`);
}

export function writeDocAtomic(target: string, content: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.picbed-tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, target);
}

export function applyRewrites(opts: {
  docPath: string;
  content: string;
  items: RewriteMapItem[];
  rootDir: string;
  backup: boolean;
  outDir?: string;
  dryRun?: boolean;
}): { outPath: string; content: string; backedUpTo?: string; entries: ManifestEntry[] } {
  const next = rewriteDoc(opts.content, opts.items, {
    backup: opts.backup,
    rootDir: opts.rootDir,
    docPath: opts.docPath,
  });

  const rel = path.relative(opts.rootDir, opts.docPath);
  const outPath = opts.outDir
    ? path.join(path.resolve(opts.outDir), rel)
    : opts.docPath;

  const entries: ManifestEntry[] = opts.items.map((it) => ({
    doc: rel.split(path.sep).join('/'),
    raw: it.ref.raw,
    localPath: it.localPath,
    sha256: it.sha256,
    publicUrl: it.publicUrl,
    updatedAt: new Date().toISOString(),
  }));

  if (opts.dryRun) {
    return { outPath, content: next, entries };
  }

  let backedUpTo: string | undefined;
  if (opts.backup && !opts.outDir && fs.existsSync(opts.docPath)) {
    backedUpTo = backupPath(opts.rootDir, opts.docPath);
    fs.mkdirSync(path.dirname(backedUpTo), { recursive: true });
    fs.copyFileSync(opts.docPath, backedUpTo);
  }

  writeDocAtomic(outPath, next);
  return { outPath, content: next, backedUpTo, entries };
}

export function revertDoc(
  content: string,
  entries: ManifestEntry[],
): string {
  let out = content;
  // Replace longer URLs first to avoid partial overlaps
  const sorted = [...entries].sort(
    (a, b) => b.publicUrl.length - a.publicUrl.length,
  );
  for (const e of sorted) {
    if (!e.publicUrl) continue;
    out = out.split(e.publicUrl).join(e.raw);
  }
  return out;
}

export function mergeManifest(
  manifest: Manifest,
  entries: ManifestEntry[],
): Manifest {
  for (const e of entries) upsertEntry(manifest, e);
  return manifest;
}
