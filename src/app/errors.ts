import { EXIT, type ExitCode } from '../types.js';

export interface AppErrorInit {
  path?: string;
  hint?: string;
  exitCode?: ExitCode;
}

export class AppError extends Error {
  readonly code: string;
  readonly exitCode: ExitCode;
  readonly path?: string;
  readonly hint?: string;

  constructor(code: string, message: string, init: AppErrorInit = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.exitCode = init.exitCode ?? exitCodeForCode(code);
    this.path = init.path;
    this.hint = init.hint;
  }
}

/** code → 退出码唯一来源；HTTP 状态码由退出码语义派生。见 docs/design/module-app.md。 */
const EXIT_BY_CODE: Record<string, ExitCode> = {
  E_CONFIRM: EXIT.CONFIRM,
  E_TOKEN: EXIT.CONFIG,
  E_AUTH: EXIT.CONFIG,
  E_CONFIG: EXIT.CONFIG,
  E_DOCTOR: EXIT.CONFIG,
  E_USAGE: EXIT.USAGE,
  E_STYLE: EXIT.USAGE,
  E_EXISTS: EXIT.USAGE,
  E_PORT: EXIT.USAGE,
  EADDRINUSE: EXIT.USAGE,
  E_LOCAL: EXIT.LOCAL,
  E_ROOT: EXIT.LOCAL,
  E_NO_ROOT: EXIT.LOCAL,
  E_ASSET_MISSING: EXIT.LOCAL,
  E_DOC_EXT: EXIT.LOCAL,
  E_MANIFEST_CORRUPT: EXIT.LOCAL,
  E_REMOTE: EXIT.REMOTE,
  E_PARTIAL: EXIT.PARTIAL,
};

export function exitCodeForCode(code: string | undefined): ExitCode {
  if (!code) return EXIT.OK;
  const known = EXIT_BY_CODE[code];
  if (known !== undefined) return known;
  if (code.startsWith('E_PATH')) return EXIT.LOCAL;
  return EXIT.GENERAL;
}

export function httpStatusForCode(code: string | undefined): number {
  if (!code) return 200;
  if (code === 'E_TOKEN' || code === 'E_AUTH') return 401;
  switch (exitCodeForCode(code)) {
    case EXIT.CONFIRM:
      return 409;
    case EXIT.CONFIG:
    case EXIT.USAGE:
    case EXIT.LOCAL:
      return 400;
    case EXIT.REMOTE:
      return 502;
    case EXIT.PARTIAL:
      return 207;
    default:
      return 500;
  }
}

export function asAppError(err: unknown, fallbackCode = 'E_GENERAL'): AppError {
  if (err instanceof AppError) return err;
  const e: { code?: string; message?: string; path?: string; hint?: string } =
    typeof err === 'object' && err !== null ? (err as typeof e) : {};
  return new AppError(e.code ?? fallbackCode, e.message ?? String(err), {
    path: e.path,
    hint: e.hint,
  });
}

/** PAT / GitHub CLI 获取指引；CLI 与 Web 共用同一份文案。 */
export const TOKEN_HINT = [
  'How to authenticate GitHub uploads (pick one of 2 ways):',
  '  1) Use a Personal Access Token (PAT) — easiest if you do not have GitHub CLI:',
  '     - Create at https://github.com/settings/tokens (classic) or fine-grained tokens',
  '     - Need repo (or Contents read/write) on the image-bed repository',
  '     - PowerShell:  $env:PICBED_GITHUB_TOKEN = "<your token>"',
  '     - bash:        export PICBED_GITHUB_TOKEN=<your token>',
  '     - Same PAT may also be put in GITHUB_TOKEN instead (alternate env name).',
  '  2) Reuse GitHub CLI (the `gh` command — official GitHub CLI, not git itself):',
  '     - Install: https://cli.github.com/  then run:  gh auth login',
  '     - picbed will call `gh auth token` automatically',
].join('\n');
