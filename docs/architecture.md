# picbed 架构设计

> **架构总纲**：分层、存储、数据模型、安全、NFR 与技术选型。功能点规格以 [`features-index.md`](features-index.md) 为唯一来源。
> 新人阅读指南：[`design-reading-guide.md`](design-reading-guide.md)。产品是本地 Electron 桌面应用：扫描 Markdown/HTML 图片引用，经 GitHub 图床上传并回写稳定链接；内嵌本地 Web 控制台。
> 当前唯一宿主为 Electron；CLI、MCP、独立 `picbed ui` 与 npm 发布面已移除（2026-11-10）。`src/ui/**` 仍作为 Electron 内嵌后端。

---

## 1. 目标与非目标

### 目标
- 从 Markdown/HTML 文档抽取图片引用（代码块防护），解析本地资产并按内容哈希去重。
- 经 GitHub Contents API 上传图片，生成 raw / jsdelivr / custom URL；支持 local host。
- 精确回写引用，可 dry-run、备份与 revert；图片字节只读。
- 本地 Web 控制台完成 scan/plan/sync/revert/config/doctor/watch；Electron 是唯一宿主。
- Token 不入库、不进日志/manifest；默认拒绝路径越界与绝对路径。

### 非目标
- 公网部署、多用户/账号体系、云端 UI；GitHub OAuth。
- 图片管理工具箱（相册、批量改图）、压缩/水印/裁剪、非图片二进制托管。
- Windows 首发之外的 macOS/Linux 安装包（链路预留）。

已实现的扩展包括多 host（GitHub/local）、watch、内嵌 Web 控制台、桌面壳与使用统计，详见 [`features-index.md`](features-index.md)。

---

## 2. 总体架构

单向依赖：**WebUI（Electron 内嵌）→ 应用编排 → 领域核心 → host / 文件系统适配器**。核心域无网络 I/O，便于单测。

**跨层单点**：越界判定、图片扩展名、摘要、token 掩码、文档类型判定只在 `src/lib/` 实现（`paths.ts` / `img.ts` / `hash.ts` / `mask.ts` / `doc.ts`），防止安全与数据规则分叉；远端 repo-dir 规则语义不同，不与本地 FS 越界合并。`watch.ts` 根外事件转绝对路径也不是越界守卫。回归由 `tests/lib-single-source.test.ts` 守护。

```text
Electron 壳
    ↓
WebUI 呈现层（本地 HTTP API、静态页、工作台、ConfirmGate；token 不进浏览器）
    ↓ 同一 DTO / JSON 信封
应用编排（collect / plan / sync / revert / doctor / config / runs）
    ↓
领域核心（扫描 / 抽取 / 解析 / 计划 / 回写 / 清单，无 I/O）
    ↓
HostAdapter（GitHub Contents / local）与 LocalStore（FS / hash / cache / backup / manifest）
```

### 2.1 存储层

| 存储 | 内容与位置 | 写者 / 约束 |
|------|------------|-------------|
| 源文档 | 用户目录内 md/html，原地回写 | 用户 / `LinkRewriter` |
| 源图片 | 相对文档目录解析 | 只读，不改图片字节 |
| 配置 | `picbed.toml` / ENV | 用户与设置流程 |
| Token | ENV、本机 `~/.picbed/credentials.json`、`gh auth token` | 用户；禁止入库 |
| Manifest / backup | `./.picbed/manifest.json`、`./.picbed/backup/` | `ManifestStore` / `LinkRewriter` |
| Cache / runs | manifest 或 `.picbed/cache.json`、`.picbed/runs/` | app 共享层；runs 建议 gitignore |
| 远端图床 | `{dir}/…` 图片 blob | `GitHubHostAdapter` |

设计要点：内容寻址以 sha256 保证幂等；manifest、日志与配置不得含 secret；backup 可由配置关闭，revert 不要求 backup 存在。

### 2.2 领域服务层

下列名称是讨论用逻辑角色，不一定是源码类名；真实代码映射见 §2.5.2。

- **DocumentScanner / RefExtractor / AssetResolver**：扫描文档、抽取带精确偏移的引用、解析并验证本地资产。
- **Deduper / PlanBuilder**：按 sha256 去重；产生 `upload | skip-cache | skip-remote | rewrite-only | blocked` 五态计划。
- **HostAdapter**：GitHub / local 适配器与 `createHostAdapter` 工厂，负责上传及 public URL。
- **LinkRewriter / ManifestStore**：按偏移原子回写、revert 与幂等映射。
- **DoctorService**（app 函数）：配置、凭据、连通与权限自检，按 host 类型分派。
- **WebUI / Desktop**：本机 HTTP 控制台、确认门、工作集、呈现壳与原生对话框；不复制业务规则。

### 2.3 应用编排

- 唯一业务编排位于 `src/app/`：collect → plan → sync（上传→回写→manifest）及 revert、doctor、config、runs。
- WebUI 只做 JSON/HTTP 协议适配与确认门；单文件失败隔离，结果可为 partial。
- dry-run 只执行到 plan，不写文档、不上传。
- `AppError` 是错误码及 HTTP 状态映射的单一来源；见 [`design/module-app.md`](design/module-app.md)。

### 2.4 源码目录与发布单元

npm 发布面已移除；`package.json` 的 files 规则仅作发布面守卫残余约束。`src/` 是唯一经 `tsc` 编译至 `dist/` 的树，Electron 从 `dist/ui/index.js` 加载 UI 服务。目录划分按发布目标而非“是否源码”：`renderer/`、`desktop/`、`scripts/`、`tests/` 也是源码，但不属于 `tsc` 输入。

| 目录 | 职责 | 构建与产物 | 目标 |
|------|------|------------|------|
| `src/` | UI 服务、app 编排、领域核心 | `tsc` → `dist/**` | 桌面包后端 |
| `renderer/` | 原生 ESM Web 前端，零构建 | 原样静态下发 | 桌面包 |
| `desktop/` | Electron main / preload | electron-vite → `out/` | 桌面包 |
| `scripts/` | 构建与巡检工具 | Node 直跑 | 仓库 / CI |
| `tests/` | vitest 用例与辅助 | vitest | 仓库 / CI |

目录边界不可随意合并：`src/ui/http/static.ts` 按包根定位 `renderer/`；Vite 的 `renderer.root` 若上提到 `src/` 会暴露 TS 源码；`renderer/` 是 Electron/Vite 的标准进程术语，改名需同步调用点与守卫且损失生态可识别性。实测把 renderer/scripts 纳入 `src/` 会引入 strict TS 错误、扩大 dist 与发布包（tarball +33%）。`tests/package-surface.test.ts` 与 `npm run validate:pack` 守护发布面。

### 2.5 当前实现地图

逻辑角色与实际源码并非同名；下列映射和目录树描述磁盘实现。

#### 2.5.1 运行时形态：Electron 唯一宿主

Electron `desktop/main.mjs` 加载 `dist/ui/index.js` 的 `createUiServer`。开发态固定监听 `4780` 供 Vite 代理 `/api`，生产态由 OS 分配端口；BrowserWindow 加载服务 URL。Web UI 同一进程承载静态下发与 `/api/*`，请求经过 guard、static、routes；`src/ui/index.ts` 是服务唯一出口。`createUiServer`（206 行）由架构守卫约束为少于 250 行。

CLI（`bin/picbed.js`、`src/cli.ts`）、MCP（`src/mcp/`）和独立 UI 启动命令已移除；`src/ui/**` 保留给 Electron 复用。

#### 2.5.2 §2.2 概念 → 代码实体

| 概念 | 代码实体 | 备注 |
|------|----------|------|
| `DocumentScanner` | `src/scan.ts` → `scanDocs()` | |
| `RefExtractor` | `src/extract.ts` → `extractRefs()` / `blankCodeRegions()` | 代码块防护 |
| `AssetResolver` | `src/resolve.ts` → `resolveAssets()` | 路径规则在 `src/lib/paths.ts` |
| `Deduper` | `src/resolve.ts` 内联 | sha256 合并，无独立类 |
| `PlanBuilder` | `src/plan.ts` → `buildPlan()` | 五态 action |
| `LinkRewriter` | `src/rewrite.ts` | 替换、原子写、revert |
| `ManifestStore` | `src/manifest.ts` | load/save/upsert/cache |
| `HostAdapter` 工厂 | `src/host/index.ts` | 实现在 `github.ts` / `local.ts` |
| `DoctorService` | `src/app/doctor.ts` → `doctorService()` | 函数，非同名类 |
| `SyncOrchestrator` | `src/app/sync.ts` → `runSync()` | 全流程 |
| `RunRecorder` | `src/app/run-store.ts` | runs 记录 |
| `ConfirmGate` | `src/ui/routes/{sync,revert}.ts` 等 | 路由确认语义 |
| WebUI / 壳层 | `renderer/index.html`、`renderer/src/features/*` | 纯前端 |
| Desktop / NativeBridge | `desktop/main.mjs`、`desktop/preload.cjs` | `picbedNative` 桥 |

`HostAdapter` 家族与 `picbedNative` 是源码中的实际名称；其余角色名用于描述职责，不应据名推断类型或文件。

#### 2.5.3 全仓目录树（目录级）

每行列出目录、其下 git 跟踪文件数与用途；深度统一至两级子目录。详细文件职责见代码与模块设计文档。

```text
picbed/
├─ .githooks/ · 3 文件 · 本地 Git hooks
├─ .github/ · 2 文件 · GitHub 配置
│  └─ workflows/ · 2 文件 · CI 与发布工作流
├─ desktop/ · 4 文件 · Electron 桌面壳
├─ docs/ · 17 文件 · 架构、功能与设计文档
│  ├─ design/ · 11 文件 · 模块与横切设计
│  └─ html/ · 3 文件 · 设计评审页
├─ openspec/ · 3 文件 · 变更规格
│  ├─ changes/ · 1 文件 · 进行中的变更
│  └─ specs/ · 1 文件 · 主规格
├─ renderer/ · 24 文件 · 原生 ESM Web 控制台
│  └─ src/ · 21 文件 · 前端模块
├─ scripts/ · 3 文件 · 构建与验证脚本
├─ src/ · 64 文件 · TypeScript 应用与领域实现
│  ├─ app/ · 13 文件 · 应用编排
│  ├─ host/ · 4 文件 · 图床适配器
│  ├─ infra/ · 1 文件 · 外部工具与凭据基础设施
│  ├─ lib/ · 6 文件 · 跨层单点逻辑
│  └─ ui/ · 30 文件 · 内嵌 Web 服务
├─ tests/ · 19 文件 · 测试与辅助
```

规模：`src/` 64 文件；`renderer/` 24 文件；`desktop/` 4 文件；`scripts/` 3 文件；`tests/` 18 个用例文件 + 1 个辅助。vitest（197 用例 / 18 个用例文件 + 1 个辅助），测试用例总数与辅助数均有守卫。`desktop/` preload 只允许一份 `.cjs`，由 `tests/desktop.test.ts` 守护。

#### 2.5.4 依赖方向与守卫

依赖只能向内：呈现层 → `app` → 领域核心 → host / infra。入口不得越过 app 直连 host 或 infra；领域不依赖 host 选择、token 来源或 HTTP。`app/*` 是唯一横向业务边界。

`tests/layering.test.ts` 强制：UI 不直连 `host/`、`infra/`、`user-token` 或 `config.ts`；app 不深连适配器且无呈现依赖；host 不反向依赖 app；`ui/server.ts` 只装配且低于 250 行；路由位于 `ui/routes/` 且各低于 250 行。`tests/lib-single-source.test.ts` 守护跨层单点，`tests/package-surface.test.ts` 与 `npm run validate:pack` 守护发布面。

---

## 3. 领域模型

```text
DocFile ──contains──► ImageRef ──resolves──► Asset ──uploads──► RemoteImage
                         │                     │                     │
                         │                     └── sha256 去重        └── publicUrl
                         └── start/end 精确替换锚点
ManifestEntry: (doc, raw, localPath, sha256, publicUrl, updatedAt)
SyncPlanItem:  action + asset? + remote? + reason? + code? + ref?
SyncResult:    ok, uploaded, rewrittenDocs[], summary, items[], warnings[], errors[], partial, errorCode?, runId
```

不变量：一次 run 内相同 sha256 至多一次远端写入；回写只改 URL 子串；配置、清单与日志无 token 明文。

---

## 4. 图床通道（PicX / GitHub）

PicX 同源模型为 GitHub 仓库文件托管与 URL 风格约定；支持 GitHub 与 local host。

| 概念 | picbed 配置 | 说明 |
|------|-------------|------|
| Token | `PICBED_GITHUB_TOKEN` / `GITHUB_TOKEN` / 本机凭据 / `gh auth token` | PAT 或 GitHub CLI；Contents RW |
| 仓库 | `github.owner/repo/branch/dir` | 图床仓库 |
| CDN | `url.style` | `raw` / `jsdelivr` / `custom` |

上传路径为 `{dir}/{yyyy}/{mm}/{sha12}-{safeName}`；URL 可为 `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`、`https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}` 或用户模板。上传串行，无重试/退避；403/429 映射 `E_REMOTE`，单文件建议不超过 50 MB。

---

## 5. 命令与 Agent 契约（已移除）

退出码语义由 `src/app/errors.ts` 承载并映射到 HTTP；Web API 信封见 [`design/cross-cutting.md`](design/cross-cutting.md)，功能 AC 见 [`features-index.md`](features-index.md)。

---

## 6. 安全与隐私

- Token 仅需目标图床仓库 Contents 读写权限；日志与错误禁止回显 secret，配置展示必须掩码。
- 拒绝路径穿越、默认拒绝绝对路径与 `file://`；源图片只读。
- `.picbed/backup`、manifest 与 `.picbed/runs` 建议 gitignore。
- Web 默认只监听 `127.0.0.1`；token 不进入 HTTP、页面或 SSE；写操作需页面确认及服务端 `confirm`；非回环绑定须显式并告警。
- Electron 继承 Web 安全模型：`contextIsolation: true`、`nodeIntegration: false`；preload 只暴露对话框/窗口状态，不暴露 token 或任意 FS 写入。

---

## 7. 技术选型

| 项 | 选型 | 约束 |
|----|------|------|
| 语言 | TypeScript + Node ≥20（备选 Go） | 与 PicX 生态同源；MD/HTML 库成熟；栈无关设计优先 |
| 校验 | zod | 配置与 JSON schema |
| HTTP | Node `http` / 轻量路由（备选 fastify）；undici | 本机单用户不需重框架；网络调用需可控超时/重试 |
| 测试 | vitest + fixture（备选 go test） | 黄金文件友好 |
| 前端 | `renderer/` 原生 HTML/CSS/ESM + electron-vite | 不引入 React/组件框架；Vite 做开发构建 |
| 实时进度 | SSE（备选轮询） | sync/watch 推送简单 |
| 拖拽路径 | 先绑 root，再将相对线索解析为真实路径（策略 A） | 浏览器不给绝对路径；原地回写必须服务端解析真实路径；暂存预览不纳入 |
| 桌面 | Electron + electron-builder（备选 Tauri + Node sidecar） | 复用 Node 核心与 WebUI，改动最小；Tauri 需 sidecar 重打包 |
| 首发 | Windows NSIS `.exe` | 用户优先 Windows；同一 builder 可后扩 macOS/Linux |
| 壳能力 | 完整控制台、原生目录对话框、窗口状态记忆 | 不只是包一层窗口 |
| 桌面依赖 | Electron、electron-builder、electron-vite、Vite 为 devDependencies | 桌面包由构建链打包 |
| 运行 | 内嵌 `createUiServer` → `127.0.0.1` → BrowserWindow | dev 用 Vite HMR；prod 同源静态 UI；复用 HTTP API |
| 开发工具链 | electron-vite | 渲染 HMR 与 main/preload 重启 |

---

## 8. NFR

- 正确性优先：精确偏移替换与黄金测试防止误改文档。
- 可脚本化：无 TTY 不阻塞；重复执行结果可预测，dry-run 无副作用。
- 可观测：verbose 提供逐步日志；JSON/API 提供 counts、逐项结果与错误；运行记录支持审计。
- 可移植：Resolver 统一 Windows/POSIX 路径分隔与大小写差异。

---

## 9. 分支模型（Git Flow + 文档分支）

| 分支 | 职责 |
|------|------|
| `main` | 发布与稳定 |
| `develop` | 功能集成 |
| `feature/*` | 功能实现 |
| `docs/design` | 设计文档、HTML 呈现与标识体系；修改后合入 `develop` |
| `release/*` / `hotfix/*` | 按需用于发布与修复 |

文档修订走 `docs/design`，实现走 `feature/*`；里程碑设计快照进入 `develop` / `main`。

---

## 10. 分期（与 F/P 对齐）

| 阶段 | 内容 | 优先级 | 状态 |
|------|------|--------|------|
| M0 设计冻结 | 本文档、features-index 与 modules | — | 完成 |
| M1 骨架 | init / doctor / config | P0 子集 | 完成 |
| M2 抽取 | scan / plan | P0 | 完成 |
| M3 上传 | upload / 幂等 sync | P0 | 完成 |
| M4 回写 | rewrite / revert | P0 | 完成 |
| M5 打磨 | Agent schema / 发布 | P1 | 完成；现宿主已移除 |
| M6 扩展 | watch、多 host、MCP、token auth | P0/P3 | 完成；CLI/MCP 宿主已移除 |
| M7 Web 控制台 | F16–F18 服务、拖拽工作台、sync 闭环 | P0 | 完成 |
| M8 Web 完备 | F19–F22 revert/config/doctor/审计/watch | P1–P2 | 完成 |
| M9 UI 壳层 | F23 多视图、图库与主题 | P0 | 完成 |
| M10 桌面壳 | F24 Electron、Windows 安装包、原生对话框 | P0 | 完成 |
| M11 渲染层 | renderer 单源、Vite HMR、照片墙等 UI 迭代 | P0 | 完成 |

功能点、验收标准与模块归属见 [`features-index.md`](features-index.md)。

---

## 11. 状态与开放问题

- 是否增加更多 HostAdapter（如对象存储）。
- F23：刷新后 root 自动读入策略、深色主题与侧栏图标风格。
- F24：代码签名（SmartScreen）、macOS/Linux 产物与自动更新；均不阻塞首发。

---

*功能定义见总表，域规则见 module-*；本文负责说明分层与架构决策。*
