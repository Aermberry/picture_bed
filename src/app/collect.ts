import fs from 'node:fs';
import { extractRefs } from '../extract.js';
import { resolveAssets } from '../resolve.js';
import { scanDocs } from '../scan.js';
import type { ResolvedConfig } from '../types.js';

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
