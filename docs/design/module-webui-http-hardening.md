# webui HTTP 加固设计（评审 ③：本地写接口加固）

> 归属：F16–F23 本地 Web 控制台宿主（`src/ui/server.ts`）；F24 桌面壳共用。
> 背景：2026-09-27 架构评审发现 4（见 `.agents/memory/review-findings.md`）。
> 宿主模块见 [`module-webui.md`](module-webui.md）；错误码契约见 [`module-app.md`](module-app.md)。

## 背景与问题

`picbed ui` 是本地控制台：读接口无需鉴权（本地只读数据），写接口仅靠
`body.confirm === true` 一道门。问题：

- **无 Origin/Host 校验**：任意恶意网页可向 loopback 端口发 `text/plain {"confirm":true}`
  简单请求（无需 CORS 预检）触发 sync/revert/config/watch 写操作（CSRF）；
  DNS-rebinding（攻击域名解析到 127.0.0.1）同样绕过同源直觉。
- **`readBody` 无上限**：`req.on('data')` 全量缓冲 → 内存 DoS。
- **不看 Content-Type 直接 `JSON.parse`**：契约松弛，错误信息对调用方不友好。
- 错误码默认落 500（评审发现 6 的语义模糊点）在新代码上继续复制。

## 威胁模型与非目标

**在范围**：用户浏览器中打开的任意网页试图触发本机控制台的写操作或耗尽其内存；
SPA 自身的合法请求必须全形态通过（浏览器 `picbed ui`、Electron 壳、LAN 显式绑定）。

**不在范围**：

- 已有本地 shell/文件系统权限的进程（它们可直接读写工作区，网络层挡不住，也不该挡）；
- 服务发现/权限系统、鉴权登录、HTTPS（loopback 明文可接受）；
- LAN 暴露：`--host` 非 loopback 绑定是带警告的显式用户选择（cli.ts），不禁止，但
  Origin 规则必须让 LAN 模式下 SPA 自身请求合法通过。

## 方案：同源 Origin + 自定义头 + 请求体三件套

### 决策表

| # | 决策 | 规则 | 违例响应 |
|---|------|------|----------|
| 1 | **同源 Origin 校验**（全部 `/api/*`） | 请求带 `Origin` 头时，其 host:port 必须等于 `Host` 头的 host:port（scheme 仅允许 http/https）；`Origin: null` 视为违例。Origin 缺失（curl 等非浏览器客户端）放行 | 403 `E_ORIGIN` |
| 2 | **POST 必需自定义头**（全部 POST `/api/*`） | 必须带 `X-Picbed-UI: 1`。跨源网页无法发送自定义头：触发 CORS 预检，而服务器从不返回 `Access-Control-Allow-*`，预检失败，浏览器不发实际请求 | 403 `E_HEADER` |
| 3 | **Content-Type 校验**（全部 POST `/api/*`） | 必须为 `application/json`（允许 `; charset=` 参数）；不解析 body 的路由（如 session/reset）同规则，保持均匀 | 415 `E_CONTENT_TYPE` |
| 4 | **请求体大小上限（两道）** | ① 守卫在路由前预检 `Content-Length` > 64 KiB → 直接 413（覆盖 session/reset 等不读体的路由）；② `readBody` 累计超限 → 413，剩余数据 `resume()` 丢弃保证响应可送达 | 413 `E_BODY_TOO_LARGE` |
| 5 | **Host 头必须存在、可解析且须指名绑定地址** | 缺失/不可解析 → 400；hostname 必须 ∈ {绑定地址, localhost}（IPv6 归一去括号）；`0.0.0.0`/`::` 通配绑定为例外：不限制（显式全网暴露，LAN 场景，已在 cli 警告） | 400 `E_USAGE` / 403 `E_HOST` |
| 6 | **新错误码显式映射 HTTP 状态** | `E_ORIGIN`/`E_HEADER`/`E_HOST` → 403，`E_CONTENT_TYPE` → 415，`E_BODY_TOO_LARGE` → 413，在 `src/app/errors.ts` 的 `httpStatusForCode` 显式分支（先于 exitCode 派生）；`exitCodeForCode` 归入 `EXIT.USAGE` | — |
| 7 | **服务器永不输出 CORS 头** | 不返回 `Access-Control-Allow-Origin/Headers`；预检 OPTIONS 无特殊处理：跨源预检先被 Origin 守卫 403，同源 OPTIONS 落到 404 未知路由 | — |

**均匀性优先**：规则对全部 POST 路由一刀切（session/reset、bind-root、drop、scan、plan、
sync、config、doctor、revert、watch/start、watch/stop），不按"是否写盘"分层——分层是
漂移温床（评审发现 1/2 的教训），且 scan/plan/doctor 本身也可能被滥用为资源消耗入口。

### 为什么"同源相等"而不是 loopback 白名单

- Electron 壳（`desktop/main.mjs`）经 `loadURL(http://127.0.0.1:<ephemeral>)` 加载，
  浏览器 dev 用 `--port`（默认 4780），LAN 模式是 `<主机IP>:<port>` —— 三者唯一共同的
  合法形态是"**页面与服务器同源**"，即 Origin host:port == Host host:port。相等比较
  一次覆盖全部绑定形态，也天然免疫 DNS-rebinding（rebind 后 Origin host ≠ Host host）。
- 用户此前标注的拍板点（Origin allowlist 与 Electron 壳交互）：**以同源相等替代固定
  白名单**，不需要维护端口/IP 清单，Electron 与 LAN 行为无需特判。
- 单独的同源相等挡不住 DNS-rebinding：攻击页origin与Host同为 `attacker.com:<port>` 时
  相等比较会放行。因此叠加 Host 规则（决策 5）：浏览器可达的前提是 Host 必须指名绑定
  地址，rebind 后的 `attacker.com` Host 直接被 403，无需维护"合法域名"清单。

### SPA 与测试适配

- `renderer/main.js` 的 `api()` 是唯一 fetch 出口：加 `X-Picbed-UI: 1` 头（一处修改，
  全部 20+ 调用点生效）。Electron 内 Chromium fetch 同源发 Origin 与自定义头无额外限制。
- `tests/ui.test.ts` / `tests/ui-panels.test.ts` 的 POST 调用统一过测试侧 helper 补头；
  新增负例：跨源 Origin 403、缺头 403、错 Content-Type 415、超限体 413、畸形 Host 400、
  静态资源与 GET 路由不受自定义头影响。
- `tests/desktop.test.ts` 无 POST 调用面时不改（实现期核实）。

### 不变量

- loopback 默认绑定不变；`--host`/`--port` 语义不变；`desktop/main.mjs` 零改动；
- CLI / MCP 不走 HTTP，完全不受影响；
- ConfirmGate（`confirm: true`）保留：本设计是网络层防线，确认门是语义层防线，二者正交；
- JSON envelope 契约（`schemaVersion`/`ok`/`error.code`）不变，新错误码沿用同一 envelope。

## 验证

- 新增负例测试全部失败→实现后转绿（先红后绿，含 413 断连用例）；
- `npm test` 全绿、`npm run lint` 干净、`npm run build` 通过；
- 浏览器实测：页面功能（扫描/计划/同步 dry-run）正常，且从 Console 伪造跨源 POST
  被 403 拒绝。

## 实现期修订记录

- 决策 4 改为两道上限（`Content-Length` 路由前预检 + `readBody` 累计）：原单道方案在
  `session/reset`（不读请求体）上失效——超限体不触发任何读取。预检覆盖全部 POST 路由。
- 新增决策 5 的 Host 指名绑定地址规则（403 `E_HOST`）：先写实现时发现同源相等单独
  存在 DNS-rebinding 缺口（攻击者同时控制 Host 与 Origin），按"实现前必须先改设计"
  回补设计，错误码随之增加 `E_HOST`。
