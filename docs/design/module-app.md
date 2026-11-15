# app 模块设计

> 归属功能点：跨限界上下文共享应用层，不新增 F、不改 AC；服务 Web/桌面呈现（F16–F25）。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；全局契约见 [`cross-cutting.md`](cross-cutting.md)。

## 目的与边界

app 将 scan / plan / sync / revert / doctor / config 的编排收敛为唯一实现，呈现层只做协议适配；抽取、上传、回写与去重仍分别以 ingest、transfer、rewrite 为权威。

- 零呈现依赖：不 import `node:http`、不读写 `process.argv`、不渲染 HTML。
- WebUI 不复制编排逻辑；`ui/` 不直连 host、infra 或 config，统一经 app 门面调用。
- 呈现层不得直接 `createHostAdapter` / `uploadAsset`；所有写操作由 app 入口编排。
- `AppError { code, exitCode, path?, hint? }` 是错误单一来源；HTTP 状态由错误映射派生，信封 `error.code` 为准。
- Token 仅经注入的 `getToken()` 读取；RunRecord、warnings、errors 不含 secret。确认门留在呈现层，写服务不接收确认参数。
- 配置与鉴权防腐层：`settings.ts` 负责 `resolvedConfig`、配置键读写与校验、TOML 导入/序列化；`auth.ts` 负责 token 读取/保存/清除、GitHub 探测与登录。
- RunRecord 由 `run-store.ts` 函数式仓库读写，不是类。

实现落点：`src/app/{index,errors,collect,plan,sync,revert,doctor,settings,auth,run-store,repo-dir,stats,upload}.ts`。

## 数据契约

- `AppError { code, exitCode, path?, hint? }`；未知 code 保留原值，退出码回落 `EXIT.GENERAL`。
- `CollectResult` 汇集文档、按文档索引、资产、blocked、remoteSkips 与 warnings。
- `runSync` 结果包含上传/回写结果、错误、warnings、partial、errorCode 与 runId；审计写入不含 token。
- `RunRecord` 存于 `./.picbed/runs/*.json`，记录命令、时间、结果与计数等运行审计信息。

## 错误映射（单一来源）

| code | 含义 | 退出码 | HTTP |
|------|------|------|------|
| `E_CONFIRM` | 缺确认 | 7 | 409 |
| `E_TOKEN` / `E_AUTH` | 缺 token / 鉴权失败 | 3 | 401 |
| `E_CONFIG` | 配置不完整（如 `github.owner/repo` 缺失） | 3 | 400 |
| `E_USAGE` / `E_STYLE` | 用法 / 枚举非法 | 2 | 400 |
| `E_NO_ROOT` / `E_ROOT` / `E_PATH*` / `E_DOC_EXT` / `E_MANIFEST_CORRUPT` | 本地文件与路径类 | 4 | 400 |
| `E_REMOTE` | 远端 API 失败 | 5 | 502 |
| `E_PARTIAL` | 部分成功 | 6 | 207 |
| `E_ORIGIN` / `E_HEADER` / `E_HOST` | 来源 / 请求头校验失败 | 2 | 403 |
| `E_CONTENT_TYPE` | Content-Type 不在白名单 | 2 | 415 |
| `E_BODY_TOO_LARGE` | 请求体超限 | 2 | 413 |
| `E_CONFLICT` | 目标已存在 / 冲突 | 2 | 409 |
| `E_NOT_FOUND` | 资源不存在 | 4 | 404 |
| `E_BAD_REQUEST` / `E_EXISTS` / `E_PORT` / `EADDRINUSE` | 用法、端口与已存在 | 2 | 400 |
| `E_DOCTOR` | doctor 检查失败 | 3 | 400 |
| `E_LOCAL` / `E_ASSET_MISSING` | 本地文件缺失 | 4 | 400 |
| 未登记的 code | 保留原 code；退出码回落 `EXIT.GENERAL` | 1 | 500 |

HTTP 特判顺序由 `src/app/errors.ts#httpStatusForCode` 实现；退出码以 [`cross-cutting.md`](cross-cutting.md) §1 为唯一权威。

## runSync 编排链

- 执行链：scan → extract → resolve → plan → upload → rewrite → manifest；上传与回写共用同一轮 collect 快照。
- `runSync` 自行执行 collect+plan，不复用调用方先前的 plan；鉴权失败在任何写操作之前发生。
- `plan` 与 dry-run 不写文档、不上传；dry-run 仅计划，不调用写入路径。
- 工作集限定：runSync/runPlan 接受可选 includeDocs（只 plan 这些文档）与 includeImages（只处理这些图片引用）参数——WebUI F18「仅处理当前会话工作集」的 app 层机制；两者缺省时全量。
- 上传或回写按单文件隔离失败；有部分成功时以 `partial` 表达，退出码 6 / HTTP 207 共用同一判定。
- manifest 每次 run 最多保存一次；RunRecord 记录运行结果，token 不进入审计数据。

## 失败语义

错误统一为 `AppError` 并保留原始 `code`；未登记 code 使用通用退出码与 HTTP 500。单文件失败不阻断其余项目，部分成功映射为 `E_PARTIAL`；manifest 损坏映射为 `E_MANIFEST_CORRUPT`，不得静默重建。统计读模型将损坏记录、字段无效及目录读取错误转为 `partial` / `unavailable` 与 warnings；远端库存失败只降级该数据源，不影响本地统计。

## 功能点映射

本层不新增 F、不改 AC；F16–F25 共用 Web 应用服务，F24 桌面壳复用 Web 服务。功能定义与 AC 见 [`../features-index.md`](../features-index.md)；域规则分别见 ingest、transfer、rewrite。

*app 只负责把域能力编成一次可复现的运行；域规则看 ingest/transfer/rewrite，全局形态看 cross-cutting。*
