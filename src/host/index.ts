import type { ResolvedConfig } from '../types.js';
import { GitHubHostAdapter } from './github.js';
import { LocalHostAdapter } from './local.js';
import type { HostAdapter } from './types.js';

export type { HostAdapter, HostUrls } from './types.js';
export { GitHubHostAdapter, uploadAsset, composeUrls, remotePath } from './github.js';
export { LocalHostAdapter } from './local.js';

/** F13 factory: pick backend by `host.type` while keeping AC7 upload/URL semantics. */
export function createHostAdapter(cfg: ResolvedConfig, token?: string): HostAdapter {
  const type = cfg.host.type;
  if (type === 'local') {
    return new LocalHostAdapter(cfg.local, cfg.url);
  }
  if (type === 'github') {
    if (!token) {
      throw Object.assign(new Error('missing token for github host'), {
        code: 'E_TOKEN',
      });
    }
    return new GitHubHostAdapter(cfg.github, token, cfg.url);
  }
  throw Object.assign(new Error(`unknown host.type: ${type}`), { code: 'E_CONFIG' });
}

export function hostRequiresToken(cfg: ResolvedConfig): boolean {
  return cfg.host.type !== 'local';
}
