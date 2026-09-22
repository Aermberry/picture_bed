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
  try {
    const out = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
      windowsHide: true,
    });
    const token = out.trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}
