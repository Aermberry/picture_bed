# transfer 模块详细设计

> 归属功能点：F6 上传计划 plan、F7 GitHub 图床上传、F11 单文件上传。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；ingest 见 [`module-ingest.md`](module-ingest.md)；横切见 [`cross-cutting.md`](cross-cutting.md)。
> 栈无关；Host 细节经 `HostAdapter` 端口注入（F13：github | local）。

## 目的

transfer 将 ingest 产出的 `Asset` 变为可写回的 `RemoteImage`：先形成**可预览计划**，再经 **GitHub Contents API**（PicX 同源模型）上传，并按 URL 风格生成公开链接。只读缓存决定跳过，保证幂等。

边界原则：
- **不改文档文本**（rewrite 职责）。
- **不读目录发明引用**（ingest 职责）；可接受单文件路径（F11）。
- Token 仅在适配器边界注入，不进入领域结果对象。
- **适配器经端口取用（2026-10-02 补）**：编排层只用 `host/index.js` 的端口工厂 `createHostAdapter`，**不**深连 `host/github.js` / `host/local.js`。目录能力（F20）是端口上的**可选能力** `HostAdapter.entryType?()`——GitHub 经 Contents API 实现，其它后端可不实现，编排层须先判空并报 `E_CONFIG`。

## 模块文件夹结构（栈无关）

```
transfer/
├─ domain/
│  ├─ cqe/          # BuildPlanQuery、UploadAssetsQuery、UploadOneQuery
│  ├─ entity/       # SyncPlan、SyncPlanItem、RemoteImage
│  ├─ service/      # PlanBuilder、UrlComposer、UploadScheduler
│  ├─ port/         # HostAdapter <<interface>>
│  └─ facade/       # TransferFacade
├─ packages/        # 防腐层：GitHubHostAdapter（Contents API）
└─ exceptions/      # UploadFailedError、RateLimitedError、HostAuthError
```

## 端口

```
HostAdapter
  type / requiresToken
  exists(repoPath): boolean
  putFile(repoPath, bytes, message, branch): void
  composeUrls(repoPath): { publicUrl, rawUrl, cdnUrl? }
  remotePath(sha256, localPath, now?): string
  # 实现负责传输语义；uploadAsset 只依赖本端口（AC7 稳定）
```

工厂：`createHostAdapter(cfg, token?)` 按 `host.type` 选择后端。

契约速览即上文代码块；下图把**端口 + 两个实现 + 工厂 + 传输数据契约**放在一张图里，用于确认「换后端要动哪些文件」：

```mermaid
classDiagram
    class HostAdapter {
        <<interface>>
        +type : string
        +requiresToken : boolean
        +exists(repoPath) Promise~boolean~
        +putFile(repoPath, bytes, message, branch) Promise~void~
        +deleteFile(repoPath, sha, message, branch) Promise~void~
        +composeUrls(repoPath) HostUrls
        +remotePath(sha256, localPath) string
        +entryType?(repoPath) Promise~'file'|'dir'|null~
    }
    class HostUrls {
        +publicUrl : string
        +rawUrl : string
        +cdnUrl? : string
    }
    class Asset {
        +localPath : string
        +sha256 : string
        +bytes : number
        +mime : string
        +refs : ImageRef[]
        +data? : Buffer
    }
    class RemoteImage {
        +publicUrl : string
        +rawUrl : string
        +cdnUrl? : string
        +repoPath : string
        +sha256 : string
    }
    class SyncPlanItem {
        +action : PlanAction
        +asset? : Asset
        +remote? : RemoteImage
        +reason? : string
        +code? : string
        +ref? : ImageRef
    }
    class GitHubHostAdapter {
        +type : github
        +requiresToken : true
    }
    class LocalHostAdapter {
        +type : local
        +requiresToken : false
        +abs(repoPath) string
    }
    class createHostAdapter {
        <<function>>
    }

    HostAdapter <|.. GitHubHostAdapter : implements
    HostAdapter <|.. LocalHostAdapter : implements
    HostAdapter ..> HostUrls : returns
    Asset ..> RemoteImage : 上传后产出
    SyncPlanItem --> Asset : asset
    SyncPlanItem --> RemoteImage : remote
    createHostAdapter ..> HostAdapter : creates
    createHostAdapter ..> GitHubHostAdapter : 当 host.type 为 github
    createHostAdapter ..> LocalHostAdapter : 当 host.type 为 local

    note for GitHubHostAdapter "唯一需要 token 的实现：Bearer 头与 Accept 头在此封装"
    note for LocalHostAdapter "abs 必须过 isUnderRoot，否则 E_LOCAL；全程不需要 token"
    note for RemoteImage "字段里没有 token，故可安全进 manifest 与加密封响应"
```

由这张图得出的边界：

1. **编排层只认两处**：`createHostAdapter` 工厂与 `HostAdapter` 接口。图里 `GitHubHostAdapter` / `LocalHostAdapter` 对上层是**不可见的实现细节**——`tests/layering.test.ts` 禁止 `app/*` 与呈现层深连 `host/github.ts` / `host/local.ts`。
2. **token 只活在适配器内**：`GitHubHostAdapter.requiresToken = true` 是唯一要求 token 的地方，`RemoteImage` / `SyncPlanItem` 的字段里也没有 token——配合 §数据的 manifest 不变量与 `E_TOKEN` 前置校验，保证凭据不流入结果对象。
3. **`entryType?` 是可选能力**：只有 GitHub 实现了目录项判定（Contents API），`local` 可不实现；图上的 `?` 就是调用方的判空义务，未实现时报 `E_CONFIG`（F20 远程目录浏览的 fallback 依据）。

## 数据

```
SyncPlanItem { action: upload|skip-cache|skip-remote|rewrite-only|blocked,
               asset?, remote?, reason? }
RemoteImage  { publicUrl, rawUrl, cdnUrl?, repoPath, sha256 }
```

## F6 上传计划 plan

分类规则：
| 条件 | action |
|------|--------|
| manifest/cache 命中且策略允许复用 | `skip-cache` |
| ref 已是 http(s) | `skip-remote` |
| 本地 Asset 合法 | `upload` |
| 解析失败/越界 | `blocked` |
| 已远程、仅需替换（可选策略） | `rewrite-only` |

`plan` 与 `sync --dry-run` **不得**调用 `putFile`。

上表是「条件 → action」的平铺；真正实现时判定有**先后顺序**（先看 raw 形态，再查缓存），一条 ref 只会落在叶子状态之一。决策顺序本身就是规则，故给出状态转移图：

```mermaid
flowchart TD
    REF[extractRefs 产出 ImageRef] --> RAW{raw 形态判定}

    RAW -->|空 / 页内锚点 / data:| BL[blocked<br/>E_SKIP_REF]
    RAW -->|http 或 https 开头| SR[skip-remote<br/>已是公网 URL]
    RAW -->|file:// 协议| FU[blocked<br/>E_FILE_URL]
    RAW -->|其余视为本地路径| LOCAL{路径合格判定}

    LOCAL -->|越界 / 不存在 / 非图片扩展名| BL
    LOCAL -->|在根内且是图片| CACHE{manifest 查 sha256}

    CACHE -->|命中相同摘要| SC[skip-cache<br/>仍要 rewrite 替换]
    CACHE -->|未命中| UP[upload<br/>唯一触发 putFile 的分支]

    BL --> OUT[输出 SyncPlanItem 带 reason]
    SR --> OUT
    SC --> OUT
    UP --> OUT
```

由这张图得出的规则：

1. **`upload` 是唯一触碰网络的分支**——`plan` / `sync --dry-run` 只要走到 Miss 之前就返回，因此"`plan` 不得调用 `putFile`"是**结构性保证**而非约定（`buildPlan` 不持有 adapter 实例）。
2. **`skip-cache` 也要 rewrite**：命中缓存省的是 PUT，不是替换——否则文档仍指向本地路径。
3. **`blocked` 不写任何东西**：既不上传也不替换，只在输出里带 `reason`，供 UI 打 FAIL 标签。
4. **越界与 disciplines 判定先于 sha256**：`isUnderRoot` 与扩展名白名单在 `lib/paths.ts` / `lib/img.ts`（跨层单点），不在此重复实现。

## F7 GitHub 图床上传

- 远端路径模板：`{dir}/{yyyy}/{mm}/{sha12}-{safeName}`（可配置）。
- API：`GET contents` 探测 → `PUT contents` `{message, content: base64, branch}`；已存在同内容可 skip 或带 `sha` 更新策略（默认 skip）。
- URL（`url.style`）：
  - `raw` → `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
  - `jsdelivr` → `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}`
  - `custom` → 用户模板
  - **`{path}` 必须逐段百分号编码（2026-10-26 修复）**：`dir` 含非 ASCII（如 `資源圖`）时未编码的 URL 会被 CDN/raw **直接返回 400**——上传与改写都成功，但生成的链接点不开。实现为 `lib/paths.ts` 的 `encodeRepoPath()`（按 `/` 分段 `encodeURIComponent`，分隔符保留），GitHub 与 Local 两种 host 的 `composeUrls` 共用；custom 模板的 `{path}` 同样传编码后的值。ASCII 路径编码后不变，故既有链接不受影响。
- 并发默认 2–3；429/403 指数退避；耗尽 → `RateLimitedError`（退出码 5）。
- 单文件失败隔离；汇总 partial（退出码 6）。

## F11 单文件上传

- `upload <file>`：resolve 单文件 → 与 F7 同一适配器与 UrlComposer → 输出 `publicUrl`。
- 可选写入 manifest 以便后续 sync 复用。

## F13 多图床适配器

- `host.type = "github"`：Contents API（默认，需 token）。
- `host.type = "local"`：本地目录图床（`local.root` + `local.public_base`），**无需 token**。
- 新增后端：实现 `HostAdapter` 并在工厂注册即可；plan/rewrite/manifest 无需改动。
- AC7（F7）语义保持：同 sha 幂等、URL 风格可配、失败映射退出码 5/6。

## 实现落点（TS/Electron 适配）

> 本模块在 TypeScript/Electron 实际源码中的落地；端口/类图/状态图见上文。签名与去重/缓存逻辑以真实源码为准（源码：`src/host/*`、`src/app/upload.ts`、`src/infra/gh-cli.ts`、`src/manifest.ts`、`src/plan.ts`、`src/app/sync.ts`）。

### 实际文件夹结构

```text
src/
├─ host/
│  ├─ types.ts     # HostAdapter 端口 + HostUrls 值对象
│  ├─ index.ts     # createHostAdapter / hostRequiresToken（工厂）
│  ├─ github.ts    # GitHubHostAdapter + composeGithubUrls + probeGithubAccess + uploadAsset
│  └─ local.ts     # LocalHostAdapter（文件系统后端）
├─ infra/
│  └─ gh-cli.ts    # 防腐层：GitHub CLI 封装（token 解析 / 登录态探测 / 交互登录）
├─ app/
│  └─ upload.ts    # uploadSingleAsset：单文件上传编排
└─ manifest.ts     # findCachedUrl（缓存命中判定）
```

### 公开服务签名（TS）

| 服务 | 签名 | 职责 |
|------|------|------|
| `createHostAdapter` | `createHostAdapter(cfg: ResolvedConfig, token?: string): HostAdapter` | 按 `host.type` 工厂创建适配器；缺 token 抛 `E_TOKEN`，未知 type 抛 `E_CONFIG` |
| `hostRequiresToken` | `hostRequiresToken(cfg: ResolvedConfig): boolean` | `host.type !== 'local'` 即需要 token |
| `uploadAsset` | `uploadAsset(host: HostAdapter, args: {asset, bytes, cfg, now?}): Promise<RemoteImage>` | 计算远端路径 → `putFile` → `composeUrls` → 返回 `RemoteImage` |
| `uploadSingleAsset` | `uploadSingleAsset(opts: UploadOneOptions): Promise<UploadOneResult>` | CLI 单文件上传编排：存在性校验 → token 校验 → 读文件算 sha → 上传 |
| `resolveToken` | `resolveToken(env?, execGhToken?, readStoredToken?): {token, source} \| undefined` | token 优先级：env → 本机凭据 → `gh auth token`（防腐层） |
| `probeGhToken` | `probeGhToken(): {token?, reason?, message?}` | 区分「未安装 / 未登录 / 其它错误」 |
| `spawnGhLogin` | `spawnGhLogin(onData): {process, promise}` | 启动 `gh auth login --web`，实时回调 |

> 去重与缓存命中（跨域协作）：`runSync` 用 `Map<sha256, Asset>` 去重（同 sha 仅上传一次），`findCachedUrl(manifest, sha256)` 判定缓存命中——实现位于 `src/app/sync.ts` 与 `src/manifest.ts`，见 [`module-app.md`](module-app.md)。`LocalHostAdapter.putFile/deleteFile` 实际参数比 `HostAdapter` 契约少（`message/branch/sha`），是 TS 结构化类型容忍差异，非严格签名一致。

### 复杂任务时序图（单次上传 + 批量去重/缓存命中）

```mermaid
sequenceDiagram
    participant UP as uploadSingleAsset
    participant TOK as getToken
    participant FAC as createHostAdapter
    participant UA as uploadAsset
    participant AD as HostAdapter
    participant GH as GitHub API
    participant FS as fs

    UP ->> FS: existsSync(abs)
    alt 缺失
        UP -->> UP: throw E_ASSET_MISSING
    end
    UP ->> TOK: 取 token
    UP ->> FAC: hostRequiresToken(cfg)
    alt 需要且无 token
        UP -->> UP: throw E_TOKEN
    end
    UP ->> FS: readFileSync(abs)
    UP ->> UP: sha256 = sha256Hex(bytes)
    UP ->> FAC: createHostAdapter(cfg, token)
    FAC -->> UP: HostAdapter
    UP ->> UA: uploadAsset(host, {asset, bytes, cfg})
    UA ->> AD: repoPath = remotePath(sha256, localPath, now)
    UA ->> AD: putFile(repoPath, bytes, commitMessage, branch)
    AD ->> GH: GET contents?ref=branch 取 sha
    AD ->> GH: PUT contents {message, content(base64), branch, sha?}
    alt 非 2xx
        GH -->> AD: throw E_REMOTE
    end
    UA ->> AD: urls = composeUrls(repoPath)
    AD -->> UA: HostUrls
    UA -->> UP: RemoteImage
    UP -->> UP: UploadOneResult{remotePath, publicUrl, rawUrl, cdnUrl, hostType, sha256, bytes}
```

```mermaid
sequenceDiagram
    participant SYNC as runSync
    participant MF as manifest
    participant UA as uploadAsset
    participant AD as HostAdapter

    SYNC ->> MF: loadManifest(cwd)
    SYNC ->> SYNC: unique = Map~sha256,Asset~；同 sha 仅保留一条（去重）
    loop 每个 unique Asset
        SYNC ->> MF: findCachedUrl(manifest, sha256)
        alt 缓存命中
            MF -->> SYNC: 返回 publicUrl
            SYNC ->> SYNC: 记 skip-cache（**不入 urlBySha**）；continue
        else 未命中
            SYNC ->> UA: uploadAsset(host, {asset, bytes, cfg})
            UA ->> AD: putFile / composeUrls
            UA -->> SYNC: RemoteImage.publicUrl
            SYNC ->> SYNC: urlBySha.set(sha, url)；uploaded++
            SYNC ->> MF: mergeManifest（写独立 entry）
        end
    end
    SYNC ->> SYNC: 写文档：upload 取 urlBySha[sha]；skip-cache/skip-remote 取 item.remote.publicUrl（见 module-rewrite）
    SYNC ->> MF: saveManifest（原子写）
```

### 错误映射（code → 退出码/HTTP）

| code | 含义 | 退出码 | HTTP |
|------|------|--------|------|
| `E_TOKEN` | 缺 GitHub token | CONFIG(3) | 401 |
| `E_CONFIG` | 未知 host.type 或 owner/repo 缺失 | CONFIG(3) | 400 |
| `E_REMOTE` | GitHub API 失败（非 2xx） | REMOTE(5) | 502 |
| `E_LOCAL` | Local 路径逃逸 host root | LOCAL(4) | 400 |
| `E_ASSET_MISSING` | 文件不存在 | LOCAL(4) | 400 |
| `E_MANIFEST_CORRUPT` | manifest 损坏 | LOCAL(4) | 400 |

完整 code → 退出码/HTTP 映射见 [`module-app.md`](module-app.md) §错误映射。

## 功能点映射

| F | 本模块章节 |
|---|------------|
| [F6](../features-index.md#f6-上传计划-plan) | §F6 |
| [F7](../features-index.md#f7-github-图床上传) | §F7 |
| [F11](../features-index.md#f11-单文件上传) | §F11 |
| [F13](../features-index.md#f13-多图床适配器) | §F13 |

*AC 以 features-index 为准；HTTP 形状以本模块 + cross-cutting 为准。*
