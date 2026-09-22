import fs from 'node:fs';
import path from 'node:path';
import type { LocalHostConfig, UrlConfig } from '../types.js';
import type { HostAdapter, HostUrls } from './types.js';

export function localRemotePath(
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

/** Non-GitHub backend (F13): filesystem root + public base URL. */
export class LocalHostAdapter implements HostAdapter {
  readonly type = 'local';
  readonly requiresToken = false;

  constructor(
    private readonly cfg: LocalHostConfig,
    private readonly url: UrlConfig,
    private readonly baseDir: string = process.cwd(),
  ) {}

  private abs(repoPath: string): string {
    const root = path.resolve(this.baseDir, this.cfg.root);
    const abs = path.resolve(root, repoPath);
    const rel = path.relative(root, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw Object.assign(new Error(`path escapes host root: ${repoPath}`), {
        code: 'E_LOCAL',
      });
    }
    return abs;
  }

  async exists(repoPath: string): Promise<boolean> {
    return fs.existsSync(this.abs(repoPath));
  }

  async putFile(repoPath: string, bytes: Buffer): Promise<void> {
    const abs = this.abs(repoPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, bytes);
  }

  composeUrls(repoPath: string): HostUrls {
    const base = (this.cfg.publicBase || 'https://cdn.example.com').replace(/\/+$/, '');
    const rawUrl = `${base}/${repoPath.replace(/^\/+/, '')}`;
    let publicUrl = rawUrl;
    if (this.url.style === 'custom' && this.url.customTemplate) {
      publicUrl = this.url.customTemplate
        .replace('{path}', repoPath)
        .replace('{owner}', '-')
        .replace('{repo}', '-')
        .replace('{branch}', '-');
    }
    return { publicUrl, rawUrl };
  }

  remotePath(sha256: string, localPath: string, now?: Date): string {
    return localRemotePath(this.cfg.dir || 'img', sha256, localPath, now);
  }
}
