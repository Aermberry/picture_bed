import { getToken } from '../config.js';
import { probeGhToken, spawnGhLogin } from '../infra/gh-cli.js';
import { clearUserToken, writeUserToken } from '../user-token.js';

/**
 * 鉴权 façade：UI / CLI 只允许从这里取用 token 与 gh 登录能力，
 * 不得直接 import `config.ts` / `user-token.ts` / `infra/gh-cli.ts`
 * （此前 `ui/server.ts` 三处直连，绕过了应用编排层）。
 */

/** 当前生效 token（env → 本机凭据 → gh CLI）。 */
export function currentToken(): string | undefined {
  return getToken();
}

/** 保存/清除本机凭据（~/.picbed/credentials.json，不写 picbed.toml）。 */
export function saveUserToken(token: string): void {
  writeUserToken(token);
}

export function clearSavedToken(): void {
  clearUserToken();
}

/** 探测 gh CLI 是否可用 / 是否已登录。 */
export function probeGh(): { token?: string; reason?: string; message?: string } {
  return probeGhToken();
}

/** 启动 `gh auth login`；返回 promise + 取消句柄，由调用方（UI）管理会话状态。 */
export function startGhLogin(onChunk: (chunk: string) => void): {
  promise: Promise<void>;
  process: ReturnType<typeof spawnGhLogin>['process'];
} {
  return spawnGhLogin(onChunk);
}
