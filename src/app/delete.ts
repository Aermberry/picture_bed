import fs from 'node:fs';
import path from 'node:path';
import { createHostAdapter, hostRequiresToken } from '../host/index.js';
import { loadManifest, saveManifest } from '../manifest.js';
import { revertDoc, writeDocAtomic } from '../rewrite.js';
import { scanDocs } from '../scan.js';
import type { ResolvedConfig } from '../types.js';
import { AppError, TOKEN_HINT } from './errors.js';
import { newRunId, recordRun } from './run-store.js';

export interface DeleteResult {
  ok: boolean;
  dryRun: boolean;
  sha256: string;
  deletedRemote: boolean;
  remotePath: string;
  planned: string[];
  reverted: string[];
  errors: string[];
  errorCode?: 'E_NOT_FOUND' | 'E_TOKEN' | 'E_MANIFEST_CORRUPT' | 'E_LOCAL' | 'E_PARTIAL';
  runId: string;
}

/**
 * 从 manifest 条目的 publicUrl 反推远端 repoPath（删除用，远端真实位置）。
 * publicUrl 是上传时由 composeUrls 写下的 ground truth，比按 remotePath 重算更稳（不随 cfg.dir 漂移）。
 */
export function deriveRepoPath(cfg: ResolvedConfig, publicUrl: string): string {
  if (cfg.host.type === 'local') {
    const base = (cfg.local.publicBase || '').replace(/\/+$/, '');
    if (!publicUrl.startsWith(base + '/')) {
      throw Object.assign(
        new Error(`publicUrl not under local publicBase: ${publicUrl}`),
        { code: 'E_LOCAL' },
      );
    }
    return publicUrl.slice(base.length + 1).replace(/^\/+/, '');
  }
  const { owner, repo, branch } = cfg.github;
  const style = cfg.url.style;
  if (style === 'custom' && cfg.url.customTemplate) {
    const esc = cfg.url.customTemplate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const body = esc
      .replace(/\\\{path\\\}/g, '(\\S+)')
      .replace(/\\\{owner\\\}/g, owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .replace(/\\\{repo\\\}/g, repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .replace(/\\\{branch\\\}/g, branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const m = new RegExp('^' + body + '$').exec(publicUrl);
    if (m) return decodeURIComponent(m[1]);
    throw Object.assign(new Error(`cannot derive repoPath (custom): ${publicUrl}`), {
      code: 'E_LOCAL',
    });
  }
  const prefix =
    style === 'jsdelivr'
      ? `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/`
      : `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`;
  if (!publicUrl.startsWith(prefix)) {
    throw Object.assign(new Error(`cannot derive repoPath: ${publicUrl}`), {
      code: 'E_LOCAL',
    });
  }
  return publicUrl
    .slice(prefix.length)
    .split('/')
    .map((s) => decodeURIComponent(s))
    .join('/');
}

/**
 * 删除一张已上传图片（F25）：删远端图床资产 → 回写文档引用回本地路径 → 清 manifest。
 * 存储引用级记录仍由 revert/skip-cache 依赖；这里只删该 sha 的全部条目。
 * dryRun 只列计划（哪个远端路径、哪些文档将被回写），不写盘、不触远端。
 */
export async function runDelete(opts: {
  root: string;
  cfg: ResolvedConfig;
  cwd: string;
  sha256: string;
  dryRun: boolean;
  getToken: () => string | undefined;
  command?: string;
}): Promise<DeleteResult> {
  const { root, cfg, cwd, sha256, dryRun, getToken, command = 'delete' } = opts;
  const startedAt = new Date().toISOString();
  const runId = newRunId();
  const errors: string[] = [];
  const reverted: string[] = [];
  const planned: string[] = [];

  const fail = (code: DeleteResult['errorCode'], message: string): DeleteResult => {
    recordRun(cwd, {
      id: runId,
      command: dryRun ? `${command}.dryRun` : command,
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: false,
      counts: {},
      errors: [message],
      errorCode: code,
    });
    return {
      ok: false,
      dryRun,
      sha256,
      deletedRemote: false,
      remotePath: '',
      planned,
      reverted,
      errors: [message],
      errorCode: code,
      runId,
    };
  };

  if (!sha256) return fail('E_NOT_FOUND', 'empty sha256');

  let manifest;
  try {
    manifest = loadManifest(cwd);
  } catch (err) {
    return fail('E_MANIFEST_CORRUPT', String(err));
  }

  const entries = manifest.entries.filter((e) => e.sha256 === sha256);
  if (!entries.length) return fail('E_NOT_FOUND', `no manifest entries for sha256 ${sha256}`);

  const token = getToken();
  if (hostRequiresToken(cfg) && !token) {
    throw new AppError(
      'E_TOKEN',
      'missing GitHub token (PICBED_GITHUB_TOKEN / GITHUB_TOKEN / GitHub CLI `gh`)',
      { hint: TOKEN_HINT },
    );
  }

  let remotePath = '';
  try {
    remotePath = deriveRepoPath(cfg, entries[0].publicUrl);
  } catch (err) {
    return fail('E_LOCAL', `derive repoPath: ${String(err)}`);
  }

  // 计划：哪些文档会被回写（复用 scanDocs，与 runRevert 同口径）
  const docs = scanDocs(root, cfg.scan);
  for (const doc of docs) {
    const has = entries.some((e) => path.resolve(cwd, e.doc) === doc.path);
    if (!has) continue;
    planned.push(path.relative(cwd, doc.path).split(path.sep).join('/'));
  }

  if (dryRun) {
    recordRun(cwd, {
      id: runId,
      command: `${command}.dryRun`,
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: true,
      counts: { planned: planned.length },
    });
    return {
      ok: true,
      dryRun: true,
      sha256,
      deletedRemote: false,
      remotePath,
      planned,
      reverted,
      errors,
      runId,
    };
  }

  // 1) 删远端资产（幂等：远端已不在视为成功）
  let deletedRemote = false;
  try {
    const host = createHostAdapter(cfg, token);
    await host.deleteFile(
      remotePath,
      '',
      cfg.upload.commitMessage,
      cfg.host.type === 'github' ? cfg.github.branch : '',
    );
    deletedRemote = true;
  } catch (err) {
    errors.push(`remote delete: ${String(err)}`);
  }

  // 2) 回写文档引用回本地路径（复用 revertDoc）
  for (const doc of docs) {
    const docEntries = entries.filter((e) => path.resolve(cwd, e.doc) === doc.path);
    if (!docEntries.length) continue;
    const rel = path.relative(cwd, doc.path).split(path.sep).join('/');
    try {
      const text = fs.readFileSync(doc.path, 'utf8');
      const next = revertDoc(text, docEntries);
      if (next === text) continue;
      writeDocAtomic(doc.path, next);
      reverted.push(rel);
    } catch (err) {
      errors.push(`${rel}: ${String(err)}`);
    }
  }

  // 3) 清 manifest 中该 sha 的全部条目（仅当远端删除成功或文档已回写）
  if (deletedRemote || reverted.length) {
    manifest.entries = manifest.entries.filter((e) => e.sha256 !== sha256);
    try {
      saveManifest(cwd, manifest);
    } catch (err) {
      errors.push(`manifest save: ${String(err)}`);
    }
  }

  const ok = errors.length === 0;
  const errorCode: DeleteResult['errorCode'] = ok ? undefined : 'E_PARTIAL';
  recordRun(cwd, {
    id: runId,
    command,
    startedAt,
    finishedAt: new Date().toISOString(),
    ok,
    counts: {
      deleted: deletedRemote ? 1 : 0,
      reverted: reverted.length,
      planned: planned.length,
      failed: errors.length,
    },
    errors,
    errorCode,
  });

  return {
    ok,
    dryRun,
    sha256,
    deletedRemote,
    remotePath,
    planned,
    reverted,
    errors,
    errorCode,
    runId,
  };
}
