import { execFileSync } from 'node:child_process';

/**
 * Token sources (no OAuth App):
 * 1. PICBED_GITHUB_TOKEN
 * 2. GITHUB_TOKEN
 * 3. GitHub CLI (`gh`) — official "GitHub CLI" app; `gh auth token` reuses its login
 */
export function resolveToken(
  env: NodeJS.ProcessEnv = process.env,
  execGhToken: () => string | undefined = defaultGhToken,
): { token: string; source: 'env' | 'gh' } | undefined {
  const envToken = env.PICBED_GITHUB_TOKEN || env.GITHUB_TOKEN;
  if (envToken) return { token: envToken, source: 'env' };
  const gh = execGhToken();
  if (gh) return { token: gh, source: 'gh' };
  return undefined;
}

export function defaultGhToken(): string | undefined {
  return probeGhToken().token;
}

/**
 * gh 登录态探测：区分「未安装 / 未登录 / 其它错误」，便于 UI 给出可执行建议。
 */
export function probeGhToken(): {
  token?: string;
  reason?: 'not-installed' | 'not-logged-in' | 'failed';
  message?: string;
} {
  // Windows ships gh as gh.cmd — bare "gh" is ENOENT for execFileSync
  const bin = process.platform === 'win32' ? 'gh.cmd' : 'gh';
  try {
    const out = execFileSync(bin, ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
      windowsHide: true,
    });
    const token = out.trim();
    if (token) return { token };
    return {
      reason: 'not-logged-in',
      message: 'gh 已安装但未登录：请在终端运行 `gh auth login` 后重试',
    };
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    const notFound =
      e.code === 'ENOENT' ||
      /not found|not recognized|ENOENT/i.test(String(e.message || ''));
    if (notFound) {
      return {
        reason: 'not-installed',
        message:
          '未检测到 GitHub CLI（gh）。请安装：https://cli.github.com/ 后运行 `gh auth login`；或设置环境变量 PICBED_GITHUB_TOKEN / GITHUB_TOKEN',
      };
    }
    return {
      reason: 'failed',
      message: 'gh auth token 失败：' + (e.message || String(err)),
    };
  }
}
