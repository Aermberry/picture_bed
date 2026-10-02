/**
 * 唯一 fetch 出口：统一带 X-Picbed-UI 头（服务端 /api 加固要求）。
 * @param {string} path
 * @param {any=} body
 * @param {string=} method
 */
export async function api(path, body, method) {
  const res = await fetch(path, {
    method: method || (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", "X-Picbed-UI": "1" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}
