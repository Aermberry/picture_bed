# transfer 模块设计

> 归属功能点：F6 上传计划 plan、F7 GitHub 图床上传、F11 单文件上传。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；ingest 见 [`module-ingest.md`](module-ingest.md)；横切见 [`cross-cutting.md`](cross-cutting.md)。

## 目的与边界

transfer 将 ingest 产出的 `Asset` 分类为可预览计划，经图床适配器上传后生成 `RemoteImage`，供 rewrite 回写。plan 只读缓存，不上传、不改文档。

- 不抽取新引用；批量输入来自 ingest，F11 可接收单文件路径。
- 不改文档文本；回写由 rewrite 负责。
- Token 仅注入适配器，不进入领域结果对象。
- 编排只经 `createHostAdapter` 工厂和 `HostAdapter` 端口，不深连 github/local 实现。
- 目录浏览是可选端口能力 `entryType?()`；调用方须判空，所需能力不可用时报 `E_CONFIG`。

实现落点：`src/host/{types,index,github,local}.ts`、`src/app/{upload,sync}.ts`、`src/plan.ts`、`src/manifest.ts`、`src/infra/gh-cli.ts`。

## 数据契约

- `HostAdapter`：`type`、`requiresToken`、`exists`、`putFile`、`composeUrls`、`remotePath`；目录能力 `entryType?` 可选。
- `createHostAdapter(cfg, token?)` 按 host 类型创建 github 或 local 实现；github 需 token，local 不需 token。
- `composeUrls(repoPath)` 与 `remotePath(sha256, localPath, now?)` 由适配器提供，封装不同 host 的公开 URL 与远端路径规则。
- `SyncPlanItem { action: upload|skip-cache|skip-remote|rewrite-only|blocked, asset?, remote?, reason?, code?, ref? }`。
- `RemoteImage { publicUrl, rawUrl, cdnUrl?, repoPath, sha256 }`，不含凭据，可写入 manifest。

## F6 上传计划 plan

一条引用按判定次序进入唯一状态：

- `skip-remote`：引用已是 `http(s)://`。
- `blocked`：空引用、页内锚点、非图片 data URI、越界/缺失/非图片本地路径或其他解析失败。
- `skip-cache`：本地资产合法且 manifest 按 `sha256` 命中；仍须 rewrite，只跳过 PUT。
- `upload`：资产合法且缓存未命中；这是唯一触发上传的状态。
- `rewrite-only`：策略要求仅替换链接、不上传时使用。

`plan` 与 `sync --dry-run` 不调用 `putFile`，不写文档、不上传。`buildPlan` 不持有 adapter；`blocked` 不写入也不替换，仅返回原因。

## F7 GitHub 图床上传

- GitHub 通过 Contents API：读取已有 sha 后 PUT 文件内容；远端已存在时覆盖更新，不以内容相同跳过。
- 远端路径模板：`{dir}/{yyyy}/{mm}/{sha12}-{safeName}`。
- URL 风格：`raw` → `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`；`jsdelivr` → `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}`；`custom` 使用用户模板。
- `{path}` 按 `/` 分段百分号编码，分隔符保留；custom 模板同样使用编码后的路径。
- 上传串行；无重试、无退避；远端 403/429 映射 `E_REMOTE`。单文件建议不超过 50 MB——当前实现无上传前大小校验，超限由远端拒绝，表现为 `E_REMOTE`。

## F11 单文件上传

`upload <file>` 校验并解析单文件，使用与批量上传相同的 host 适配器、远端路径和 URL 生成逻辑，输出 `publicUrl`；可选写 manifest 供后续 sync 复用。

## F13 多图床适配器

- `host.type = "github"`：GitHub Contents API，需 token。
- `host.type = "local"`：本地目录图床（`local.root` + `local.public_base`），无需 token。
- 新后端实现 `HostAdapter` 并注册到工厂；plan、rewrite、manifest 不因后端增加而改动。
- `composeUrls` / `remotePath` 由各 adapter 实现；`entryType?` 仅在后端支持时提供。

## 失败语义

单资产失败与其他资产隔离；有部分成功时汇总为 partial。远端 API 非 2xx（含 403/429）映射 `E_REMOTE`，退出码 5。host 配置无效或缺少必需目录能力报 `E_CONFIG`；GitHub 缺 token 报 `E_TOKEN`，本地路径越出 host root 报 `E_LOCAL`。

完整 code → 退出码 / HTTP 映射见 [`module-app.md`](module-app.md)。

## 功能点映射

| F | 本模块章节 |
|---|------------|
| [F6](../features-index.md#f6-上传计划-plan) | §F6 |
| [F7](../features-index.md#f7-github-图床上传) | §F7 |
| [F11](../features-index.md#f11-单文件上传) | §F11 |
| [F13](../features-index.md#f13-多图床适配器) | §F13 |

*AC 以 features-index 为准；HTTP 形状以本模块 + cross-cutting 为准。*
