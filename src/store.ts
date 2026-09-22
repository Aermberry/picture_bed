import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface StoredCredentials {
  token: string;
  tokenType?: string;
  scope?: string;
  source: 'oauth' | 'pat';
  updatedAt: string;
}

export function credentialsPath(): string {
  const dir =
    process.env.PICBED_CONFIG_HOME ||
    path.join(os.homedir(), '.config', 'picbed');
  return path.join(dir, 'credentials.json');
}

export function loadCredentials(): StoredCredentials | undefined {
  const p = credentialsPath();
  if (!fs.existsSync(p)) return undefined;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8')) as StoredCredentials;
    if (!data?.token) return undefined;
    return data;
  } catch {
    return undefined;
  }
}

export function saveCredentials(cred: StoredCredentials): string {
  const p = credentialsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cred, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  try {
    fs.chmodSync(p, 0o600);
  } catch {
    // Windows may not support POSIX mode; file still user-profile scoped
  }
  return p;
}

export function clearCredentials(): boolean {
  const p = credentialsPath();
  if (!fs.existsSync(p)) return false;
  fs.rmSync(p);
  return true;
}

/** Env PAT wins over stored OAuth token. */
export function resolveToken(
  env: NodeJS.ProcessEnv = process.env,
): { token: string; source: 'env' | 'oauth' } | undefined {
  const envToken = env.PICBED_GITHUB_TOKEN || env.GITHUB_TOKEN;
  if (envToken) return { token: envToken, source: 'env' };
  const stored = loadCredentials();
  if (stored?.token) return { token: stored.token, source: 'oauth' };
  return undefined;
}
