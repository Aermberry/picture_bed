import fs from 'node:fs';
import path from 'node:path';
import { extractRefs } from '../extract.js';
import {
  createHostAdapter,
  hostRequiresToken,
  uploadAsset,
} from '../host/index.js';
import {
  findCachedUrl,
  loadManifest,
  saveManifest,
} from '../manifest.js';
import { buildPlan } from '../plan.js';
import { resolveAssets } from '../resolve.js';
import { applyRewrites, mergeManifest } from '../rewrite.js';
import { scanDocs } from '../scan.js';
import type { ResolvedConfig, SyncPlanItem } from '../types.js';

export interface CollectResult {
  docs: { path: string; kind: 'markdown' | 'html' }[];
  byDoc: Map<string, string>;
  assets: ReturnType<typeof resolveAssets>['assets'];
  blocked: ReturnType<typeof resolveAssets>['blocked'];
  remoteSkips: ReturnType<typeof resolveAssets>['remoteSkips'];
  warnings: string[];
}

export async function collect(root: string, cfg: ResolvedConfig): Promise<CollectResult> {
  const docs = scanDocs(root, cfg.scan);
  const warnings: string[] = [];
  const allRefs = [];
  const blocked = [];
  const remoteSkips = [];
  const byDoc = new Map<string, string>();

  for (const doc of docs) {
    let text: string;
    try {
      text = fs.readFileSync(doc.path, 'utf8');
    } catch {
      warnings.push(`unreadable doc: ${doc.path}`);
      continue;
    }
    byDoc.set(doc.path, text);
    const refs = extractRefs(doc, text);
    allRefs.push(...refs);
  }

  const resolved = resolveAssets(allRefs, { scanRoot: root });
  blocked.push(...resolved.blocked);
  remoteSkips.push(...resolved.remoteSkips);
  return { docs, byDoc, assets: resolved.assets, blocked, remoteSkips, warnings };
}

export function summarizePlan(plan: SyncPlanItem[]): Record<string, number> {
  const s: Record<string, number> = {
    upload: 0,
    'skip-cache': 0,
    'skip-remote': 0,
    'rewrite-only': 0,
    blocked: 0,
  };
  for (const p of plan) s[p.action] = (s[p.action] ?? 0) + 1;
  return s;
}

export function publicPlanItem(it: SyncPlanItem) {
  return {
    action: it.action,
    reason: it.reason,
    raw: it.ref?.raw,
    doc: it.ref?.docPath,
    sha256: it.asset?.sha256,
    publicUrl: it.remote?.publicUrl,
    localPath: it.asset?.localPath,
  };
}

export async function runPlan(root: string, cfg: ResolvedConfig, cwd: string) {
  const collected = await collect(root, cfg);
  const manifest = loadManifest(cwd);
  const plan = buildPlan({
    assets: collected.assets,
    blocked: collected.blocked,
    remoteSkips: collected.remoteSkips,
    manifest,
  });
  return { collected, plan, summary: summarizePlan(plan) };
}

export async function runSync(opts: {
  root: string;
  cfg: ResolvedConfig;
  cwd: string;
  getToken: () => string | undefined;
}) {
  const { root, cfg, cwd, getToken } = opts;
  const { collected, plan, summary } = await runPlan(root, cfg, cwd);
  const manifest = loadManifest(cwd);
  const token = getToken();

  if (hostRequiresToken(cfg) && !token) {
    throw Object.assign(new Error('missing token'), {
      code: 'E_TOKEN',
      exitCode: 3,
    });
  }

  const host = createHostAdapter(cfg, token);
  const errors: string[] = [];
  const warnings = [...collected.warnings];
  let uploaded = 0;
  const urlBySha = new Map<string, string>();
  const items: { action: string; localPath?: string; publicUrl?: string; error?: string }[] = [];

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

  return {
    uploaded,
    rewrittenDocs,
    summary,
    errors,
    items,
    warnings,
    ok: errors.length === 0,
  };
}
