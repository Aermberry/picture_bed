import { asAppError, httpStatusForCode } from '../../app/index.js';
import { envelope } from './envelope.js';

/** 未捕获异常 → HTTP 状态码 + 统一信封（状态码由 app/errors.ts 唯一真源派生）。 */
export function sendAppError(
  send: (status: number, body: unknown) => void,
  err: unknown,
  command = 'api.error',
): void {
  const e = asAppError(err);
  send(
    httpStatusForCode(e.code),
    envelope(false, command, undefined, {
      code: e.code,
      message: e.message,
      path: e.path,
      hint: e.hint,
    }),
  );
}
