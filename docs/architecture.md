# picbed 架构设计

> 状态：**F1–F24 已实现**（F24 Electron 双形态：npm + Windows 安装包）· Node/TS CLI + 本地 Web UI + Desktop 壳
> 定位：**架构总纲**（分层 / 存储 / CLI 契约 / 数据模型 / 安全 / NFR / 技术选型）。
> 功能点的完整规格（优先级、AC、实现归属、双向链接）以 [`features-index.md`](features-index.md) 为唯一来源；本文档不重复其逐条 AC。
> **新人阅读指南**（F 编号、模块名、文档怎么串）：[`design-reading-guide.md`](design-reading-guide.md)。
> 范围：本地工具 **picbed**——扫描目录中 Markdown / HTML 等文档内嵌图片，经 PicX 同源 **GitHub 图床通道**上传，自动回写稳定公开链接；**CLI 供人与 Agent**，**本地 Web 控制台**供人拖拽/点选操作，**桌面应用**供终端用户安装即用。
> 约束输入：
> - 形态（2026-09-23）：**CLI + 本地 Web UI**（非公网、非多用户）
> - 形态（2026-09-26 用户确认）：**双形态**——npm 保留本地开发测试与 Agent 通道；发布后提供 **Windows 桌面安装包**（Electron）供用户下载安装使用
> - 痛点：CLI 对人类不友好；希望**拖拽文档**即可工作；Agent 仍走 CLI 契约；终端用户不应被要求装 Node
> - 图床：对齐 PicX 模型 = **GitHub Contents API + URL 风格约定**；另支持 `local` 后端（F13）
> - 交付：F1–F24 已实现；桌面壳见 [`design/module-desktop.md`](design/module-desktop.md)
>
> 技术选型已采用 **Node/TS**（§7）；UI 栈见 §7.1；桌面壳见 §7.2。

---

## 1. 目标与非目标

### 目标
- G0 抽取：从目录内 Markdown / HTML 文档中识别内嵌图片引用（含代码块防护）。
- G1 解析：将相对路径解析为本地文件，内容哈希去重，生成可预览的上传计划。
- G2 上传：经 GitHub Contents API 将图片写入图床仓库，生成稳定公开 URL（raw / jsdelivr / custom）。
- G3 回写：把文档中的本地引用替换为公开链接，可 dry-run、可备份、可 revert。
- G4 Agent 契约：无交互默认、稳定退出码、`--json` schema、幂等重跑。
- G5 安全：token 不入库、不进日志/manifest；默认拒绝路径越界与绝对路径。
- G6 本地 Web 控制台：人在浏览器中**拖拽图片或文档**（不接受文件夹）完成 scan/plan/sync/revert/config/doctor/watch（F16–F22）。

### 非目标
- 公网部署、多用户/账号体系、云端托管 UI。
- 完整图床资产管理 GUI（picx-app 已覆盖）：不做相册/批量改图工具箱。
- GitHub OAuth 登录（已移除；用 PAT / `gh auth token`）。
- 图片压缩、水印、裁剪工具箱。
- 非图片二进制托管（PDF / 视频等）。
- macOS/Linux 安装包首发（链路预留，见 F24；Windows 优先）。

### 已超出原 v1 划界但已实现
- 多图床：`HostAdapter` 工厂（**github | local**，F13）。
- watch 监听、MCP 包装（F12 / F14）。
- 本地 Web 控制台（F16–F23）——原「CLI only」非目标已按用户确认收窄。
- **桌面壳（F24）**——原「不做 Tauri/桌面壳」已于 2026-09-26 按用户双形态需求打开；设计见 [`design/module-desktop.md`](design/module-desktop.md)。

---

## 2. 总体架构

分层 + 单向依赖：**CLI / WebUI（呈现）→ 应用编排 → 领域核心 → 主机/文件系统适配器**。核心域无网络 I/O，便于单测。

**跨层单点（`src/lib/`，2026-10-02 补）**：越界判定、图片扩展名、摘要计算、token 掩码这类「错了即安全/数据事故」的横切逻辑，只放在 `src/lib/`（`paths.ts` / `img.ts` / `hash.ts` / `mask.ts`），任何层都从这里取用——此前它们在 6 / 3 / 3 / 2 处各自实现。例外：`app/repo-dir.ts` 的**远端**目录路径规则（段字符白名单 + 长度上限）与本地 FS 越界是两套语义，不合并；`watch.ts` 的根外事件退化为绝对路径也不是越界守卫。防回归见 `tests/lib-single-source.test.ts`。

```
┌──────────────────────────────────────────────────────────┐
│  分发形态                                                 │
│   npm：picbed / picbed-mcp / picbed ui                    │
│   桌面：Electron 壳 + Windows NSIS 安装包（F24）            │
└───────────────▲──────────────────────────────────────────┘
                │
┌───────────────┴──────────────────────────────────────────┐
│  CLI 层 picbed                                           │
│   init · doctor · scan · plan · sync · upload · revert · watch · config · ui │
│   退出码 / --json / --yes / --dry-run / --quiet             │
└───────────────▲──────────────────────────────────────────┘
                │  命令 DTO / 结果 DTO
┌───────────────┴──────────────────────────────────────────┐
│  WebUI 呈现层（本地控制台 F16–F23）                        │
│   静态页 + HTTP API · 拖拽/路径工作台 · ConfirmGate        │
│   仅 127.0.0.1 · token 不进浏览器                         │
│   Desktop 壳（F24）加载同一 SPA；picbedNative 可选桥        │
└───────────────▲──────────────────────────────────────────┘
                │  同一应用 DTO / JSON 信封
┌───────────────┴──────────────────────────────────────────┐
│  应用编排 Application（app 共享层）                          │
│   collect/runPlan/runSync/runRevert · Doctor/Config/Runs     │
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
| Cache | sha → 已上传 URL | 并入 manifest 或 `./.picbed/cache.json` | `SyncOrchestrator`（app 共享层） |
| Run 记录 | 每次 sync/revert 等结果摘要 | `./.picbed/runs/`（建议 gitignore） | `RunRecorder`（app 共享层） |
| 远端图床 | 图片 blob | GitHub 图床仓库 `{dir}/…` | `GitHubHostAdapter` |

设计要点：
- **图片字节只读**：工具只改文档中的链接文本，不改图片文件。
- **内容寻址幂等**：`sha256` 相同视为同一资产，不重复上传。
- **manifest 不可含 secret**：可供 Agent 与审计安全读取。
- **备份可关**：默认写 backup，`--no-backup` 关闭；revert 依赖 manifest 而非 backup 必须存在。

### 2.2 领域服务层（核心能力）

> ⚠️ 下面这些是**讨论用的逻辑角色名**，不是代码里的类名或文件名（源码中真实同名的只有 `HostAdapter` 家族与 `DoctorService`）。
> 想知道每个角色落在哪个文件、导出什么函数，见 **§2.5.2 概念 → 代码实体**。

- **DocumentScanner**：遍历目录，按扩展名/忽略规则得到 `DocFile[]`。
- **RefExtractor**：从 MD/HTML 抽取 `ImageRef[]`（精确偏移，跳过 fenced/inline code）。
- **AssetResolver**：相对文档目录解析路径；校验存在性/MIME/扩展名；拒绝越界与默认拒绝绝对路径。
- **Deduper**：按 `sha256` 合并多引用为单 `Asset`。
- **PlanBuilder**：产出 `upload | skip-cache | skip-remote | rewrite-only | blocked` 计划。
- **HostAdapter**：`GitHubHostAdapter` / `LocalHostAdapter`；`createHostAdapter` 按 `host.type` 注入；生成 public URL。
- **LinkRewriter**：按偏移切片替换 URL，保留 alt/title/srcset 其它候选；原子写。
- **ManifestStore**：读写映射，支撑幂等、revert、审计。
- **DoctorService**（app 共享层）：配置完整性、token 探测、API 连通与权限；按 `host.type` 分派，local 主机不要求 token。见 `design/module-app.md`。
- **WebUiFacade / UiServer / ConfirmGate / ViewMapper**（webui）：本机 HTTP 控制台、写操作确认门、拖拽工作集与视图映射；**不**重写域规则（F16–F22）。
- **AppShell / SideNav / DropZone**（webui 呈现壳层，F23）：双栏布局、管理/设置导航、文件放置英雄区与主题令牌；只消费既有 API。
- **DesktopShell / NativeBridge**（desktop，F24）：Electron 主进程宿主 UI 服务与窗口；preload 暴露目录/文件对话框；打包 NSIS。**不**承载业务规则。

### 2.3 应用编排

- **SyncOrchestrator**：scan → extract → resolve → plan → upload（限流/退避）→ rewrite → manifest。
- 单文件失败隔离：默认继续，结果标记 `partial`（退出码 6）。
- `--dry-run`：只跑到 plan 并输出，不写文档、不上传（或 `plan` 子命令等价）。
- **唯一实现**落在 `src/app/`（collect/plan/sync/revert/doctor/config/runs，见 `design/module-app.md`）；CLI 与 WebUI 只做协议适配（参数解析 / JSON 信封 / HTTP 状态码）与确认门，不各自复制编排逻辑。
- **错误单一来源**：`AppError { code, exitCode, path?, hint? }` 统一定义 code → 退出码 → HTTP 状态码映射，见 `design/module-app.md`。

### 2.4 源码目录与发布单元（2026-10-02 补）

**不变式：放进 `src/` = 进 npm 包。** 一条链决定了这件事——

```
tsconfig.json  rootDir=src · include=src/** · outDir=dist
      ↓
package.json   files=[bin, dist, README.md]
```

于是顶层目录的划分维度**不是「是不是源码」**，而是**「发布目标」**：`renderer/`、`desktop/`、`scripts/`、`tests/` 同样是源码，但都不属于 npm 包，所以在链外。

| 目录 | 内容 | 谁构建 | 产物 | 发布目标 |
|------|------|--------|------|----------|
| `src/` | CLI / MCP / UI 服务器（TypeScript strict，`checkJs`） | `tsc` | `dist/**` | **npm 包** + 桌面包 |
| `renderer/` | Web 控制台前端 F16–F23（浏览器原生 ESM，**零构建**） | 无（原样） | 自身 | 桌面包；`picbed ui` 由 UI 服务器静态下发 |
| `desktop/` | Electron 壳（main ESM + preload CJS） | `electron-vite` | `out/main` `out/preload` | 桌面包 |
| `scripts/` | 构建 / 巡检工具 | 无（`node` 直跑） | — | 仓库本地 / CI |
| `tests/` | vitest 用例与夹具 | 无 | — | 仓库本地 |

约束（移动前先看这些）：

1. **`src/ui/http/static.ts`** 用 `new URL('../../../renderer')` 按**包根相对位置**定位渲染器；renderer 一旦进 `dist/`，相对路径会对不上 Vite dev 的另一套根。
2. **`electron.vite.config.mjs`** 的 `renderer.root` 是 Vite 静态根、rollup input 是 `renderer/index.html`。把 root 上提到 `src/` 会让 dev server 把**整个 `src/` 当静态根暴露**（TS 源码可被 HTTP 取到）。
3. **`renderer/` 是 Electron/Vite 生态术语**（`main` / `preload` / `renderer` 三块；main process / renderer process）。不改成 `console/` 之类自造名：改名要在 ≥5 处同步（含测试断言与设计文档），却丢掉生态可识别性。

实测代价（把 `renderer/` + `scripts/` 复制进 `src/` 各编译一次）：

| 指标 | 现状 | 移进 `src/` |
|------|------|-------------|
| `tsc` 错误 | 0 | **50 行**（`TS7053` / `TS7006`…strict 下的浏览器 JS） |
| `dist/` 文件 | 204 | 270（+`dist/renderer` 57、+`dist/scripts` 9） |
| npm tarball | 208 文件 / 120.5 KB | **274 文件 / 160.6 KB**（+33%） |

守卫：`tests/package-surface.test.ts`（manifest 级：入口/bin/exports 不得越界发布面）+ `npm run validate:pack`（真实 `npm pack --dry-run --json` 审计 tarball，需先 `npm run build`）。npm 导出面细则见 `design/module-desktop.md`「npm 包导出面」。

### 2.5 当前实现地图（2026-10-02 补）

> §2–§2.3 描述的是**逻辑角色**（`DocumentScanner` 这类名字便于讨论，**不是**代码里的类名／文件名）。本节才是磁盘上的实际代码，两者由 2.5.2 的映射表连接。

#### 2.5.1 运行时形态：一份编排，四个宿主

同一份应用编排（`src/app/*`）被四个宿主复用，**任何宿主都不复制业务规则**：

```text
[1] picbed <cmd>  bin/picbed.js → src/cli.ts（commander，547 行）──────────┐
                                                                            │
[2] picbed ui     同一 cli.ts 的 `ui` 子命令 → import('./ui/index.js')       ├─► src/app/*
                  → createUiServer → listen(127.0.0.1:4780) → 浏览器 /api/* │      │
                                                                            │      ▼
[3] picbed-mcp    bin/picbed-mcp.js → src/mcp/server.ts（stdio JSON-RPC）───┤   src/{scan,extract,resolve,
                                                                            │        plan,rewrite,manifest}.ts
[4] Electron 桌面  desktop/main.mjs:80 动态 import('../dist/ui/index.js')   │              │
                  → 同一个 createUiServer                                    │              ▼
                  → dev: listen(4780) 供 Vite proxy /api；prod: listen(0)   │        src/host/*（适配器）
                  → BrowserWindow.loadURL(uiHandle.url) ────────────────────┘
```

| 宿主 | 入口 | 关键事实 |
|------|------|----------|
| CLI | `bin/picbed.js` → `dist/cli.js` ← `src/cli.ts` | commander；`ui` 子命令在同一文件懒加载 UI 服务器（`cli.ts:295`）；默认 host `127.0.0.1` / port `4780`（`cli.ts:116-117`），非回环绑定会告警（`cli.ts:292`） |
| Web UI | `src/ui/server.ts` `createUiServer`（190 行，**只装配**） | 一个 Node 进程同时承载静态下发与 `/api/*`；流程为 安检（`http/guard`）→ 静态（`http/static`）→ 路由表（`routes/`） |
| MCP | `src/mcp/server.ts`（204 行） | stdio JSON-RPC，供 Agent 调用，与 CLI 共用 `src/app/*` |
| 桌面 | `desktop/main.mjs` | **不重新实现 UI**：动态 `import('../dist/ui/index.js')` 取 `createUiServer`（`main.mjs:80-86`）；dev 固定 `4780` 让 Vite 代理 `/api`，prod 用 `listen(0)` 由 OS 分配（`main.mjs:87-90`），窗口加载 `uiHandle.url`（`main.mjs:149`） |

#### 2.5.2 §2.2 概念 → 代码实体

| §2.2 概念 | 代码实体 | 备注 |
|-----------|----------|------|
| `DocumentScanner` | `src/scan.ts` → `scanDocs()` | |
| `RefExtractor` | `src/extract.ts` → `extractRefs()` + `blankCodeRegions()` | 代码块防护抽成独立函数 |
| `AssetResolver` | `src/resolve.ts` → `resolveAssets()` | 越界判定取 `src/lib/paths.ts` |
| `Deduper` | **`src/resolve.ts:103-112` 内联**（`sha256Hex` → 以 sha 为 key 合并引用） | **无**独立类/文件 |
| `PlanBuilder` | `src/plan.ts` → `buildPlan()` | 输出五态 action |
| `LinkRewriter` | `src/rewrite.ts` → `rewriteDoc()` / `applyRewrites()` / `writeDocAtomic()` / `revertDoc()` | 原子写在同文件 |
| `ManifestStore` | `src/manifest.ts` → `loadManifest` / `saveManifest` / `upsertEntry` / `findCachedUrl()` | |
| `HostAdapter` 工厂 | `src/host/index.ts` → `createHostAdapter()`；实现在 `github.ts` / `local.ts` | 代码中**真实同名** |
| `DoctorService` | `src/app/doctor.ts` → `doctorService()` | 代码中**真实同名** |
| `SyncOrchestrator` | `src/app/sync.ts` → `runSync()` | scan → … → manifest 全流程 |
| `RunRecorder` | `src/app/run-store.ts` → `recordRun` / `listRuns` / `getRun()` | |
| `ConfirmGate` | 写操作的确认语义，落在 `src/ui/routes/{sync,revert}.ts` 等路由 | 类名不存在 |
| `ViewMapper` / `WebUiFacade` / `AppShell` / `SideNav` / `DropZone` | `renderer/index.html` + `renderer/src/features/*`（如 `drop.js` 英雄区） | 纯前端，**不在** `src/` |
| `NativeBridge` / `DesktopShell` | `desktop/main.mjs` + `desktop/preload.cjs`（`picbedNative` 桥） | |

已核实：22 个角色名里仅 `HostAdapter`、`GitHubHostAdapter`、`LocalHostAdapter`、`DoctorService`、`picbedNative` 在源码中真实出现，其余为讨论用名，勿按名 grep。

#### 2.5.3 全仓目录树（逐文件职责）

> 注释来自代码事实（文件头 doc / 导出符号 / 既有守卫），非命名推测。读法：先看 §2.4 的「目录 × 发布目标」，再看本树「每个文件干什么」，最后看 §2.5.4「谁能 import 谁」。

```text
picbed/
├─ bin/                              // npm 包入口垫片（发布面内）
│  ├─ picbed.js                      //   picbed 命令入口 → dist/cli.js
│  └─ picbed-mcp.js                  //   picbed-mcp 命令入口 → dist/mcp/server.js
│
├─ src/                              // ★ 唯一进 npm 包的源码树（tsc → dist/）
│  │
│  │  ── 领域核心（根目录平铺；无网络 I/O；不存在 core/ 目录）──
│  ├─ types.ts                       // 领域模型唯一真源：DocFile/ImageRef/Asset/SyncPlanItem/ManifestEntry…
│  ├─ scan.ts                        // scanDocs() 遍历目录产出 DocFile[]          （= DocumentScanner）
│  ├─ extract.ts                     // extractRefs() 从 MD/HTML 抽 ImageRef[]；blankCodeRegions() 防代码块误伤
│  ├─ resolve.ts                     // resolveAssets() 相对路径→本地文件 + sha256 合并去重（AssetResolver；Deduper 内联在此，无独立类）
│  ├─ plan.ts                        // buildPlan() 产出 upload|skip-cache|skip-remote|rewrite-only|blocked 五态
│  ├─ rewrite.ts                     // rewriteDoc()/applyRewrites() 偏移切片替换；writeDocAtomic() 原子写；revertDoc() 回滚
│  ├─ manifest.ts                    // .picbed/manifest.json 读写：load/save/upsertEntry/findCachedUrl
│  ├─ watch.ts                       // fs.watch 调度；根外事件退化为绝对路径（非越界守卫，见 §2 开头的例外说明）
│  ├─ config.ts                      // picbed.toml 解析/校验/模板；token 只从 env / gh 取，禁止入库
│  ├─ user-token.ts                  // 本机用户级 PAT 存储（~/.picbed/credentials.json；不进 git、不写 toml）
│  │
│  │  ── 跨层单点（错了即安全/数据事故的横切逻辑；tests/lib-single-source 守护）──
│  ├─ lib/
│  │  ├─ paths.ts                    //   本地路径越界判定的唯一实现
│  │  ├─ img.ts                      //   图片扩展名 / MIME 的唯一真源
│  │  ├─ hash.ts                     //   sha256 唯一实现 + 远端文件名 12 位短摘要
│  │  └─ mask.ts                     //   token 掩码唯一实现（config / app / ui 共用）
│  │
│  │  ── 应用编排（唯一实现；CLI / WebUI / MCP 一律从这里取能力）──
│  ├─ app/
│  │  ├─ index.ts                    //   统一出口（facade）
│  │  ├─ errors.ts                   //   AppError：code → 退出码 → HTTP 状态码的唯一映射
│  │  ├─ collect.ts                  //   collect() 收集工作集文档
│  │  ├─ plan.ts                     //   runPlan() 预览计划
│  │  ├─ sync.ts                     //   runSync() 上传→回写→manifest 全流水线（= SyncOrchestrator）
│  │  ├─ revert.ts                   //   runRevert() 按 manifest 还原本地链接
│  │  ├─ upload.ts                   //   uploadSingleAsset() 单文件上传
│  │  ├─ doctor.ts                   //   doctorService() 配置完整性/凭据/连通自检（按 host.type 分派）
│  │  ├─ settings.ts                 //   resolvedConfig() —— ui 层取配置的唯一入口（禁直连 config.ts）
│  │  ├─ auth.ts                     //   鉴权 façade：token 获取与 gh 登录能力，UI/CLI 只许从这里取
│  │  ├─ repo-dir.ts                 //   远端目录规则：段白名单(字母数字_-.与CJK)+长度上限（GitHub 无空目录 API）
│  │  └─ run-store.ts                //   .picbed/runs/ 运行记录：recordRun/listRuns/getRun（= RunRecorder）
│  │
│  │  ── 图床适配器（端口 + 实现，F13 双后端）──
│  ├─ host/
│  │  ├─ types.ts                    //   HostAdapter 端口接口（AC7 语义稳定）
│  │  ├─ index.ts                    //   createHostAdapter() 工厂：github | local（代码中真实同名）
│  │  ├─ github.ts                   //   GitHubHostAdapter：Contents API 上传 + raw/jsdelivr/custom URL
│  │  └─ local.ts                    //   LocalHostAdapter：本地目录后端
│  │
│  ├─ infra/                         // 外部进程/凭据基础设施
│  │  └─ gh-cli.ts                   //   无 OAuth App 的 token 来源：gh auth token / gh api
│  │
│  │  ── WebUI 呈现层（服务端；picbed ui 与 Electron 桌面共用同一份）──
│  ├─ ui/
│  │  ├─ server.ts                   //   createUiServer()：安检→静态→路由表；只装配无业务（<200 行，layering 守卫）
│  │  ├─ root.ts                     //   RootBinder：拖拽策略 A——先绑根，再把相对线索映射到真实 FS
│  │  ├─ watch.ts                    //   WatchController：watch 的 UI 状态机（preview | confirm-each | auto）
│  │  ├─ gh-login.ts                 //   GhLoginStore：gh auth login 会话单例（同时只允许一个流程）
│  │  ├─ context.ts                  //   UiRouteContext：安检放行后交给路由的依赖注入（含拖拽工作集条目）
│  │  ├─ http/                       //   HTTP 协议横切
│  │  │  ├─ guard.ts                 //     同源 / X-Picbed-UI / Host / 请求体安检
│  │  │  ├─ body.ts                  //     请求体大小上限
│  │  │  ├─ envelope.ts              //     统一 JSON 信封（CLI / MCP / WebUI 同形状）
│  │  │  ├─ errors.ts                //     未捕获异常 → 状态码+信封（状态码真源在 app/errors.ts）
│  │  │  └─ static.ts                //     下发 renderer/**；/src/** 仅白名单后缀、禁目录逃逸
│  │  ├─ routes/                     //   业务路由（12 个，各 <250 行，layering 守卫）
│  │  │  ├─ session.ts               //     根绑定 + 拖拽工作集（服务端唯一可变状态）
│  │  │  ├─ plan.ts                  //     /api/scan + /api/plan
│  │  │  ├─ sync.ts                  //     /api/sync：ConfirmGate + dryRun + 工作集作用域
│  │  │  ├─ revert.ts                //     /api/revert：ConfirmGate；清单损坏单独 400
│  │  │  ├─ preview.ts               //     图片预览 MIME（仅预览用；上传语义以 manifest/adapter 为准）
│  │  │  ├─ runs.ts                  //     运行记录：列表 + 单条
│  │  │  ├─ config.ts                //     配置读写（token 掩码）
│  │  │  ├─ auth.ts                  //     PAT 粘贴保存/清除（写凭据文件，不写 toml）
│  │  │  ├─ watch.ts                 //     监听：状态 / 启动 / 停止
│  │  │  ├─ gallery.ts               //     图库：远端目录浏览 + 批量删除选中
│  │  │  ├─ system.ts                //     系统类只读端点：doctor 自检 + manifest 视图 + 远程目录创建
│  │  │  └─ health.ts                //     /api/health 存活探针
│  │  └─ spa/                        //   运行时读 renderer/index.html 导出 INDEX_HTML（单一 UI 源，非第二份 HTML）
│  │
│  └─ mcp/                           // MCP 呈现层
│     └─ server.ts                   //   stdio JSON-RPC：Agent 通道，复用 src/app/*，零自有业务
│
├─ renderer/                         // Web 控制台前端（零构建，浏览器原生 ESM；进桌面包+静态下发，不进 npm 包）
│  ├─ index.html                     //   壳层结构：Sidebar 72px + 四视图（上传/管理/图库/设置）
│  ├─ styles.css                     //   主题令牌（CSS 变量；JS 只写 data-theme/data-logo）
│  ├─ main.js                        //   <20 行，仅 import 引导（逻辑全在 src/ 下）
│  └─ src/
│     ├─ app.js                      //   视图装配：init 各 feature 并接线导航
│     ├─ lib/                        //   api.js(fetch+X-Picbed-UI 封装) / dom.js / files.js / titles.js
│     ├─ components/                 //   toast.js / modal.js / selectable-grid.js（可复用 UI）
│     └─ features/                   //   按功能垂直切：drop(拖拽) photo-wall gallery manage settings
│                                    //     theme logo dir-picker gh-login health（一功能一文件）
│
├─ desktop/                          // Electron 壳（进桌面包；npm 包不含）
│  ├─ main.mjs                       //   主进程：动态 import('../dist/ui/index.js') 复用 createUiServer；
│  │                                 //     窗口状态记忆 / 对话框 IPC / dev 热重载；零业务规则
│  ├─ preload.cjs                    //   contextBridge 暴露 picbedNative（唯一真源）：仅目录/文件对话框，不暴露 token 与任意 FS
│  ├─ icon.png                       //   electron-builder 安装包图标（buildResources）
│  └─ make-icon.py                   //   图标生成脚本（一次性工具，代码零引用；随 files: desktop/**/* 进桌面包）
│
├─ scripts/                          // 构建/巡检工具（node 直跑；仓库本地与 CI）
│  ├─ validate.mjs                   //   四 profile 门禁：design / bootstrap / scripts / pack（真实 tarball 审计）
│  ├─ build-desktop.mjs              //   electron-builder 打包（extraMetadata.main 注入 Electron 入口）
│  └─ desktop-dev.mjs                //   桌面 dev 编排：起 Vite + electron，代理 /api
│
└─ tests/                            // vitest（141 用例 / 16 文件；架构约定都有活守卫）
   ├─ layering.test.ts               //   分层 7 条断言（§2.5.4）
   ├─ lib-single-source.test.ts      //   跨层单点：横切逻辑只许在 src/lib/
   ├─ package-surface.test.ts        //   npm 导出面：files/bin/exports 不得越界
   └─ （其余 13 个：cli/ui/pipeline/host/mcp/desktop/auth/config/watch/repo-dir/extract/user-token）
```

规模：`src/` 61 文件 / 约 5.0k 行；`renderer/` 21 文件；`desktop/` 4 文件（preload 只允许 `.cjs` 一份，`tests/desktop.test.ts` 守着）；`scripts/` 3 文件；`tests/` 16 文件。

#### 2.5.4 依赖方向与守卫

依赖**只能向内**：呈现层（`cli.ts` / `ui/**` / `mcp/**`）→ `app` → 领域核心 → `host` / `infra`。这不是口头约定，由 **`tests/layering.test.ts`** 强制执行：

| 规则 | 断言位置 |
|------|----------|
| 呈现层不直连 `host/` / `infra/` / `user-token` | `layering.test.ts:28` |
| `ui/**` 不直连 `config.ts`，配置一律走 `app/settings.ts` 的 `resolvedConfig` | `:40` |
| `app/**` 不深连具体适配器实现，只走 `host` 端口 | `:48` |
| `app/**` 零呈现依赖（不碰 `node:http` / `commander` / `ui`） | `:55` |
| `host/**` 不反向依赖 `app/**` | `:77` |
| `ui/server.ts` 只做装配：不含 `'/api/'` 字面量且 <250 行 | `:62` |
| 业务路由都在 `ui/routes/` 下，各 <250 行 | `:69` |

另两道守卫：跨层单点由 `tests/lib-single-source.test.ts` 守；npm 发布面由 `tests/package-surface.test.ts` + `npm run validate:pack` 守（见 §2.4）。

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
- **桌面壳**：继承 WebUI 安全模型；`contextIsolation: true`、`nodeIntegration: false`；preload 仅暴露对话框/窗口状态，不暴露 token 或任意 FS 写。

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
| 前端 | **`renderer/` 单源 + electron-vite**（Vite HMR；`picbed ui` / 安装包静态下发同一套）（**已迁移 2026-09-27**，见 [`design/module-desktop.md`](design/module-desktop.md)） | React | 仍为原生 HTML/CSS/JS；Vite 只做开发构建，不引入组件框架 |
| 实时进度 | SSE | 轮询 | sync/watch 推送简单 |
| 拖拽路径 | 根绑定 + 相对路径解析（**策略 A，已冻结**） | File System Access 预览暂存（不纳入） | 浏览器不给绝对路径；原地回写必须服务端可解析真实路径 |

### 7.2 桌面壳（F24，2026-09-26 用户确认）

| 项 | 选型 | 备选 | 理由 |
|----|------|------|------|
| 桌面框架 | **Electron + electron-builder** | Tauri + Node sidecar | 复用 Node 核心与现有 WebUI，改动最小；Tauri 需 sidecar 重打包，链路更复杂 |
| 首发平台 | **Windows NSIS `.exe`** | macOS DMG / Linux AppImage | 用户确认 Windows 优先；同一 builder 可后扩 |
| 壳能力 | 完整控制台 + 原生目录对话框 + 窗口状态记忆 | 仅包一层窗口 | 用户确认要原生体验 |
| 依赖归属 | `electron`/`electron-builder`/`electron-vite`/`vite` 仅 devDependencies | 进 dependencies | `npm i -g picbed` 不应携带桌面运行时 |
| 运行模型 | 内嵌 `createUiServer` → `127.0.0.1` → BrowserWindow；dev 加载 Vite（HMR），prod 加载同源静态 UI | 自定义 protocol | 复用既有 HTTP API，契约零改动 |
| 开发工具链 | **electron-vite**（渲染 HMR + main/preload 重启） | 手写 `fs.watch` relaunch | 见 [`design/module-desktop.md`](design/module-desktop.md) |

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
| M8 Web 完备 | F19–F22 revert/config/doctor/审计/watch | P1–P2 | **done** |
| M9 UI 壳层重设计 | F23 四视图「上传/管理/设置/规范」+ 晨雾蓝×落日暖 | P0 | **done** |
| M10 桌面壳 | F24 Electron 壳 + Windows 安装包 + 原生对话框 | P0 | **done** |
| M11 渲染层 electron-vite | `renderer/` 单源 + Vite HMR + 照片墙等 UI 迭代 | P0 | **done** |

具体功能点、AC 与模块归属：[`features-index.md`](features-index.md)。

---

## 11. 状态与开放问题

1. URL 默认风格：jsdelivr / raw / 自定义域名？（当前模板默认 jsdelivr）  
2. ~~命令名/包名是否冻结为 `picbed`？~~ **已冻结**（2026-09-22，由 `yigecli` 更名）。  
3. ~~v1 是否纳入 watch、VS Code 集成？~~ **已实现 F12/F14**。  
4. ~~实现语言最终确认 Node/TS 或 Go？~~ **已采用 Node/TS**。  
5. 是否增加更多 HostAdapter（对象存储等）？  
6. ~~是否发布到 npm 官方源？（当前仅 GitHub Release tarball）~~ **已启用双通道**（2026-09-23，用户已注册 npm 账号）：GitHub Release tarball **+** `npm publish`（`npx picbed` / `npm i -g picbed`）。  
7. ~~Web 子命令名：`ui` 还是 `serve`？~~ **已冻结为 `ui`**（2026-09-23，用户确认）；不为 `serve` 保留别名。  
8. ~~Web 前端栈：原生 / 轻量 Vite / React？~~ **演进完毕（2026-09-27）**：模板串 SPA → `src/ui/spa/` 模块（评审 ②）→ **`renderer/` 单源 + electron-vite**（Vite HMR，不引入 React）。当前权威见 [`design/module-desktop.md`](design/module-desktop.md)；历史见 [`design/module-webui-spa-split.md`](design/module-webui-spa-split.md)。  
9. ~~拖拽后「无 root」时：强制先绑根，还是允许暂存预览（策略 B）？~~ **已冻结为策略 A：强制先绑根**（2026-09-23）；未绑根不得进入 scan/plan/sync；暂存预览不纳入本期。  
10. ~~watch 在 UI 默认模式：`preview` / `confirm-each` / `auto`？~~ **已冻结为默认 `preview`**（2026-09-23，采纳建议）；`auto` 须显式打开并仍写 RunRecord。
11. **F23 UI 壳层**：草图已锁定双栏「管理 / 设置」+ 主区「文件放置」；主题与布局细则见 [`design/wireframes/ui-shell.md`](design/wireframes/ui-shell.md)。开放：刷新后 root 自动读入策略、管理页 TOC、深色主题、侧栏图标风格（见该文件 §10）。
12. **F24 桌面壳**：Electron + Windows NSIS + 完整原生体验已冻结（2026-09-26）。开放：代码签名（SmartScreen）、macOS/Linux 产物、自动更新（electron-updater）——均不阻塞首发。

---

*功能定义看总表，域规则看 module-*，本文只负责怎么分层与为何这样分。*
