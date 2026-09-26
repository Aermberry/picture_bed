import fs from 'node:fs';
import path from 'node:path';
import { createHostAdapter, hostRequiresToken, uploadAsset } from '../host/index.js';
import { findCachedUrl, loadManifest, saveManifest } from '../manifest.js';
import { applyRewrites, mergeManifest } from '../rewrite.js';
import type { ResolvedConfig, SyncPlanItem } from '../types.js';
import { AppError, TOKEN_HINT } from './errors.js';
import { runPlan } from './plan.js';
import { newRunId, recordRun } from './runs.js';

export interface SyncItem {
  action: string;
  localPath?: string;
  publicUrl?: string;
  error?: string;
}

export interface SyncResult {
  ok: boolean;
  uploaded: number;
  rewrittenDocs: string[];
  summary: Record<string, number>;
  errors: string[];
  items: SyncItem[];
  warnings: string[];
  partial: boolean;
  errorCode?: 'E_PARTIAL' | 'E_REMOTE';
  runId: string;
}

export async function runSync(opts: {
  root: string;
  cfg: ResolvedConfig;
  cwd: string;
  getToken: () => string | undefined;
  command?: string;
}): Promise<SyncResult> {
  const { root, cfg, cwd, getToken, command = 'sync' } = opts;
  const startedAt = new Date().toISOString();
  const { collected, plan, summary } = await runPlan(root, cfg, cwd);
  const manifest = loadManifest(cwd);
  const token = getToken();

  if (hostRequiresToken(cfg) && !token) {
    throw new AppError('E_TOKEN', 'missing GitHub token (PICBED_GITHUB_TOKEN / GITHUB_TOKEN / GitHub CLI `gh`)', {
      hint: TOKEN_HINT,
    });
  }
  if (cfg.host.type === 'github' && (!cfg.github.owner || !cfg.github.repo)) {
    throw new AppError('E_CONFIG', 'github.owner/repo required');
  }

  const host = createHostAdapter(cfg, token);
  const errors: string[] = [];
  const warnings = [...collected.warnings];
  let uploaded = 0;
  const urlBySha = new Map<string, string>();
  const items: SyncItem[] = [];

  const unique = new Map<string, (typeof collected.assets)[number]>();
  for (const item of plan) {
    if (item.action !== 'upload' || !item.asset) continue;
    unique.set(item.asset.sha256, item.asset);
  }
  for (const asset of unique.values()) {
    try {
      const cached = findCachedUrl(manifest, asset.sha256);
      if (cached) {
        urlBySha.set(asset.sha256, cached);
        items.push({ action: 'skip-cache', localPath: asset.localPath, publicUrl: cached });
        continue;
      }
      const bytes = fs.readFileSync(asset.localPath);
      const remote = await uploadAsset(host, { asset, bytes, cfg });
      urlBySha.set(asset.sha256, remote.publicUrl);
      uploaded += 1;
      items.push({ action: 'upload', localPath: asset.localPath, publicUrl: remote.publicUrl });
      mergeManifest(manifest, [
        {
          doc: '',
          raw: '',
          localPath: asset.localPath,
          sha256: asset.sha256,
          publicUrl: remote.publicUrl,
          updatedAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      const msg = `${asset.localPath}: ${String(err)}`;
      errors.push(msg);
      items.push({ action: 'upload', localPath: asset.localPath, error: String(err) });
    }
  }

  const rewrittenDocs: string[] = [];
  for (const docPath of collected.byDoc.keys()) {
    const text = collected.byDoc.get(docPath) ?? '';
    const rewriteItems = plan
      .filter((it) => it.ref && it.ref.docPath === docPath)
      .map((it) => {
        const url =
          it.action === 'upload' || it.action === 'skip-cache'
            ? urlBySha.get(it.asset?.sha256 ?? '')
            : it.remote?.publicUrl;
        return { it, url };
      })
      .filter((x): x is { it: SyncPlanItem; url: string } => Boolean(x.url));

    if (!rewriteItems.length) continue;
    try {
      const result = applyRewrites({
        docPath,
        content: text,
        items: rewriteItems.map((x) => ({
          ref: x.it.ref!,
          publicUrl: x.url,
          localPath: x.it.asset?.localPath ?? '',
          sha256: x.it.asset?.sha256 ?? '',
        })),
        rootDir: cwd,
        backup: cfg.rewrite.backup,
        dryRun: false,
      });
      mergeManifest(manifest, result.entries);
      rewrittenDocs.push(path.relative(cwd, docPath).split(path.sep).join('/'));
    } catch (err) {
      errors.push(`${docPath}: ${String(err)}`);
    }
  }

  try {
    saveManifest(cwd, manifest);
  } catch (err) {
    warnings.push(`manifest save failed: ${String(err)}`);
  }

  const ok = errors.length === 0;
  const partial = !ok && uploaded + rewrittenDocs.length > 0;
  const errorCode: SyncResult['errorCode'] = ok ? undefined : partial ? 'E_PARTIAL' : 'E_REMOTE';
  const runId = newRunId();
  recordRun(cwd, {
    id: runId,
    command,
    startedAt,
    finishedAt: new Date().toISOString(),
    ok,
    counts: {
      uploaded,
      rewritten: rewrittenDocs.length,
      failed: errors.length,
      ...summary,
    },
    items,
    errors,
    warnings,
    errorCode,
  });

  return {
    ok,
    uploaded,
    rewrittenDocs,
    summary,
    errors,
    items,
    warnings,
    partial,
    errorCode,
    runId,
  };
}
