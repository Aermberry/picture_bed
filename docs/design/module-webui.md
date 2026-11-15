# webui 模块详细设计

> 归属功能点：F16 本地 Web 控制台服务、F17 目录/拖拽与计划工作台、F18 一键同步、F19 回滚面板、F20 配置与自检面板、F21 审计与报告、F22 监听控制台、F23 控制台壳层与视觉重设计、F25 使用统计视图。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；全局契约见 [`cross-cutting.md`](cross-cutting.md)。
> 壳层布局与主题令牌见 [`wireframes/ui-shell.md`](wireframes/ui-shell.md)（F23 视格权威）。
> **UI 渲染层单源 `renderer/`（electron-vite）**：目录与热更新见 [`module-desktop.md`](module-desktop.md#渲染层electron-vite当前权威)。历史「SPA 出模板串」见 [`module-webui-spa-split.md`](archive/module-webui-spa-split.md)（已被 `renderer/` 取代）。
> 栈无关；接口为意图伪码。

## 目的与边界

webui 是本地控制台呈现层：在 Electron 生命周期内提供 scan/plan/sync/revert/config/doctor/watch 能力，不复制 ingest/transfer/rewrite 业务规则；通过 `src/app/` 共享服务复用应用逻辑与 `AppError`（CLI 宿主已移除，Web/桌面是唯一消费面）。默认仅绑定 `127.0.0.1`，不提供多用户、公网部署或反向代理鉴权；token 不进入 HTTP 响应、页面、run 记录或日志，写操作必须经过显式确认。

实现落点：`src/ui/{server,context,root,watch,gh-login,inline-cache}.ts`、`src/ui/http/{body,errors,envelope,guard,static}.ts`、`src/ui/routes/{auth,branches,config,gallery,health,plan,preview,revert,runs,session,stats,sync,system,watch}.ts`、`renderer/{index.html,styles.css,main.js,src/**}`。

## 数据契约

```text
UiSession { rootDir, startedAt, watchActive }
RunRecord { id, command, startedAt, finishedAt, ok, counts, items?[], errors?[], warnings?[], errorCode? }
PlanView { rootDir, generatedAt, groups: { upload[], skip-cache[], skip-remote[], blocked[] } }
DoctorView { ok, checks[], failures[] }
ManifestView { version, entries[] }   # 不含 token
JsonEnvelope<T> { schemaVersion, ok, command: "api.*", data?, error?: { code, message, path?, hint? }, warnings?[] }
```

HTTP 路由（请求写体均为 JSON；写操作按路由要求 `confirm: true`，dry-run 除外）：

```text
GET  /api/health, /api/config, /api/config/export, /api/manifest, /api/runs, /api/runs/:id
GET  /api/session, /api/session/images, /api/watch, /api/gallery?path=, /api/stats, /api/branches
POST /api/session/drop {name,relativePath,type,absPath?}; /api/session/bind-root {root}
POST /api/session/reset; /api/session/remove {keys[]}
POST /api/scan {root}; /api/plan {root}; /api/sync {root,confirm:true,dryRun?}
POST /api/revert {root,confirm:true,dryRun?}; /api/doctor
POST /api/config {key,value,confirm:true|dryRun:true}; /api/config/import {toml,confirm:true|dryRun:true}
POST /api/watch/start {mode?,debounceMs?,confirm?}; /api/watch/stop
POST /api/gallery/delete {items:[{path,sha,name?}]}; /api/repo/mkdir {path,confirm:true}
POST /api/auth/token {token?,clear?,confirm:true}; /api/auth/gh-login/start; /api/auth/gh-login/cancel
GET  /api/auth/gh-login/status; /api/preview?path=
```

- 所有响应使用统一信封；写操作缺 `confirm` 返回 `E_CONFIRM`，除显式 `dryRun`；`watch` 的 `auto` 模式也必须确认。token 仅由本地凭据层读取，配置读取、导入导出和错误信息都不得回显。
- 静态 UI 仅从 `renderer/` 提供，`server.ts` 负责装配 HTTP 安检、静态资源和路由；不在服务端拼装第二份页面或暴露其他源码路径。dev 标记只控制本地「规范」入口可见性，不改变 API 契约。

## F16 本地 Web 控制台服务

- UI server 随 Electron 生命周期启动/关闭；默认 loopback 绑定，health 为 `GET /api/health` → `api.health` 信封。端口占用、绑定或静态资源缺失须显式失败，不得静默空页。
- 服务退出时关闭 HTTP 并停止 watch；静态页面、GET 及 POST API 均遵循统一 JSON 信封和 HTTP 加固契约（见 [`module-webui-http-hardening.md`](module-webui-http-hardening.md)）。

## F17 目录/拖拽与计划工作台

- 上传页仅接受图片或扫描扩展名文档，不接受文件夹；桌面绝对路径可自动绑定/重绑 root，浏览器相对路径只能在已绑定 root 内解析，越界或无法解析须显示 blocked 原因。
- 工作集仅包含本次拖入项：图片直接预览/上传，文档经 plan 解析本地引用；不枚举根目录里的其它图片。连续拖入累加去重，重绑根时清空旧工作集；选择删除只移除墙面与会话工作集。
- 预览经 `/api/preview` 且仅限根内图片；内嵌 `data:image/*` 从内存缓存读取。SVG 字节不改写，预览响应使用 CSP sandbox 与 `nosniff`。
- 上传后照片墙展示本次图片；重置清空会话，不写文档、不上传。扫描/计划只读，blocked 项必须说明原因。

## F18 一键同步

- 照片墙「上传」调用 `POST /api/sync`，显式确认后仅处理当前会话工作集；仅投放图片时不改写无关文档。dry-run 不上传、不改文档。
- 复用 app 层 `runSync`；结果保留 uploaded/rewritten/skipped/blocked/failed 计数，单项失败隔离并显式呈现 partial。

## F19 回滚面板

> 已移除（2026-09-30，commit `2aa016f` 删除 UI 面板）；API 存活：`POST /api/revert`（`src/ui/routes/revert.ts`）；设计细节见 [features-index 墓碑](../features-index.md#f19-回滚面板)。

## F20 配置与自检面板

- 设置读取 `ResolvedConfig`；token 只显示掩码/配置状态，不提供明文显示。可写配置键为 `github.owner`、`github.repo`、`github.branch`、`github.dir`、`url.style`；保存须确认，`url.style` 限 `raw|jsdelivr|custom`。目录/分支从远端选择；目录新建以 `.gitkeep` 占位。
- 配置 schema 默认值：`host.type=github`；`github.owner/repo=""`、`branch=main`、`dir=img`；`local.root=.picbed/host-root`、`public_base=https://cdn.example.com`、`dir=img`；`url.style=jsdelivr`、`url.custom_template` 可选；`scan.extensions=md,html,htm`、`ignore=**/node_modules/**,**/.git/**,**/.picbed/**`、`inline_images=true`；`upload.concurrency=3`、`commit_message=chore(picbed): upload images`；`rewrite.backup=true`。凭据保存在本机凭据文件，不写入 `picbed.toml`。
- 非法/缺省 `host.type` 降级为 `github`，非法 `url.style` 降级为 `jsdelivr`；缺 token 时 doctor 给出 PAT / `gh auth` 指引，不回显凭据。导入校验 host/style/concurrency，失败显式返回错误；远端目录不存在时定位最近存在的祖先并预填待建目录，分支/目录读取失败在选择器内提示。
- Doctor 展示 checks/failures；错误保持配置/鉴权语义。设置支持导入导出，导出文本不含 token。

## F21 审计与报告

> 已移除（2026-09-30，commit `2aa016f` 删除 UI 面板）；API 存活：`GET /api/runs`、`GET /api/runs/:id`（`src/ui/routes/runs.ts`；`tests/ui-panels.test.ts:130` 守卫）；设计细节见 [features-index 墓碑](../features-index.md#f21-审计与报告)。

## F22 监听控制台

> 已移除（2026-09-30，commit `2aa016f` 删除 UI 面板）；API 存活：`GET /api/watch`、`POST /api/watch/start`、`POST /api/watch/stop`（`src/ui/routes/watch.ts`；`tests/ui-panels.test.ts:155` 守卫）；设计细节见 [features-index 墓碑](../features-index.md#f22-监听控制台)。

## F25 使用统计视图

- `GET /api/stats` → `api.stats` 信封；外层 `schemaVersion=1`，`data.contractVersion=2`。数据包含 `generatedAt`、`period`、`measurement`、`totals`、`today`、`last7`、`streak`、`busiestDay`、`days`、`hours`、`sources`、`warnings`；无 token。契约不匹配必须显式显示错误态，不得静默填 0。
- `period` 固定 `rolling-days` / 365 日、本地日历窗口，含 `startDate`、`endDate`、`timeZone`（无有效 IANA 时为 `unknown`）及 `scope=local-run-store`。本地时区是用户感知日期/小时桶的决策；`days` 恒 365 条、`hours` 恒 24 条，`totals.count` 为窗口内两者总和。
- `measurement`：`unit=successful-image-upload`、`source=runs`、`coverage=retained-local-runs`，含 `state=available|partial|unavailable`、`countAccuracy`、`timeAccuracy=run-start-estimate|unknown`。`scanAllRuns` 全量读取 `.picbed/runs/*.json`，以合法 `counts.uploaded` 按 `startedAt` 本地日期/小时归桶；partial run 已成功上传量照计，窗口外记录不计数。runs 目录不存在/为空或读取失败为 `unavailable`（不是零次上传），坏记录部分可读为 `partial`；可读且值全零才是 `available` 真零。
- `last7` 含本周 `count`、前 7 日 `prev`、`delta`、`deltaPct`；无基线或记录不完整时百分比为 `null`。`streak` 含 current/longest，`busiestDay` 并列取最早日期。
- `sources.manifest={use:not-counted,reason:mapping-snapshot}`、`sources.remoteCommits={use:not-counted,reason:not-upload-events}`；二者不参与计数。`sources.remoteInventory={count,state}` 仅为仓库当前库存上下文，Trees 截断为 `partial`，失败/未配置为 `unavailable` 且 `count=null`，不得影响本地统计。库存失败降级为 warning。
- 聚合异常仍返回完整形状的 200 空视图和 warning；`partial` 显示记录不完整，`unavailable` 显示「暂无可用上传记录」，远端库存不可用单独显示「未连接远端」。界面包含总计、今天、近 7 日、连续天数、最忙日、365 日热力图、24 小时时段图和独立远端库存卡。

## F23 Web 控制台壳层与视觉重设计

- 仅调整布局、导航、主题与文案层级，不改变 API、信封、confirm 门、token 纪律或 F17 拖拽策略。
- 导航为五视图：上传、统计、图库、设置、规范（仅本地调试可见）。72px 侧栏、56px 顶栏和可滚动内容区，窄屏按 [`wireframes/ui-shell.md`](wireframes/ui-shell.md) 降级。
- 主题令牌、Logo 动效、组件细节以 [`wireframes/ui-shell.md`](wireframes/ui-shell.md) 为准；API 失败须在主区可见，不白屏。

## F26 图库视图

图库视图是 F19–F22 面板于 2026-09-30 删除后 `manage` 视图的演进结果：历史 manage 以 manifest / `GET /api/runs` 为数据源；当前 `renderer/index.html` 存在 `gallery` 视图，由 `src/ui/routes/gallery.ts` 的 `GET /api/gallery?path=` 驱动，页面复用 `.file-grid` 样式。图像判定复用 `isImageName()`，图库删除只影响仓库当前文件，不回写 manifest 或 F25 历史统计。

## 失败语义

| 情况 | 行为 |
|---|---|
| 缺少确认 | 拒绝写操作，`E_CONFIRM` |
| 缺 token / root 越界 | 显式鉴权 / 路径错误，不静默降级 |
| 远端或单文件失败 | 返回错误或可见 partial，保留失败项 |
| manifest 损坏 | 显式错误，不自动重建 |
| 静态资源缺失 / 端口占用 | 服务启动失败，不返回空白成功态 |

## 功能点映射

| F | 本模块章节 |
|---|------------|
| [F16](../features-index.md#f16-本地-web-控制台服务) | §F16 |
| [F17](../features-index.md#f17-目录拖拽与计划工作台) | §F17 |
| [F18](../features-index.md#f18-一键同步) | §F18 |
| [F19](../features-index.md#f19-回滚面板) | §F19 |
| [F20](../features-index.md#f20-配置与自检面板) | §F20 |
| [F21](../features-index.md#f21-审计与报告) | §F21 |
| [F22](../features-index.md#f22-监听控制台) | §F22 |
| [F23](../features-index.md#f23-web-控制台壳层与视觉重设计) | §F23 · [`wireframes/ui-shell.md`](wireframes/ui-shell.md) |
| [F25](../features-index.md#f25-使用统计视图) | §F25 |
| [F26](../features-index.md#f26-图库视图) | §F26 |

*规则与数据以本模块为准；验收契约以 features-index AC 为准；视觉与布局以 wireframes/ui-shell.md 为准；业务不变量以 ingest/transfer/rewrite/cliops 为准。*
