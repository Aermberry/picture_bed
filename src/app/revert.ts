import fs from 'node:fs';
import path from 'node:path';
import { loadManifest } from '../manifest.js';
import { revertDoc, writeDocAtomic } from '../rewrite.js';
import { scanDocs } from '../scan.js';
import type { ManifestEntry, ResolvedConfig } from '../types.js';
import { newRunId, recordRun } from './run-store.js';

export interface RevertResult {
  ok: boolean;
  dryRun: boolean;
  rewritten: string[];
  planned: string[];
  errors: string[];
  errorCode?: 'E_MANIFEST_CORRUPT' | 'E_PARTIAL';
  runId: string;
}

export function listManifestView(cwd: string) {
  try {
    const manifest = loadManifest(cwd);
    // 视图层按内容去重：存储保持引用级（doc+raw+localPath 主键，revert/skip-cache 依赖），
    // 同一 sha256 只出一条（取 updatedAt 最新），管理页一张图一张卡。
    // 已托管外链引用（无 sha256 且无 localPath，从未经本图床上传）不进「已上传图片库」视图，
    // 否则会出现图库里不存在的图与指向外部地址的假外链卡；存储中仍保留（revert 语义）。
    const byKey = new Map<string, ManifestEntry>();
    for (const e of manifest.entries) {
      if (!e.sha256 && !e.localPath) continue;
      const key = e.sha256 || `\u0000${e.doc}\u0000${e.raw}\u0000${e.localPath}`;
      const prev = byKey.get(key);
      if (!prev || String(e.updatedAt || '') > String(prev.updatedAt || '')) byKey.set(key, e);
    }
    return { version: manifest.version, entries: [...byKey.values()], ok: true as const };
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
  command?: string;
}): RevertResult {
  const { root, cfg, cwd, dryRun, command = 'revert' } = opts;
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
      command: dryRun ? `${command}.dryRun` : command,
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
      errorCode: 'E_MANIFEST_CORRUPT',
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
  const errorCode: RevertResult['errorCode'] = ok ? undefined : 'E_PARTIAL';
  recordRun(cwd, {
    id: runId,
    command: dryRun ? `${command}.dryRun` : command,
    startedAt,
    finishedAt: new Date().toISOString(),
    ok,
    counts: { planned: planned.length, rewritten: rewritten.length, failed: errors.length },
    errors,
    errorCode,
  });

  return { ok, dryRun, rewritten, planned, errors, errorCode, runId };
}
