import { createHostAdapter } from '../host/index.js';
import type { ResolvedConfig } from '../types.js';
import { AppError, asAppError, TOKEN_HINT } from './errors.js';

/** GitHub has no empty-directory API: a dir exists remotely once it holds a file. */
export const DIR_PLACEHOLDER = '.gitkeep';

const MAX_DIR_PATH_LEN = 200;
/** Letters, digits, `_ . -` and CJK; keeps remote paths safe and URL-friendly. */
const SEGMENT_RE = /^[A-Za-z0-9._\-\u4e00-\u9fff]+$/;

export interface CreateRepoDirOptions {
  cfg: ResolvedConfig;
  getToken: () => string | undefined;
  /** Relative repo path of the directory to create, e.g. `img/2026/10`. */
  path: string;
  confirm: boolean;
}

export interface CreateRepoDirResult {
  path: string;
  placeholder: string;
  /** false when the directory already exists (idempotent, nothing committed). */
  created: boolean;
}

/**
 * Normalize a user-supplied remote directory path.
 * Root is `''`; anything else must be slash-separated safe segments without traversal.
 */
export function normalizeRepoDirPath(input: string): string {
  const raw = (input ?? '').trim();
  if (!raw) return '';
  if (raw.includes('\\') || /^[A-Za-z]:/.test(raw)) {
    throw new AppError('E_BAD_REQUEST', '目录路径不支持反斜杠或盘符，请使用 / 分隔的相对路径', {
      path: raw,
    });
  }
  if (raw.includes('\0')) {
    throw new AppError('E_BAD_REQUEST', '目录路径含非法字符', { path: raw });
  }
  const cleaned = raw.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!cleaned) return '';
  if (cleaned.length > MAX_DIR_PATH_LEN) {
    throw new AppError('E_BAD_REQUEST', `目录路径过长（上限 ${MAX_DIR_PATH_LEN} 字符）`, {
      path: raw,
    });
  }
  const segments = cleaned.split('/');
  for (const seg of segments) {
    if (!seg) {
      throw new AppError('E_BAD_REQUEST', '目录路径含空层级（连续或多余的 /）', { path: raw });
    }
    if (seg === '.' || seg === '..') {
      throw new AppError('E_BAD_REQUEST', '目录路径不允许 . 或 ..（越界）', { path: raw });
    }
    if (!SEGMENT_RE.test(seg)) {
      throw new AppError('E_BAD_REQUEST', `目录名含不受支持的字符：${seg}`, { path: raw });
    }
  }
  return segments.join('/');
}

/** Parent of a normalized remote path; `''` for top-level, `null` for root. */
export function parentDirPath(normalized: string): string | null {
  if (!normalized) return null;
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? '' : normalized.slice(0, idx);
}

/**
 * Create a remote directory by committing an empty `.gitkeep` placeholder.
 * Idempotent: an existing directory returns `created: false` without a commit.
 */
export async function createRepoDir(opts: CreateRepoDirOptions): Promise<CreateRepoDirResult> {
  const { cfg, getToken, confirm } = opts;
  if (confirm !== true) {
    throw new AppError(
      'E_CONFIRM',
      'creating a remote directory commits to the repository; set confirm: true',
    );
  }
  const { owner, repo, branch } = cfg.github;
  if (!owner || !repo) {
    throw new AppError('E_CONFIG', '请先在设置中配置 github.owner / github.repo');
  }
  const token = getToken();
  if (!token) {
    throw new AppError('E_TOKEN', 'missing GitHub token (PICBED_GITHUB_TOKEN / GITHUB_TOKEN / GitHub CLI `gh`)', {
      hint: TOKEN_HINT,
    });
  }

  const target = normalizeRepoDirPath(opts.path);
  if (!target) {
    throw new AppError('E_BAD_REQUEST', '目录名不能为空（仓库根目录无需创建）');
  }

  // 经端口工厂取适配器，不再绑死 GitHub 实现；目录能力是可选能力
  const adapter = createHostAdapter(cfg, token);
  if (typeof adapter.entryType !== 'function') {
    throw new AppError('E_CONFIG', `当前后端（${adapter.type}）不支持目录能力`);
  }

  const existing = await adapter.entryType(target);
  if (existing === 'file') {
    throw new AppError('E_CONFLICT', `同名路径已存在且是文件：${target}`, { path: target });
  }
  if (existing === 'dir') {
    return { path: target, placeholder: DIR_PLACEHOLDER, created: false };
  }

  const parent = parentDirPath(target);
  if (parent !== null) {
    const parentType = await adapter.entryType(parent);
    if (parentType === 'file') {
      throw new AppError('E_CONFLICT', `父路径是文件，无法在其下建目录：${parent}`, { path: target });
    }
    if (parentType === null) {
      throw new AppError('E_NOT_FOUND', `父目录不存在：${parent || '/'}`, { path: target });
    }
  }

  try {
    await adapter.putFile(
      `${target}/${DIR_PLACEHOLDER}`,
      Buffer.from(''),
      `chore(picbed): create directory ${target}`,
      branch,
    );
  } catch (err) {
    const e = asAppError(err, 'E_REMOTE');
    throw new AppError(e.code === 'E_GENERAL' ? 'E_REMOTE' : e.code, e.message, {
      path: target,
      hint: e.hint,
    });
  }
  return { path: target, placeholder: DIR_PLACEHOLDER, created: true };
}
