import crypto from 'node:crypto';

/** sha256 的唯一实现（原 `resolve.ts` / `app/sync.ts` / `cli.ts` 各一份） */
export function sha256Hex(data: crypto.BinaryLike): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** 远端文件名用的 12 位短摘要（原 `host/github.ts` 与 `host/local.ts` 各一份 slice） */
export function sha12(sha256: string): string {
  return sha256.slice(0, 12);
}
