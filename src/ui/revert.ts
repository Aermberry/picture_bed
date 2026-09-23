import fs from 'node:fs';
import path from 'node:path';
import { loadManifest } from '../manifest.js';
import { revertDoc, writeDocAtomic } from '../rewrite.js';
import { scanDocs } from '../scan.js';
import type { ResolvedConfig } from '../types.js';
import { newRunId, recordRun } from './runs.js';

export function listManifestView(cwd: string) {
  try {
    const manifest = loadManifest(cwd);
    return { version: manifest.version, entries: manifest.entries, ok: true as const };
  } catch (err) {
    const e = err as Error & { code?: string };
    return {
      version: 1,
      entries: [] as never[],
      ok: false as const,
      error: { code: e.code ?? 'E_MANIFEST_CORRUPT', message: e.message },
    };
  }
}

export function runRevert(opts: {
  root: string;
  cfg: ResolvedConfig;
  cwd: string;
  dryRun: boolean;
}): {
  ok: boolean;
  dryRun: boolean;
  rewritten: string[];
  planned: string[];
  errors: string[];
  runId: string;
} {
  const { root, cfg, cwd, dryRun } = opts;
  const startedAt = new Date().toISOString();
  const runId = newRunId();
  const errors: string[] = [];
  const rewritten: string[] = [];
  const planned: string[] = [];

  let manifest;
  try {
    manifest = loadManifest(cwd);
  } catch (err) {
    const msg = String(err);
    recordRun(cwd, {
      id: runId,
      command: 'api.revert',
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: false,
      counts: {},
      errors: [msg],
      errorCode: 'E_MANIFEST_CORRUPT',
    });
    return {
      ok: false,
      dryRun,
      rewritten,
      planned,
      errors: [msg],
      runId,
    };
  }

  const docs = scanDocs(root, cfg.scan);
  for (const doc of docs) {
    const text = fs.readFileSync(doc.path, 'utf8');
    const entries = manifest.entries.filter((e) => path.resolve(cwd, e.doc) === doc.path);
    if (!entries.length) continue;
    const next = revertDoc(text, entries);
    const rel = path.relative(cwd, doc.path).split(path.sep).join('/');
    if (next === text) continue;
    if (dryRun) {
      planned.push(rel);
      continue;
    }
    try {
      writeDocAtomic(doc.path, next);
      rewritten.push(rel);
    } catch (err) {
      errors.push(`${rel}: ${String(err)}`);
    }
  }

  const ok = errors.length === 0;
  recordRun(cwd, {
    id: runId,
    command: dryRun ? 'api.revert.dryRun' : 'api.revert',
    startedAt,
    finishedAt: new Date().toISOString(),
    ok,
    counts: { planned: planned.length, rewritten: rewritten.length, failed: errors.length },
    errors,
    errorCode: ok ? undefined : 'E_PARTIAL',
  });

  return { ok, dryRun, rewritten, planned, errors, runId };
}
