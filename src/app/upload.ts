import fs from 'node:fs';
import path from 'node:path';
import { getToken } from '../config.js';
import { createHostAdapter, hostRequiresToken, uploadAsset } from '../host/index.js';
import { sha256Hex } from '../lib/hash.js';
import type { ResolvedConfig } from '../types.js';
import { AppError, TOKEN_HINT } from './errors.js';

export interface UploadOneOptions {
  cfg: ResolvedConfig;
  /** 待上传的本地文件（相对 cwd 亦可） */
  file: string;
  cwd?: string;
}

export interface UploadOneResult {
  remotePath: string;
  publicUrl: string;
  rawUrl: string;
  cdnUrl?: string;
  hostType: string;
  sha256: string;
  bytes: number;
}

/**
 * 单文件上传（`picbed upload` 的编排入口）。
 *
 * 此前 CLI 层直接 `createHostAdapter` + `uploadAsset`，绕过应用编排层——
 * confirm 门、错误码统一、日志脱敏都被跳过。现在 CLI 只做参数与退出码。
 */
export async function uploadSingleAsset(opts: UploadOneOptions): Promise<UploadOneResult> {
  const abs = path.resolve(opts.cwd ?? process.cwd(), opts.file);
  if (!fs.existsSync(abs)) {
    throw new AppError('E_ASSET_MISSING', 'file not found', { path: abs });
  }
  const token = getToken();
  if (hostRequiresToken(opts.cfg) && !token) {
    throw new AppError(
      'E_TOKEN',
      'missing GitHub token (PICBED_GITHUB_TOKEN / GITHUB_TOKEN / GitHub CLI `gh`)',
      { hint: TOKEN_HINT },
    );
  }
  const bytes = fs.readFileSync(abs);
  const sha256 = sha256Hex(bytes);
  const host = createHostAdapter(opts.cfg, token);
  const remote = await uploadAsset(host, { asset: { localPath: abs, sha256 }, bytes, cfg: opts.cfg });
  const urls = host.composeUrls(remote.repoPath);
  return {
    remotePath: remote.repoPath,
    publicUrl: urls.publicUrl,
    rawUrl: urls.rawUrl,
    cdnUrl: urls.cdnUrl,
    hostType: host.type,
    sha256,
    bytes: bytes.length,
  };
}
