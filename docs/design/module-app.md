# app 应用编排层详细设计（共享）

> 性质：**跨限界上下文的共享应用层**，不是新的限界上下文，**不新增 F、不改任何 AC**。
> 服务对象：CLI 呈现（cliops 命令路径 F1–F15）与 Web/桌面呈现（webui/desktop F16–F24）。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；全局契约见 [`cross-cutting.md`](cross-cutting.md)。
> 缘起：2026-09-27 架构评审发现 `src/cli.ts` 与 `src/ui/{ops,doctor,revert}.ts` 双份实现 scan/plan/sync/revert/config 编排，并已发生漂移（doctor 对 `local` host 误要求 token；plan item 字段不一致；`url.style` 校验只在 Web 侧；RunRecord 只由 Web 写）。

## 目的

把「一次 scan / plan / sync / revert / doctor / config 的完整编排」收敛为**唯一实现**，两个呈现层只做协议适配：

- CLI：argv → 应用服务 → JSON 信封 / 退出码 / 人类可读输出
- Web：HTTP 请求 → 应用服务 → JSON 信封 / HTTP 状态码

## 边界原则

- **零呈现依赖**：不 import `node:http`、不 import `commander`、不读写 `process.argv`、不渲染 HTML。
- **不重写域规则**：抽取/上传/回写/去重仍以 ingest/transfer/rewrite 为唯一权威；app 只编排调用。
- **错误单一来源**：编排失败统一为 `AppError { code, exitCode, path?, hint? }`；CLI 退出码与 Web HTTP 状态码由同一张表派生（见 §错误映射）。
- **Token 不落盘**：app 只经注入的 `getToken()` 取 token；RunRecord / warnings / errors 不含 secret。
- **确认门属呈现层**：CLI `--yes`、HTTP `confirm` 由呈现层判定；app 暴露 `runSync` / `runRevert` 等**无确认参数**的写服务。
- **呈现层只经 façade 取配置与鉴权（2026-10-02 补，2026-10-27 补齐 `cli.ts`）**：`app/settings.ts#resolvedConfig` 与 `app/auth.ts`（`currentToken` / `saveUserToken` / `clearSavedToken` / `probeGh` / `startGhLogin`）。CLI / WebUI **不得**直接 import `config.ts` / `user-token.ts` / `infra/gh-cli.ts`——此前 `ui/server.ts` 三处直连，绕过了统一错误码与日志脱敏；`src/cli.ts` 亦曾长期直连 `config.ts`（守卫只过滤 `ui/` 前缀而漏网），现已收敛并由 `tests/layering.test.ts` 同时覆盖 `cli.ts` 与 `ui/`。`picbed init` 所需的 `CONFIG_NAME` / `configTemplate` 由 `app/settings.ts` 转发导出，不构成直连例外。
- **写操作一律有 app 入口（2026-10-02 补）**：`picbed upload` 的上传编排下沉到 `app/upload.ts#uploadSingleAsset`；CLI 只做参数校验与 `AppError → 退出码`。呈现层不得直接 `createHostAdapter` / `uploadAsset`。防回归见 `tests/layering.test.ts`。

## 模块文件夹结构（实现落点）

```
src/app/
├─ index.ts      # barrel：统一再导出全部应用服务（CLI/Web 共用唯一入口）
├─ errors.ts     # AppError + code → exitCode → HTTP 表
├─ collect.ts    # 扫描文档 + 抽取 + 解析去重（ingest 域编排）
├─ plan.ts       # runPlan / summarizePlan / publicPlanItem
├─ sync.ts       # runSync（上传 + 回写 + manifest + RunRecord）
├─ revert.ts     # runRevert / listManifestView
├─ doctor.ts     # doctorService（host-aware）/ publicConfig
├─ settings.ts   # 配置防腐层：resolvedConfig / readConfigKey / writeConfigKey / import / serialize / CONFIG_NAME / configTemplate
├─ auth.ts       # 鉴权防腐层：currentToken / saveUserToken / clearSavedToken / probeGh / startGhLogin
├─ run-store.ts  # RunRecord 函数式仓库：newRunId / recordRun / listRuns / getRun / runsDir
├─ repo-dir.ts   # 远端目录规则：createRepoDir / normalizeRepoDirPath / parentDirPath / DIR_PLACEHOLDER
└─ upload.ts     # uploadSingleAsset
```

## 服务清单

| 服务 | 职责 | 调用方 |
|------|------|--------|
| `collect(root, cfg)` | scanDocs → extractRefs → resolveAssets → `{docs, byDoc, assets, blocked, remoteSkips, warnings}` | plan / sync |
| `runPlan(root, cfg, cwd, opts?)` | collect + manifest + buildPlan → `{collected, plan, summary}`；`opts.includeDocs` 限定只 plan 这些文档（UI 工作集） | CLI scan/plan/sync-dryRun；API `/api/plan`、`/api/scan`、`/api/sync` (dryRun) |
| `publicPlanItem(it)` | plan item 公开投影（**含 localPath**） | 同上 |
| `runSync({root,cfg,cwd,getToken,command,includeDocs?,includeImages?})` | 调用时**单次 collect+plan**（上传与回写共用同一文本快照，不复用调用方先前 plan）；`includeDocs` / `includeImages` 把范围限定到 UI 工作集 → 上传（cache 命中跳过）→ 回写 → 保存 manifest → 写 RunRecord | CLI `sync`；API `/api/sync`；watch auto |
| `runRevert({root,cfg,cwd,dryRun,command})` | manifest 校验 → 逐文档 revert（dry-run 进 `planned`）→ 写 RunRecord | CLI `revert`；API `/api/revert` |
| `listManifestView(cwd)` | manifest 只读视图（无 token） | API `/api/manifest` |
| `doctorService({cfg,getToken,probeApi})` | host-aware 检查：github 校验 owner/repo/branch + token + API 探测；local 只校验 host | CLI `doctor`；API `/api/doctor` |
| `publicConfig(cfg, extra?)` | 配置视图（token 掩码） | CLI `config list`；API `/api/config` |
| `readConfigKey` / `writeConfigKey` | 键枚举 + **url.style 校验** + TOML 改写 | CLI `config get/set`；API `/api/config` |
| `run-store.ts`（RunRecord 仓库，函数式） | `./.picbed/runs/*.json` 追加 / 读取 | CLI 与 Web 共用（审计 F21） |

## 复杂任务：sync 编排链（为什么必须画出来）

`runSync` 是唯一一次同时触碰「读取文本 → 网络写 → 本地写 → 审计」的服务，而其中**文本快照只能取一次**（§行为增量 7）。这条约束在单个服务描述里看不出来，因此画出全链路：

```mermaid
sequenceDiagram
    actor U as 人或 UI
    participant CLI as CLI / WebUI
    participant SYNC as runSync
    participant PLAN as runPlan
    participant COLLECT as collect
    participant INGEST as scanDocs + extractRefs
    participant RESOLVE as resolveAssets
    participant BUILD as buildPlan
    participant MAN as manifest 存储
    participant FACT as createHostAdapter
    participant ADAPTER as HostAdapter
    participant GH as GitHub API
    participant REWRITE as applyRewrites

    U ->> CLI: sync 命令并确认
    CLI ->> SYNC: runSync

    rect rgb(242, 248, 252)
    Note over SYNC, PLAN: ① 单次 collect + plan（此后不再重扫）
    SYNC ->> PLAN: runPlan
    PLAN ->> COLLECT: collect
    COLLECT ->> INGEST: 扫描文档并抽取引用
    INGEST -->> COLLECT: 文档列表 + 图片引用列表
    COLLECT ->> RESOLVE: 解析并去重
    RESOLVE -->> COLLECT: 资产 / blocked / remoteSkips
    COLLECT -->> PLAN: CollectResult
    PLAN ->> MAN: 读取 manifest
    PLAN ->> BUILD: buildPlan
    BUILD -->> PLAN: SyncPlanItem 列表
    PLAN -->> SYNC: plan 与摘要
    end

    rect rgb(252, 248, 242)
    Note over SYNC, FACT: ② 鉴权与适配器（早于任何写）
    SYNC ->> SYNC: 取 token
    alt 需要 token 却没有
        SYNC -->> CLI: 抛 E_TOKEN
    end
    SYNC ->> FACT: createHostAdapter
    FACT -->> SYNC: HostAdapter 实例
    end

    rect rgb(244, 250, 244)
    Note over SYNC, GH: ③ 上传：按 sha 去重，缓存优先
    loop 每个 upload 项
        SYNC ->> MAN: 查缓存 URL
        alt 缓存命中
            SYNC ->> SYNC: 记为 skip-cache
        else 未命中
            SYNC ->> ADAPTER: 计算远端路径
            SYNC ->> ADAPTER: putFile
            ADAPTER ->> GH: PUT contents
            GH -->> ADAPTER: 201
            SYNC ->> ADAPTER: 合成 URL
            SYNC ->> MAN: 合并 manifest 条目
        end
    end
    end

    rect rgb(250, 244, 250)
    Note over SYNC, MAN: ④ 回写 + 审计
    loop 每个文档
        SYNC ->> REWRITE: 按偏移倒序替换
        REWRITE -->> SYNC: 新内容与条目
        SYNC ->> MAN: 合并 manifest 条目
    end
    SYNC ->> MAN: 保存 manifest（整程一次）
    SYNC ->> SYNC: 写 RunRecord
    SYNC -->> CLI: 结果与 runId
    end
```

由这张图得出的规则：

1. **上传与回写共用同一份 `CollectResult`**：时刻 1 只做一次 scan/extract/resolve，之后不再重扫——这就是 §行为增量 7 的"同一文本快照"，也是为什么 `runSync` 不接受调用方传入的 plan 结果。
2. **鉴权失败发生在任何写之前**：`E_TOKEN` 在阶段 2 抛出，此时还没 PUT 也没改文档，故失败可安全重试。
3. **manifest 是两次写的中间层**：先把每个 asset 的 URL `mergeManifest` 进内存，最后才 `saveManifest`——对应"每次 run 最多一次 manifest 保存"（§不变式 2）。
4. **partial 由 (uploaded+rewritten) 判定**，与具体错误数无关，保证 CLI 退出码 6 与 Web 207 同源。

## 错误映射（单一来源）

| code | 含义 | 退出码 | HTTP |
|------|------|--------|------|
| `E_CONFIRM` | 缺确认 | 7 | 409 |
| `E_TOKEN` / `E_AUTH` | 缺 token / 鉴权失败 | 3 | 401 |
| `E_CONFIG` | 配置不完整（如 `github.owner/repo` 缺失） | 3 | 400 |
| `E_USAGE` / `E_STYLE` | 用法 / 枚举非法 | 2 | 400 |
| `E_NO_ROOT` / `E_ROOT` / `E_PATH*` / `E_DOC_EXT` / `E_MANIFEST_CORRUPT` | 本地文件与路径类 | 4 | 400 |
| `E_REMOTE` | 远端 API 失败 | 5 | 502 |
| `E_PARTIAL` | 部分成功 | 6 | 207 |
| `E_ORIGIN` / `E_HEADER` / `E_HOST` | 来源 / 请求头校验失败（HTTP 加固） | 2 | 403 |
| `E_CONTENT_TYPE` | Content-Type 不在白名单 | 2 | 415 |
| `E_BODY_TOO_LARGE` | 请求体超限 | 2 | 413 |
| `E_CONFLICT` | 目标已存在 / 冲突 | 2 | 409 |
| `E_NOT_FOUND` | 资源不存在 | 4 | 404 |
| `E_BAD_REQUEST` / `E_EXISTS` / `E_PORT` / `EADDRINUSE` | 用法、端口与已存在 | 2 | 400 |
| `E_DOCTOR` | doctor 检查失败 | 3 | 400 |
| `E_LOCAL` / `E_ASSET_MISSING` | 本地文件缺失 | 4 | 400 |
| 未登记的 code | 经 `asAppError` 落入 `E_GENERAL` | 1 | 500 |

HTTP 特判顺序见 `src/app/errors.ts#httpStatusForCode`（`E_TOKEN`/`E_AUTH` → 401、`E_ORIGIN`/`E_HEADER`/`E_HOST` → 403、`E_CONTENT_TYPE` → 415、`E_CONFLICT` → 409、`E_NOT_FOUND` → 404、`E_BODY_TOO_LARGE` → 413，其余按退出码派生）。

规则：退出码以 [`cross-cutting.md`](cross-cutting.md) §1 为唯一权威；HTTP 状态码是语义近似，**以信封 `error.code` 为准**。

## 行为增量（统一后 CLI 与 Web 语义对齐）

1. **RunRecord 共享**：CLI `sync` / `revert` 也写 `./.picbed/runs/`（command 为 `sync` / `revert` / `revert.dryRun`；Web 仍 `api.*`）。
2. **doctor host-aware**：`host.type=local` 时不再要求 token、不探测 GitHub API（消除 CLI 与 Web 漂移）；github 仍为 owner/repo/branch + token + API 检查。
3. **url.style 校验单一来源**：只在 `writeConfigKey`；CLI 与 Web 同等拒绝非法枚举（退出码 2 语义 / HTTP 400）。
4. **plan item 投影统一含 `localPath`**（CLI 原缺）：JSON `data` 只增字段，action 分类与退出码不变。
5. **revert dry-run 明确分流**：`planned[]`=将改文档，`rewritten[]`=已写文档；CLI `revert --dry-run` 输出相应改为 `planned`。
6. **revert manifest 损坏**：显式返回 `errorCode='E_MANIFEST_CORRUPT'`（Web 不再依赖错误字符串匹配）；CLI 退出码 1 → 4（本地文件类）。
7. **sync 单次 collect+plan（同一文本快照）**：`runSync` 在调用时自行执行一次 collect+plan，上传与回写共用该次快照，**不复用调用方先前的 dry-run / plan 结果**；CLI 与 Web 的写阶段都经同一条 `runSync` 路径。注意：CLI 在进入 sync 写分支前，为生成 warnings 与确认文案已先执行过一次 `runPlan`（`src/cli.ts:459`），因此 CLI 单次 `sync` 会扫描两次，第一次结果不参与写。app 不承诺「写阶段重扫」「防 plan 与写之间外部改动」这类更强语义。
8. **partial 判定单一来源**：`partial = !ok && (uploaded + rewritten > 0)`（CLI 退出码 6 / Web 207 同一判定）。

## 不变式

1. app 层不 import `node:http`、`commander`，不读写 `process.argv`。
2. 每次 run 最多一次 manifest 保存；图片字节只读。
3. RunRecord / warnings / errors 不含 token 明文。
4. 呈现层不得重写 action 分类、退出码或确认门语义。

## 测试对齐

| 测试 | 对齐 |
|------|------|
| tests/ui.test.ts F18、tests/ui-panels.test.ts F19–F22 | 应用服务 + HTTP 信封 |
| tests/mcp.test.ts | CLI `--json`（经 app 层）退出码 0 |
| 契约断言：plan item 含 `localPath`、revert `errorCode` | 新增 / 更新 |
| 设计文档校验 | `npm run validate:design`（`scripts/validate.mjs --profile=design`）要求本文件存在 |

## 实现落点（TS/Electron 适配）

> 本模块在 TypeScript/Electron 实际源码中的落地；编排细节、服务清单、sync 时序与错误映射见上文。类图与真实目录以真实源码为准（源码：`src/app/*`、`src/types.ts`、`src/app/errors.ts`）。

### 实际文件夹结构

```text
src/app/
├─ index.ts      # barrel：统一再导出全部应用服务（CLI/Web 共用唯一入口）
├─ errors.ts     # AppError + code → exitCode → HTTP 表（错误单一来源）
├─ collect.ts    # collect()：scan + extract + resolve 收敛
├─ plan.ts       # runPlan / summarizePlan / publicPlanItem
├─ sync.ts       # runSync（上传 + 回写 + manifest + RunRecord）
├─ revert.ts     # runRevert / listManifestView
├─ doctor.ts     # doctorService（host-aware）/ publicConfig
├─ settings.ts   # 配置防腐层：resolvedConfig / readConfigKey / writeConfigKey / import / serialize / CONFIG_NAME / configTemplate
├─ auth.ts       # 鉴权防腐层：currentToken / saveUserToken / clearSavedToken / probeGh / startGhLogin
├─ run-store.ts  # RunRecord 仓库（函数式，非类）
├─ repo-dir.ts   # 远端目录规则：createRepoDir / normalizeRepoDirPath / parentDirPath / DIR_PLACEHOLDER
└─ upload.ts     # uploadSingleAsset
```

### 领域层类图（应用层结果类型 + 防腐层）

```mermaid
classDiagram
    class AppError { +string code +ExitCode exitCode +string path? +string hint? }
    class ErrorMappers { <<module: src/app/errors.ts>> +exitCodeForCode(code) ExitCode +httpStatusForCode(code) number }
    class CollectResult { +{path,kind}[] docs +Map~string,string~ byDoc +Asset[] assets +BlockedItem[] blocked +ImageRef[] remoteSkips +string[] warnings }
    class SyncResult { +boolean ok +number uploaded +string[] rewrittenDocs +object summary +string[] errors +SyncItem[] items +string[] warnings +boolean partial +('E_PARTIAL'|'E_REMOTE') errorCode? +string runId }
    class RevertResult { +boolean ok +boolean dryRun +string[] rewritten +string[] planned +string[] errors +('E_MANIFEST_CORRUPT'|'E_PARTIAL') errorCode? +string runId }
    class DoctorReport { +boolean ok +DoctorCheck[] checks +string[] failures }
    class RunRecord { +string id +string command +string startedAt +string finishedAt +boolean ok +Record~string,number~ counts +unknown[] items? +string[] errors? +string[] warnings? +string errorCode? }
    class ResolvedConfig { +HostConfig host +GithubConfig github +LocalHostConfig local +UrlConfig url +ScanConfig scan +UploadConfig upload +RewriteConfig rewrite +string configPath? +string rootDir }
    class RunStore { <<infrastructure>> +newRunId() string +recordRun(cwd, record) void +listRuns(cwd, limit?) RunRecord[] +getRun(cwd, id) RunRecord~null~ }
    class SettingsFacade { <<anti-corruption>> +resolvedConfig(cwd?, path?) ResolvedConfig +readConfigKey(cfg, key) unknown +writeConfigKey(cfg, key, value, dryRun) object +serializeConfigToml(cfg) string +importConfigToml(base, toml, dryRun) object }
    class AuthFacade { <<anti-corruption>> +currentToken() string~undefined~ +saveUserToken(t) void +clearSavedToken() void +probeGh() object +startGhLogin(onChunk) object }

    AppError ..> SyncResult : 错误经 code 派生
    RunStore ..> RunRecord : 持久化 .picbed/runs/*.json
    SyncResult --> RunRecord : 写审计
    RevertResult --> RunRecord : 写审计
```

> 备注：代码中不存在 `PlanItem` 类型（真实为 `SyncPlanItem`）、不存在 `RunRecorder` 类（RunRecord 由 `app/run-store.ts` 函数式仓库持久化）、`resolvedConfig` 是函数（`SettingsFacade`）而非实体。以上据实描述，未照搬模板占位。

## 功能点映射

本层不新增 F、不改 AC；按「实现归属（应用）」被下列功能点共用：
F1/F2/F10/F12（CLI 路径）、F16–F22（Web 路径）、F24（桌面壳复用 Web 服务）。
各 F 的 AC 与模块归属仍以 [`../features-index.md`](../features-index.md) 为准（cliops / webui）。

*app 只负责「把域能力编成一次可复现的运行」；域规则看 ingest/transfer/rewrite，全局形态看 cross-cutting。*
