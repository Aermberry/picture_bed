# webui HTTP 加固设计（本地写接口）

> 归属：F16–F23 本地 Web 控制台宿主（`src/ui/server.ts`）；F24 桌面壳共用。
> 宿主模块见 [`module-webui.md`](module-webui.md)；错误码契约见 [`module-app.md`](module-app.md)。

## 背景与问题

本地控制台的读接口无需鉴权，写接口保留 `confirm: true` 语义门。仅靠确认门无法阻止恶意网页构造 `text/plain` 简单请求；无请求体上限会使全量缓冲导致内存耗尽；不校验 Content-Type 会放宽 JSON 契约并产生含糊错误。

## 威胁模型与非目标

保护用户打开本机控制台时，任意网页对本机 API 发起跨源写请求或大请求体；合法 SPA 请求须在 Electron、浏览器及显式 LAN 绑定模式下工作。

- 不防已有本地 shell/文件系统权限的进程；它们可直接操作工作区。
- 不提供服务发现、登录鉴权或 HTTPS；loopback 明文可接受。
- LAN 绑定是带警告的显式选择；Origin / Host 规则仍须允许合法 SPA 同源请求。

## 方案：同源 Origin + 自定义头 + 请求体三件套

| 防线 | 当前规则 | 拒绝语义 |
|---|---|---|
| Origin + Host | 所有 `/api/*` 的 Origin 若存在，必须是 http/https 且 host:port 与 Host 相等；`Origin: null` 拒绝，缺 Origin 的非浏览器客户端放行。Host 必须可解析且指向绑定地址或 localhost；通配绑定例外。 | `E_ORIGIN` / `E_HOST` → 403；非法 Host → 400 |
| POST 自定义头 | 所有 `POST /api/*` 必须带 `X-Picbed-UI: 1`。服务器不返回 CORS 许可头，跨源预检失败后浏览器不会发送实际请求。 | `E_HEADER` → 403 |
| JSON 请求体 | 所有 POST 必须为 `application/json`（可带 charset）；`Content-Length` 预检与 `readBody` 累计均限制 64 KiB，超限 drain 剩余流以送达响应。 | `E_CONTENT_TYPE` → 415；`E_BODY_TOO_LARGE` → 413 |

Origin 与 Host 相等覆盖 Electron、本机浏览器和 LAN 页面；Host 必须匹配绑定地址，阻断 DNS rebinding 使用攻击域名作为 Host。规则对所有 POST 一致执行，包括不读 body 的路由；ConfirmGate 仍作为独立语义防线。服务器不发 `Access-Control-Allow-*`，不单独放行 OPTIONS。

### 客户端与错误映射

- `renderer/src/lib/api.js` 的统一 `api()` 出口添加 `X-Picbed-UI: 1`。生产页面直连 UI 服务，Origin 与 Host 同源；桌面开发代理将 Origin 改写为 API 目标源，保持服务端规则不变。
- 所有 guard 错误仍使用 `api.*` JSON 信封；`httpStatusForCode` 显式映射 `E_ORIGIN` / `E_HEADER` / `E_HOST` → 403、`E_CONTENT_TYPE` → 415、`E_BODY_TOO_LARGE` → 413；这些错误归入 usage 退出码语义。
- 新路由一律经过 `server.ts` 的统一 guard，不得按是否写盘拆分 POST 规则；读接口和静态资源不要求自定义头。

## 验证

- `npm test`：跨源 Origin、缺自定义头、错 Content-Type、超限体、畸形 Host 拒绝；静态资源与 GET 不受 POST 头限制。
- `npm run lint`、`npm run build`：静态检查与构建。
- 浏览器实测：SPA 扫描 / 计划 / dry-run 正常；伪造跨源 POST 被拒绝。
