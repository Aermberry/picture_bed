import fs from 'node:fs';
import path from 'node:path';
import type { Manifest, ManifestEntry } from './types.js';

export function manifestPath(rootDir: string): string {
  return path.join(rootDir, '.yigecli', 'manifest.json');
}

export function loadManifest(rootDir: string): Manifest {
  const p = manifestPath(rootDir);
  if (!fs.existsSync(p)) {
    return { version: 1, entries: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Manifest;
    if (!raw || raw.version !== 1 || !Array.isArray(raw.entries)) {
      throw new Error('invalid shape');
    }
    return raw;
  } catch (err) {
    const e = new Error(`manifest corrupt: ${p}`) as Error & { code?: string };
    e.code = 'E_MANIFEST_CORRUPT';
    throw e;
  }
}

export function saveManifest(rootDir: string, manifest: Manifest): void {
  const p = manifestPath(rootDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, p);
}

export function upsertEntry(manifest: Manifest, entry: ManifestEntry): Manifest {
  const idx = manifest.entries.findIndex(
    (e) =>
      e.doc === entry.doc &&
      e.raw === entry.raw &&
      e.localPath === entry.localPath,
  );
  if (idx >= 0) {
    manifest.entries[idx] = entry;
  } else {
    manifest.entries.push(entry);
  }
  return manifest;
}

export function findCachedUrl(
  manifest: Manifest,
  sha256: string,
): string | undefined {
  const hit = manifest.entries.find((e) => e.sha256 === sha256);
  return hit?.publicUrl;
}
