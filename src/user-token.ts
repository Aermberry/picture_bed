import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * 本机用户级 PAT 存储（不进 git、不写 picbed.toml）。
 * 路径：~/.picbed/credentials.json
 */
export function userTokenPath(): string {
  const override = process.env.PICBED_USER_TOKEN_PATH;
  if (override) return path.resolve(override);
  return path.join(os.homedir(), '.picbed', 'credentials.json');
}

export function readUserToken(): string | undefined {
  try {
    const file = userTokenPath();
    if (!fs.existsSync(file)) return undefined;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as { token?: unknown };
    const token = typeof raw.token === 'string' ? raw.token.trim() : '';
    return token || undefined;
  } catch {
    return undefined;
  }
}

export function writeUserToken(token: string): void {
  const file = userTokenPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ token }, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function clearUserToken(): void {
  const file = userTokenPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
