import type { GithubConfig, LocalHostConfig, RemoteImage, UrlConfig } from '../types.js';
import type { HostAdapter, HostUrls } from './types.js';

export function composeGithubUrls(
  cfg: { github: GithubConfig; url: UrlConfig },
  repoPath: string,
): HostUrls {
  const { owner, repo, branch } = cfg.github;
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${repoPath}`;
  const cdnUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${repoPath}`;
  let publicUrl = rawUrl;
  if (cfg.url.style === 'jsdelivr') publicUrl = cdnUrl;
  if (cfg.url.style === 'custom') {
    const tpl = cfg.url.customTemplate ?? 'https://cdn.example.com/{path}';
    publicUrl = tpl
      .replace('{path}', repoPath)
      .replace('{owner}', owner)
      .replace('{repo}', repo)
      .replace('{branch}', branch);
  }
  return { publicUrl, rawUrl, cdnUrl };
}

export interface GithubProbeResult {
  api: { ok: boolean; detail: string };
  contents: { ok: boolean; detail: string };
}

/** F20 doctor probe: repo API reachability, then contents (dir may legitimately be absent). */
export async function probeGithubAccess(
  cfg: GithubConfig,
  token: string,
): Promise<GithubProbeResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'picbed',
  };
  let api: GithubProbeResult['api'];
  try {
    const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, { headers });
    api = { ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (err) {
    api = { ok: false, detail: String(err) };
  }
  if (!api.ok) {
    return { api, contents: { ok: false, detail: 'skipped (repo API failed)' } };
  }
  const dir = cfg.dir.replace(/^\/+|\/+$/g, '');
  const probePath = dir.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${probePath}?ref=${cfg.branch}`;
  try {
    const res = await fetch(url, { headers });
    return {
      api,
      contents: { ok: res.ok || res.status === 404, detail: `HTTP ${res.status}` },
    };
  } catch (err) {
    return { api, contents: { ok: false, detail: String(err) } };
  }
}

export function githubRemotePath(
  dir: string,
  sha256: string,
  localPath: string,
  now = new Date(),
): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const base = localPath.split(/[\\/]/).pop() ?? 'image.bin';
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, '_');
  const sha12 = sha256.slice(0, 12);
  const prefix = dir.replace(/^\/+|\/+$/g, '');
  return prefix ? `${prefix}/${yyyy}/${mm}/${sha12}-${safe}` : `${yyyy}/${mm}/${sha12}-${safe}`;
}

export class GitHubHostAdapter implements HostAdapter {
  readonly type = 'github';
  readonly requiresToken = true;

  constructor(
    private readonly cfg: GithubConfig,
    private readonly token: string,
    private readonly url: UrlConfig = { style: 'jsdelivr' },
  ) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'picbed',
    };
  }

  private urlFor(repoPath: string): string {
    return `https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${repoPath
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
  }

  async exists(repoPath: string): Promise<boolean> {
    const res = await fetch(`${this.urlFor(repoPath)}?ref=${this.cfg.branch}`, {
      headers: this.headers(),
    });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    throw Object.assign(new Error(`GET contents failed: ${res.status}`), {
      code: 'E_REMOTE',
      status: res.status,
    });
  }

  async putFile(
    repoPath: string,
    bytes: Buffer,
    message: string,
    branch: string,
  ): Promise<void> {
    const content = bytes.toString('base64');
    let sha: string | undefined;
    const get = await fetch(`${this.urlFor(repoPath)}?ref=${branch}`, {
      headers: this.headers(),
    });
    if (get.status === 200) {
      const body = (await get.json()) as { sha?: string };
      sha = body.sha;
    }
    const res = await fetch(this.urlFor(repoPath), {
      method: 'PUT',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content,
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(`PUT contents failed: ${res.status} ${text}`), {
        code: 'E_REMOTE',
        status: res.status,
      });
    }
  }

  composeUrls(repoPath: string): HostUrls {
    return composeGithubUrls({ github: this.cfg, url: this.url }, repoPath);
  }

  remotePath(sha256: string, localPath: string, now?: Date): string {
    return githubRemotePath(this.cfg.dir, sha256, localPath, now);
  }
}

/** Legacy helper name kept for call sites that only need path layout. */
export function remotePath(
  dir: string,
  sha256: string,
  localPath: string,
  now = new Date(),
): string {
  return githubRemotePath(dir, sha256, localPath, now);
}

/** Legacy helper name kept for call sites that only need URL layout. */
export function composeUrls(
  cfg: { github: GithubConfig; url: UrlConfig },
  repoPath: string,
): HostUrls {
  return composeGithubUrls(cfg, repoPath);
}

export async function uploadAsset(
  host: HostAdapter,
  args: {
    asset: { localPath: string; sha256: string };
    bytes: Buffer;
    cfg: { upload: { commitMessage: string }; github: GithubConfig };
    now?: Date;
  },
): Promise<RemoteImage> {
  const repoPath = host.remotePath(args.asset.sha256, args.asset.localPath, args.now);
  await host.putFile(
    repoPath,
    args.bytes,
    args.cfg.upload.commitMessage,
    args.cfg.github.branch,
  );
  const urls = host.composeUrls(repoPath);
  return {
    publicUrl: urls.publicUrl,
    rawUrl: urls.rawUrl,
    cdnUrl: urls.cdnUrl,
    repoPath,
    sha256: args.asset.sha256,
  };
}

export type { HostAdapter, HostUrls } from './types.js';
