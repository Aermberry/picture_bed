import { loadManifest } from '../manifest.js';
import { buildPlan } from '../plan.js';
import type { ResolvedConfig, SyncPlanItem } from '../types.js';
import { collect } from './collect.js';

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
