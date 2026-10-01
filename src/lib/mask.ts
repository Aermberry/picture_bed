/**
 * token 掩码的唯一实现（从 `config.ts` 迁出，供 app 层与 ui 层共用）。
 * 此前 `ui/server.ts` 硬编码一串与此处不一致的掩码字符，已统一。
 */
export function maskToken(token: string | undefined): string {
  if (!token) return '';
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '****';
}
