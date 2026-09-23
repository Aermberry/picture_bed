# picbed 架构设计

> 状态：**CLI 已实现并发布 v0.2.0**（2026-09-22）；**本地 Web 控制台（F16–F22）设计稿**（2026-09-23，**未实现**）· Node/TS
> 定位：**架构总纲**（分层 / 存储 / CLI 契约 / 数据模型 / 安全 / NFR / 技术选型）。
> 功能点的完整规格（优先级、AC、实现归属、双向链接）以 [`features-index.md`](features-index.md) 为唯一来源；本文档不重复其逐条 AC。
> **新人阅读指南**（F 编号、模块名、文档怎么串）：[`design-reading-guide.md`](design-reading-guide.md)。
> 范围：本地工具 **picbed**——扫描目录中 Markdown / HTML 等文档内嵌图片，经 PicX 同源 **GitHub 图床通道**上传，自动回写稳定公开链接；**CLI 供人与 Agent**，**本地 Web 控制台**供人拖拽/点选操作。
> 约束输入（用户确认 2026-09-23）：
> - 形态：**CLI + 本地 Web UI**（非公网、非多用户、不做 Tauri/桌面壳）
> - 痛点：CLI 对人类不友好；希望**拖拽文档**即可工作；Agent 仍走 CLI 契约
> - 图床：对齐 PicX 模型 = **GitHub Contents API + URL 风格约定**；另支持 `local` 后端（F13）
> - 交付：F1–F15 已实现；**F16–F22 本期只设计**
>
> 技术选型已采用 **Node/TS**（§7）；UI 栈见 §7.1（可改）。

---

## 1. 目标与非目标

### 目标
- G0 抽取：从目录内 Markdown / HTML 文档中识别内嵌图片引用（含代码块防护）。
- G1 解析：将相对路径解析为本地文件，内容哈希去重，生成可预览的上传计划。
- G2 上传：经 GitHub Contents API 将图片写入图床仓库，生成稳定公开 URL（raw / jsdelivr / custom）。
- G3 回写：把文档中的本地引用替换为公开链接，可 dry-run、可备份、可 revert。
- G4 Agent 契约：无交互默认、稳定退出码、`--json` schema、幂等重跑。
- G5 安全：token 不入库、不进日志/manifest；默认拒绝路径越界与绝对路径。
- G6 本地 Web 控制台：人在浏览器中**拖拽文档/目录**或选择路径完成 scan/plan/sync/revert/config/doctor/watch（F16–F22）。

### 非目标
- 公网部署、多用户/账号体系、云端托管 UI。
- Tauri / Electron 桌面壳（若需再单列设计）。
- 完整图床资产管理 GUI（picx-app 已覆盖）：不做相册/批量改图工具箱。
- GitHub OAuth 登录（已移除；用 PAT / `gh auth token`）。
- 图片压缩、水印、裁剪工具箱。
- 非图片二进制托管（PDF / 视频等）。

### 已超出原 v1 划界但已实现
- 多图床：`HostAdapter` 工厂（**github | local**，F13）。
- watch 监听、MCP 包装（F12 / F14）。
- 本地 Web 控制台（F16–F22）——原「CLI only」非目标已按用户确认收窄为「不做公网/桌面壳」。

---

## 2. 总体架构

分层 + 单向依赖：**CLI / WebUI（呈现）→ 应用编排 → 领域核心 → 主机/文件系统适配器**。核心域无网络 I/O，便于单测。

```
┌──────────────────────────────────────────────────────────┐
│  CLI 层 picbed                                           │
│   init · doctor · scan · plan · sync · upload · revert · watch · config · ui │
│   退出码 / --json / --yes / --dry-run / --quiet             │
└───────────────▲──────────────────────────────────────────┘
                │  命令 DTO / 结果 DTO
┌───────────────┴──────────────────────────────────────────┐
│  WebUI 呈现层（本地控制台 F16–F22）                        │
│   静态页 + HTTP API · 拖拽/路径工作台 · ConfirmGate        │
│   仅 127.0.0.1 · token 不进浏览器                         │
└───────────────▲──────────────────────────────────────────┘
                │  同一应用 DTO / JSON 信封
┌───────────────┴──────────────────────────────────────────┐
│  应用编排 Application                                      │
│   SyncOrchestrator · PlanBuilder · DoctorService           │
└───────────────▲──────────────────────────────────────────┘
                │
┌───────────────┴──────────────────────────────────────────┐
│  领域核心 Core（栈无关、无 I/O）                             │
│   DocumentScanner · RefExtractor · AssetResolver           │
│   Deduper · LinkRewriter · ManifestModel · ExitPolicy      │
└───────▲───────────────────────▲───────────────────────────┘
        │                       │
┌───────┴────────┐     ┌───────┴───────────────────────────┐
│ HostAdapter    │     │ LocalStore                          │
│ GitHub Contents│     │ FS · hash · cache · backup · manifest │
└────────────────┘     └───────────────────────────────────┘
```

### 2.1 存储层

| 存储 | 内容 | 位置 | 写者 |
|------|------|------|------|
| 源文档 | md / html 等 | 用户指定目录（默认原地回写；`--out-dir` 写副本） | 用户 / `LinkRewriter` |
| HTML 呈现 | 设计评审页 | `docs/html/index.html`（+ `styles.css` / `app.js`） | 设计维护者 |
| 源图片 | 本地图片文件 | 相对文档目录解析 | **只读**（picbed 不改图片字节） |
| 配置 | owner/repo/branch/dir/url 风格 | `./picbed.toml` / ENV | `init` / `config set` |
| Token | GitHub PAT / gh | **仅** `PICBED_GITHUB_TOKEN` / `GITHUB_TOKEN` / `gh auth token` | 用户（禁止入库） |
| Manifest | localPath+sha → publicUrl | `./.picbed/manifest.json` | `ManifestStore` |
| Backup | 回写前文档副本 | `./.picbed/backup/` | `LinkRewriter` |
| Cache | sha → 已上传 URL | 并入 manifest 或 `./.picbed/cache.json` | `SyncOrchestrator` |
| Run 记录 | 每次 sync/revert 等结果摘要 | `./.picbed/runs/`（建议 gitignore） | `RunRecorder`（webui） |
| 远端图床 | 图片 blob | GitHub 图床仓库 `{dir}/…` | `GitHubHostAdapter` |

设计要点：
- **图片字节只读**：工具只改文档中的链接文本，不改图片文件。
- **内容寻址幂等**：`sha256` 相同视为同一资产，不重复上传。
- **manifest 不可含 secret**：可供 Agent 与审计安全读取。
- **备份可关**：默认写 backup，`--no-backup` 关闭；revert 依赖 manifest 而非 backup 必须存在。

### 2.2 领域服务层（核心能力）

- **DocumentScanner**：遍历目录，按扩展名/忽略规则得到 `DocFile[]`。
- **RefExtractor**：从 MD/HTML 抽取 `ImageRef[]`（精确偏移，跳过 fenced/inline code）。
- **AssetResolver**：相对文档目录解析路径；校验存在性/MIME/扩展名；拒绝越界与默认拒绝绝对路径。
- **Deduper**：按 `sha256` 合并多引用为单 `Asset`。
- **PlanBuilder**：产出 `upload | skip-cache | skip-remote | rewrite-only | blocked` 计划。
- **HostAdapter**：`GitHubHostAdapter` / `LocalHostAdapter`；`createHostAdapter` 按 `host.type` 注入；生成 public URL。
- **LinkRewriter**：按偏移切片替换 URL，保留 alt/title/srcset 其它候选；原子写。
- **ManifestStore**：读写映射，支撑幂等、revert、审计。
- **DoctorService**：配置完整性、token 探测、API 连通与权限。
- **WebUiFacade / UiServer / ConfirmGate / ViewMapper**（webui）：本机 HTTP 控制台、写操作确认门、拖拽工作集与视图映射；**不**重写域规则（F16–F22）。

### 2.3 应用编排

- **SyncOrchestrator**：scan → extract → resolve → plan → upload（限流/退避）→ rewrite → manifest。
- 单文件失败隔离：默认继续，结果标记 `partial`（退出码 6）。
- `--dry-run`：只跑到 plan 并输出，不写文档、不上传（或 `plan` 子命令等价）。

---

## 3. 领域模型（栈无关）

```text
DocFile ──contains──► ImageRef ──resolves──► Asset ──uploads──► RemoteImage
                         │                     │                     │
                         │                     └── sha256 去重        └── publicUrl
                         └── start/end 精确替换锚点
ManifestEntry: (doc, raw, localPath, sha256, publicUrl, updatedAt)
SyncPlanItem:  action + asset? + remote? + reason?
SyncResult:    ok, uploaded, rewrittenDocs[], mapping, warnings[], errors[]
```

不变量：
1. 同一 `sha256` 在一次 run 中至多产生一次远端写入（缓存命中则零写入）。
2. 文档回写只改变被抽取引用的 URL 子串，不重排其它文本。
3. 配置与 manifest、日志中不得出现 token 明文。

---

## 4. 图床通道（PicX / GitHub）

PicX 图床本质是 **GitHub 仓库文件托管 + URL 风格**。picbed 对齐概念：

| PicX 概念 | picbed 配置 | 说明 |
|-----------|--------------|------|
| Token | `PICBED_GITHUB_TOKEN` / `GITHUB_TOKEN` / `gh auth token` | PAT 或 GitHub CLI；repo 或 fine-grained Contents RW |
| Owner / Repo / Branch / 目录 | `github.owner/repo/branch/dir` | 图床仓库 |
| CDN 规则 | `url.style` | `raw` \| `jsdelivr` \| `custom` |

上传路径模板（可配置）：`{dir}/{yyyy}/{mm}/{sha12}-{safeName}`  
URL：
- raw：`https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
- jsdelivr：`https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}`
- custom：用户模板

限流：并发默认 2–3；403/429 指数退避；单文件建议 ≤50MB。

---

## 5. CLI 与 Agent 契约（摘要）

| 命令 | 作用 |
|------|------|
| `init` | 生成配置模板 |
| `doctor` | 鉴权与连通自检 |
| `scan` | 只解析引用 |
| `plan` | 上传/跳过计划 |
| `sync` | 上传并回写 |
| `upload` | 单文件上传 |
| `revert` | 按 manifest 还原本地链接 |
| `config` | get/set/list（token 掩码） |
| `ui` | 启动本地 Web 控制台（F16；命令名已冻结为 `ui`） |

全局：`--json --quiet --verbose --config --cwd --yes --dry-run`  
退出码：0 成功 / 2 用法 / 3 配置鉴权 / 4 本地文件 / 5 远端 API / 6 部分成功 / 7 需确认。  
Web API 信封与退出码语义对齐 [`design/cross-cutting.md`](design/cross-cutting.md)；详细 AC 见 [`features-index.md`](features-index.md)。

---

## 6. 安全与隐私

- Token 最小权限：仅目标图床仓库 Contents 读写。
- 拒绝：路径穿越（`..` 出根）、默认拒绝绝对路径与 `file://`。
- 日志/JSON 错误禁止回显 secret；`config list` 掩码。
- `.picbed/backup`、`manifest`、`.picbed/runs` 建议 gitignore（manifest 无 secret 仍建议本地）。
- **Web 控制台**：默认只监听 `127.0.0.1`；token **永不**进入 HTTP 响应/页面；写操作需页面确认 + 服务端 `confirm`；同源静态 + API，不做跨站开放；非回环绑定须显式且告警。

---

## 7. 技术选型（可改）

| 项 | 推荐 | 备选 | 理由 |
|----|------|------|------|
| 语言 | TypeScript + Node ≥20 | Go | 与 PicX 生态同源；MD/HTML 库成熟；npm/npx 易被 Agent 调用 |
| CLI | commander / citty | urfave/cli (Go) | 子命令清晰 |
| 校验 | zod | — | 配置与 JSON schema |
| HTTP | undici | net/http | 可控超时/重试 |
| 测试 | vitest + fixture | go test | 黄金文件友好 |

栈无关设计优先；定栈后仅实例化目录与构建，不改 AC。

### 7.1 Web 控制台（F16–F22，可改）

| 项 | 推荐 | 备选 | 理由 |
|----|------|------|------|
| 服务 | Node `http` / 轻量路由（与 CLI 同进程可 spawn） | fastify | 本地单用户，无需重框架 |
| 前端 | 轻量 Vite + 原生 SPA（**已冻结**；不引入 React） | React | 拖拽 + 列表工作台足够；避免重依赖 |
| 实时进度 | SSE | 轮询 | sync/watch 推送简单 |
| 拖拽路径 | 根绑定 + 相对路径解析（**策略 A，已冻结**） | File System Access 预览暂存（不纳入） | 浏览器不给绝对路径；原地回写必须服务端可解析真实路径 |

---

## 8. NFR

- 正确性 > 速度：误改文档不可接受（偏移替换 + 黄金测试）。
- 可脚本化：无 TTY 不阻塞；同一命令重复执行结果可预测。
- 可观测：`--verbose` 逐步日志；JSON 内含 counts 与 per-item 结果。
- 可移植：Windows 路径分隔符与大小写敏感差异在 Resolver 统一。

---

## 9. 分支模型（Git Flow + 文档分支）

| 分支 | 职责 |
|------|------|
| `main` | 发布/稳定 |
| `develop` | 功能集成 |
| `feature/*` | 实现（如 `feature/yigecli-mvp`，历史分支名） |
| `docs/design` | **文档设计专属分支**（`docs/`、HTML 呈现、标识体系变更优先落此分支） |
| `release/*` / `hotfix/*` | 可选 |

约定：设计评审与文档修订走 `docs/design`；代码实现走 `feature/*`，里程碑冻结时把设计快照合入 `develop`/`main`。

## 10. 分期（与 F/P 对齐，引用不重定义 AC）

| 阶段 | 内容 | 对应优先级 | 状态 |
|------|------|------------|------|
| M0 设计冻结 | 本文档 + features-index + modules | — | done |
| M1 骨架 | init/doctor/config | P0 子集 | done |
| M2 抽取 | scan/plan | P0 | done |
| M3 上传 | upload/sync 幂等 | P0 | done |
| M4 回写 | rewrite/revert | P0 | done |
| M5 打磨 | Agent schema / 发布 | P1 | done（v0.2.0） |
| M6 扩展 | F12 watch / F13 multi-host / F14 MCP / F15 token auth | P0/P3 | done |
| M7 Web 控制台 | F16–F18 最小闭环（服务+拖拽工作台+sync） | P0 | **done** |
| M8 Web 完备 | F19–F22 revert/config/doctor/审计/watch | P1–P2 | design only |

具体功能点、AC 与模块归属：[`features-index.md`](features-index.md)。

---

## 11. 状态与开放问题

1. URL 默认风格：jsdelivr / raw / 自定义域名？（当前模板默认 jsdelivr）  
2. ~~命令名/包名是否冻结为 `picbed`？~~ **已冻结**（2026-09-22，由 `yigecli` 更名）。  
3. ~~v1 是否纳入 watch、VS Code 集成？~~ **已实现 F12/F14**。  
4. ~~实现语言最终确认 Node/TS 或 Go？~~ **已采用 Node/TS**。  
5. 是否增加更多 HostAdapter（对象存储等）？  
6. 是否发布到 npm 官方源？（当前仅 GitHub Release tarball）  
7. ~~Web 子命令名：`ui` 还是 `serve`？~~ **已冻结为 `ui`**（2026-09-23，用户确认）；不为 `serve` 保留别名。  
8. ~~Web 前端栈：原生 / 轻量 Vite / React？~~ **已冻结为轻量 Vite + 原生 SPA（不引入 React）**（2026-09-23，采纳建议）。  
9. ~~拖拽后「无 root」时：强制先绑根，还是允许暂存预览（策略 B）？~~ **已冻结为策略 A：强制先绑根**（2026-09-23）；未绑根不得进入 scan/plan/sync；暂存预览不纳入本期。  
10. ~~watch 在 UI 默认模式：`preview` / `confirm-each` / `auto`？~~ **已冻结为默认 `preview`**（2026-09-23，采纳建议）；`auto` 须显式打开并仍写 RunRecord。

---

*功能定义看总表，域规则看 module-*，本文只负责怎么分层与为何这样分。*
