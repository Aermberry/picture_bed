import type {
  Asset,
  BlockedItem,
  ImageRef,
  Manifest,
  RemoteImage,
  SyncPlanItem,
} from './types.js';
import { findCachedUrl } from './manifest.js';

export function buildPlan(args: {
  assets: Asset[];
  blocked: BlockedItem[];
  remoteSkips: ImageRef[];
  manifest: Manifest;
}): SyncPlanItem[] {
  const items: SyncPlanItem[] = [];

  for (const ref of args.remoteSkips) {
    items.push({
      action: 'skip-remote',
      ref,
      reason: 'already http(s) URL',
      remote: {
        publicUrl: ref.raw,
        rawUrl: ref.raw,
        repoPath: '',
        sha256: '',
      },
    });
  }

  for (const asset of args.assets) {
    const cached = findCachedUrl(args.manifest, asset.sha256);
    if (cached) {
      const remote: RemoteImage = {
        publicUrl: cached,
        rawUrl: cached,
        repoPath: '',
        sha256: asset.sha256,
      };
      for (const ref of asset.refs) {
        items.push({
          action: 'skip-cache',
          asset,
          remote,
          ref,
          reason: 'manifest cache hit',
        });
      }
      continue;
    }
    for (const ref of asset.refs) {
      items.push({
        action: 'upload',
        asset,
        ref,
        reason: 'local asset needs upload',
      });
    }
  }

  for (const b of args.blocked) {
    items.push({
      action: 'blocked',
      ref: b.ref,
      reason: `${b.code}: ${b.reason}`,
    });
  }

  items.sort((a, b) => (a.ref?.start ?? 0) - (b.ref?.start ?? 0));
  return items;
}
