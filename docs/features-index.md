# 功能点规格总表（索引 + 双向链接）

> **新人阅读入口**：先读 [`design-reading-guide.md`](design-reading-guide.md)——文中 **F/P/模块/AC** 等标识的含义与用途，再回本表查具体功能点。
>
> 本文件为功能点**索引与归属枢纽**：每节给出优先级、**所属模块**、实现归属（域/CLI）、AC 摘要。
> **产品定位**：**picbed** 桌面应用——扫描文档内嵌图片 → GitHub 图床上传 → 链接回写。（2026-11-10：CLI / MCP / npm 发布移除，Electron 桌面为唯一宿主；F10/F14 随之移除，历史 AC 保留标注。）
> 详细实现设计按 DDD 模块拆分：
> - **ingest** 模块（F3/F4 扫描抽取、F5 解析去重）→ [`design/module-ingest.md`](design/module-ingest.md)
> - **transfer** 模块（F6/F7 上传与 URL）→ [`design/module-transfer.md`](design/module-transfer.md)
> - **rewrite** 模块（F8/F9 回写与 revert）→ [`design/module-rewrite.md`](design/module-rewrite.md)
> - **cliops** 模块（F1/F2/F10/F11 配置、doctor、Agent 契约）→ [`design/module-cliops.md`](design/module-cliops.md)
> - **webui** 模块（F16–F23 本地 Web 控制台，含拖拽工作台与壳层视觉）→ [`design/module-webui.md`](design/module-webui.md)
> - **desktop** 模块（F24 桌面应用壳与安装包）→ [`design/module-desktop.md`](design/module-desktop.md)
> - **app** 共享应用编排层（collect/plan/sync/revert/doctor/config/runs，非限界上下文）→ [`design/module-app.md`](design/module-app.md)
> - 横切约定 / 退出码 / JSON → [`design/cross-cutting.md`](design/cross-cutting.md)
>
> 模块文档内有「功能点映射」节链回本文件，形成相向链接。
> 优先级：P0=MVP 最小闭环，P1=第二批，P2=后续增强，P3=backlog。架构分层见 [`architecture.md`](architecture.md)。

## 总览

| ID | 名称 | 优先级 | 模块 | AC 摘要 |
|----|------|--------|------|---------|
| F1 | 项目初始化与配置 | P0 | cliops | init 生成合法模板；config get/set/list 正确；token 掩码 |
| F2 | 环境与鉴权自检 | P0 | cliops | doctor 报告缺项/坏 token/无权限；失败退出码 3 |
| F3 | 目录扫描与文档发现 | P0 | ingest | 按扩展名/忽略规则列出文档；不误入 node_modules |
| F4 | 图片引用抽取 | P0 | ingest | MD/HTML 语法覆盖；代码块内不误伤；偏移可替换 |
| F5 | 本地资产解析与去重 | P0 | ingest | 相对路径正确；缺失/越界可诊断；sha256 合并多引用 |
| F6 | 上传计划 plan | P0 | transfer | upload/skip-cache/skip-remote/blocked 分类正确；可 dry-run |
| F7 | GitHub 图床上传 | P0 | transfer | Contents API 写入成功；URL 风格正确；同 sha 幂等 |
| F8 | 文档链接回写 | P0 | rewrite | 仅替换 URL 子串；原子写；默认 backup |
| F9 | Manifest 与 revert | P1 | rewrite | 映射可审计；revert 还原本地路径；无 token |
| F10 | Agent 机器接口 | ~~P0~~ **removed 2026-11-10** | cliops | ~~`--json` schema 稳定；退出码契约；无 TTY 不阻塞~~（随 CLI 宿主移除） |
| F11 | 单文件上传 | P1 | transfer | upload 子命令输出 URL；与 sync 共用适配器 |
| F15 | GitHub Token 鉴权 | P0→**done** | cliops | PAT/GITHUB_TOKEN/gh auth；无 OAuth App |
| F12 | watch 监听 | P3→**done** | cliops | 目录变更触发增量 plan/sync；可退出；不引入常驻特权 |
| F13 | 多图床适配器 | P3→**done** | transfer | HostAdapter 可替换为非 GitHub 后端且 AC7 语义保持 |
| F14 | VS Code / MCP 包装 | ~~P3→done~~ **removed 2026-11-10** | cliops | ~~包装层不复制业务规则，只调用 CLI 契约~~（随 CLI/MCP 宿主移除） |
| F16 | 本地 Web 控制台服务 | P0→**done** | webui | 本机 HTTP 起停、健康检查、token 不出响应 |
| F17 | 目录/拖拽与计划工作台 | P0→**done** | webui | 路径或拖拽导入；scan/plan；dry-run 无副作用 |
| F18 | 一键同步 | P0→**done** | webui | 确认后 sync；进度与结果可观察 |
| F19 | 回滚面板 | ~~P1→**done**~~ **removed 2026-09-30** | webui | ~~manifest 可视；revert 可 dry-run~~（UI 面板已移除；API 仍在） |
| F20 | 配置与自检面板 | P1→**done** | webui | config 掩码编辑；doctor 报告可见 |
| F21 | 审计与报告 | ~~P2→**done**~~ **removed 2026-09-30** | webui | ~~run 记录/失败明细；JSON 与契约对齐~~（UI 面板已移除；API 仍在） |
| F22 | 监听控制台 | ~~P2→**done**~~ **removed 2026-09-30** | webui | ~~watch 启停与事件日志；无常驻特权~~（UI 面板已移除；API 仍在） |
| F23 | 控制台壳层与视觉重设计 | P0→**done** | webui | 72px 侧栏多视图（F25 起第二视图为「统计」；图库视图 2026-09-30 加入；「规范」仅调试可见）；晨雾蓝×落日暖令牌；F17–F22 可达且契约不变 |
| F24 | 桌面应用壳与安装包 | P0→**done** | desktop | Electron 壳加载完整控制台；原生目录对话框；Windows NSIS 安装包（2026-11-10 起 npm 形态移除，安装包为唯一形态） |
| F25 | 使用统计视图 | P1 | webui | GET /api/stats 聚合（v2 口径：runs 唯一计数源、成功上传动作计数、365 日统一窗口、状态三态测量；manifest/远端提交 not-counted、远端库存仅上下文）；hero 卡 + 今天/近7天环比/连续天数/最忙一天 KPI；年历热力图；时段分布；只统计图像 |
| F26 | 图库视图 | P1 | webui | 仓库文件夹树 + 图片墙（GET /api/gallery）；图片批量删除；仅浏览不改统计口径 |

---

## F1 项目初始化与配置

- 优先级：P0 · 模块：**cliops**
- 实现（域）：[module-cliops · F1](design/module-cliops.md#f1-项目初始化与配置)
- AC：`init` 在空目录生成 `picbed.toml` 合法模板（无 secret）；`--force` 可覆盖；`config list` 对 token 掩码；`config set` 校验键名与枚举（如 `url.style`）；优先级 ENV>项目文件生效（无用户级配置，CLI 只决定配置文件位置）。

## F2 环境与鉴权自检

- 优先级：P0 · 模块：**cliops**
- 实现（域）：[module-cliops · F2](design/module-cliops.md#f2-环境与鉴权自检)
- AC：`doctor` 检查配置完整、token 存在、API 可达、目标仓库 Contents 权限；问题项可定位（缺键名/HTTP 状态）；失败退出码 3；成功含 `ok:true` 摘要。

## F3 目录扫描与文档发现

- 优先级：P0 · 模块：**ingest**
- 实现（域）：[module-ingest · F3](design/module-ingest.md#f3-目录扫描与文档发现)
- AC：默认扩展名 `md,html,htm` 可配置；遵循 ignore glob；不进入 `node_modules`/`.git`；结果路径稳定排序，便于 diff。

## F4 图片引用抽取

- 优先级：P0 · 模块：**ingest**
- 实现（域）：[module-ingest · F4](design/module-ingest.md#f4-图片引用抽取)
- AC：覆盖 `![]()`、图片扩展名链接、`<img src|srcset>`、`<source>`、SVG `<image href>`；**代码块/行内代码中的伪引用不抽取**；每条引用含精确 `start/end`；多语法混排不漏不重。

## F5 本地资产解析与去重

- 优先级：P0 · 模块：**ingest**
- 实现（域）：[module-ingest · F5](design/module-ingest.md#f5-本地资产解析与去重)
- AC：相对路径相对**文档目录**解析；文件缺失/非图片扩展名报 blocked 且含 path；默认拒绝绝对路径与 `file://`；`sha256` 相同的多引用合并为单 Asset。

## F6 上传计划 plan

- 优先级：P0 · 模块：**transfer**
- 实现（域）：[module-transfer · F6](design/module-transfer.md#f6-上传计划-plan)
- AC：缓存命中 → `skip-cache`；已是 http(s) → `skip-remote`；合法本地文件 → `upload`；解析失败 → `blocked`；`plan`/`sync --dry-run` 不上传不改文档；计划 JSON 含 action 与 reason。

## F7 GitHub 图床上传

- 优先级：P0 · 模块：**transfer**
- 实现（域）：[module-transfer · F7](design/module-transfer.md#f7-github-图床上传)
- AC：`PUT contents` 成功并返回可解析路径；`raw`/`jsdelivr`/`custom` URL 生成正确；同一 `sha256` 重复 sync 不二次上传；429/403 退避后可重试或明确失败（退出码 5）；commit message 可配置。

## F8 文档链接回写

- 优先级：P0 · 模块：**rewrite**
- 实现（域）：[module-rewrite · F8](design/module-rewrite.md#f8-文档链接回写)
- AC：仅替换引用 URL 子串，alt/title/周边文本不变；代码块内不改写；原子写无半截文件；默认生成 backup（可由 `picbed.toml [rewrite] backup = false` 关闭）。

## F9 Manifest 与 revert

- 优先级：P1 · 模块：**rewrite**
- 实现（域）：[module-rewrite · F9](design/module-rewrite.md#f9-manifest-与-revert)
- AC：manifest 记录 doc/raw/localPath/sha256/publicUrl；**无 token**；`revert` 将 URL 还原为原文档中的 raw 路径；`revert --dry-run` 不写盘；损坏 manifest 报错不静默丢映射。

## F10 Agent 机器接口（removed 2026-11-10）

- ~~优先级：P0 · 模块：**cliops**~~
- 实现（域）：[module-cliops · F10](design/module-cliops.md#f10-agent-机器接口)（历史设计）
- **已随 CLI 宿主移除**（2026-11-10 用户确认 Electron 单形态）：`src/cli.ts` 与 `bin/picbed.js` 删除；`--json` 信封语义由 Web API 承载，退出码映射仍活在 `src/app/errors.ts`。以下为历史 AC：支持命令均有 `--json`；stdout 单一 JSON（诊断走 stderr）；含 `schemaVersion`；非 TTY 写文件需 `--yes` 否则退出码 7；退出码与文档表一致；重复 run 幂等可预期。

## F11 单文件上传

- 优先级：P1 · 模块：**transfer**
- 实现（域）：[module-transfer · F11](design/module-transfer.md#f11-单文件上传)
- AC：`upload <file>` 成功输出 publicUrl（人类/JSON）；与 `sync` 共用 HostAdapter 与 URL 策略；失败映射到既有退出码。

## F15 GitHub Token 鉴权

- 优先级：P0（已实现）· 模块：**cliops**
- 实现（域）：[module-cliops · F15](design/module-cliops.md#f15-github-token-鉴权)
- AC：**无 OAuth App / 无 login 命令**。token 解析顺序：`PICBED_GITHUB_TOKEN` → `GITHUB_TOKEN` → 本机凭据 `~/.picbed/credentials.json` → `gh auth token`；缺失时 `doctor`/`sync` 退出码 3；输出一律掩码。原 OAuth 点击登录已移除（分发成本过高）。

## F12 watch 监听

- 优先级：P3（已实现）· 模块：**cliops**
- 实现（域）：[module-cliops · F12](design/module-cliops.md#f12-watch-监听)
- AC：目录变更触发增量 plan/sync；可退出；不引入常驻特权。实现：`watch <path> --debounce <ms>`；`fs.watch` 递归监听 + 防抖批处理；变更时 spawn 既有 `sync`（只调 CLI 契约）；SIGINT/SIGTERM 可退出；忽略 `node_modules`/`.git`/`.picbed`。

## F13 多图床适配器

- 优先级：P3（已实现）· 模块：**transfer**
- 实现（域）：[module-transfer · F13](design/module-transfer.md#f13-多图床适配器)
- AC：`HostAdapter` 可替换为非 GitHub 后端且 AC7 语义保持。实现：`host.type = github | local`；`local` 为文件系统图床（无需 token）；工厂 `createHostAdapter` 注入 sync/upload；URL/远端路径由适配器 `composeUrls`/`remotePath` 提供。

## F14 VS Code / MCP 包装（removed 2026-11-10）

- ~~优先级：P3（已实现）· 模块：**cliops**~~
- 实现（域）：[module-cliops · F14](design/module-cliops.md#f14-vs-code--mcp-包装)（历史设计）
- **已随 CLI/MCP 宿主移除**（2026-11-10 用户确认 Electron 单形态）：`src/mcp/` 与 `bin/picbed-mcp.js` 删除。历史 AC：包装层不复制业务规则，只调用 CLI 契约。实现：`picbed-mcp` stdio JSON-RPC 服务；tools = doctor/scan/plan/sync/upload/revert；全部 `spawn` 既有 CLI + `--json`。

## F16 本地 Web 控制台服务

- 优先级：P0 · 模块：**webui**
- 实现（域）：[module-webui · F16](design/module-webui.md#f16-本地-web-控制台服务)
- AC：`ui` 子命令在本机拉起 HTTP 控制台并打印可访问 URL；默认**仅**监听 `127.0.0.1`；`--port` 可指定端口，占用时失败退出码 2 并提示；SIGINT/SIGTERM 干净退出且不残留监听；`GET /api/health` 返回 `ok:true` 与 `schemaVersion`；**任意** HTTP 响应不得出现 token 明文或可还原 secret。

## F17 目录/拖拽与计划工作台

- 优先级：P0 · 模块：**webui**
- 实现（域）：[module-webui · F17](design/module-webui.md#f17-目录拖拽与计划工作台)
- AC：上传页**仅有拖放区**。拖放区**仅接受图片文件或文档文件**（md/html 等扫描扩展名）；**文件夹拖入拒绝**并提示。拖入后自动扫描；**扫描成功**时以**照片墙**展示已解析图片（最短列瀑布流 · 自然宽高比 · 文件名悬停浮层 · 无放大让位）；照片墙附 **「上传」「重置」**按钮。**点选图块可多选**，选中项高亮；出现 **「删除 N」**，确认后从预览墙与会话工作集中移除（不上传、不改文档）。预览来源 = **本次拖入的图片** + **本次拖入文档内引用的本地图片**；**不得**罗列扫描根下未拖入的其它图片。**连续拖入累加进同一照片墙**（按路径/内容去重，不清空先前结果）；**重置**或**上传成功**后清空整墙并回空拖放区。上传 = 确认后 `sync`（作用于会话工作集内文档及其图片；仅拖入图片时上传这些图片、不改写文档）；重置 = 清除扫描结果（不上传、不改文档）。未解析/失败仍提示原因。不提供「选择文件」「粘贴剪贴板」。CLI 的 plan/dry-run 语义不变。

## F18 一键同步

- 优先级：P0 · 模块：**webui**
- 实现（域）：[module-webui · F18](design/module-webui.md#f18-一键同步)
- AC：**拖放完成即触发 sync**（无独立「计划/同步」面板）；写盘/上传前仍**显式确认**（服务端需 `confirm`）；完成后 toast/简要反馈 uploaded 等计数；部分失败可见；幂等可预期。原 scan/plan/sync 按钮与计划表**移除**（`/api/plan`、`/api/sync` 仍由照片墙上传流程调用；`/api/manifest`、`/api/runs` 保留作审计/回滚数据源）。

## F19 回滚面板（removed 2026-09-30）

- ~~优先级：P1 · 模块：**webui**~~
- 实现（域）：[module-webui · F19](design/module-webui.md#f19-回滚面板)（历史设计）
- **UI 面板已于 2026-09-30 删除**（commit `2aa016f`，标题 `feat(ui): manage view = uploaded gallery; drop revert/audit/watch panels`，删除 `renderer/index.html` 31 行；当前 `renderer/index.html` 只有五个视图：`upload` / `stats` / `gallery` / `settings` / `doc`；全仓 `grep -rn 'id="revert\|id="runs\|id="watch' renderer/` → 零命中）。**API 仍在**：`src/ui/routes/revert.ts:7` `POST /api/revert`；且有测试守着：`tests/ui-panels.test.ts:141`（`/api/revert`）。以下为历史 AC：可浏览 manifest（doc / raw / publicUrl / sha256）；支持 `revert --dry-run` 等价预览（不写盘）；确认后将 URL 还原为原文档 raw 路径；manifest 损坏时界面可见错误且不静默清空。

## F20 配置与自检面板

- 优先级：P1 · 模块：**webui**
- 实现（域）：[module-webui · F20](design/module-webui.md#f20-配置与自检面板)
- AC：可查看当前配置且 **token 一律掩码**；可编辑非 secret 配置键并校验枚举（如 `url.style`）；可触发 doctor 并展示 checks / failures（含缺键名、HTTP 状态）；缺 token 时给出 PAT 与 `gh auth` 获取指引（hint），不回显 secret。
- AC（目录选择，2026-10-01）：`github.dir` 行可**浏览并点选仓库远程目录**——聚焦输入框或点「选择目录」弹出可停留浮层（当前路径 + 文件夹列表 + 上级/刷新 + 新建 + 关闭，**不自动消失**，点外部/Esc/关闭收起）；目录来源于仓库远端（复用 `GET /api/gallery?path=` 的 `type==='dir'`），owner/repo/token 不齐时给引导而非报错。可**新建文件夹**（GitHub 无空目录 API，以空内容 `.gitkeep` 占位提交）；**选中或新建成功即写入并保存 `github.dir`**，无需再点「保存设置」；该输入框为**只读展示态**——不接受手工键入，只显示当前选中的目录，值唯一来源是浮层点选或新建回填（2026-10-01 补）。
- AC（分支下拉，2026-10-03）：`github.branch` 行可**点选仓库远端分支**——点击/聚焦 Branch 输入框即在输入框下方展开分支下拉（`GET /api/branches` 列分支，当前分支高亮），点选某分支**立即写入并保存 `github.branch`**（无需再点「保存设置」）；owner/repo/token 不齐时在下拉内给引导而非弹错；点外部 / `Esc` 收起；该输入框为**只读展示态**，值唯一来源是下拉点选（2026-10-03 补）。

## F21 审计与报告（removed 2026-09-30）

- ~~优先级：P2 · 模块：**webui**~~
- 实现（域）：[module-webui · F21](design/module-webui.md#f21-审计与报告)（历史设计）
- **UI 面板已于 2026-09-30 删除**（commit `2aa016f`，标题 `feat(ui): manage view = uploaded gallery; drop revert/audit/watch panels`，删除 `renderer/index.html` 31 行；当前 `renderer/index.html` 只有五个视图：`upload` / `stats` / `gallery` / `settings` / `doc`；全仓 `grep -rn 'id="revert\|id="runs\|id="watch' renderer/` → 零命中）。**API 仍在**：`src/ui/routes/runs.ts:7` `GET /api/runs`、`:12` `GET /api/runs/<id>`；且有测试守着：`tests/ui-panels.test.ts:130`（`/api/runs`）。以下为历史 AC：可查看最近 run 记录（时间、命令、counts、ok/partial/fail）；可展开失败明细（path + reason + 退出码语义）；可导出 JSON，信封含 `schemaVersion` 且字段与 [`cross-cutting.md`](design/cross-cutting.md) 对齐；报告**无 token**。

## F22 监听控制台（removed 2026-09-30）

- ~~优先级：P2 · 模块：**webui**~~
- 实现（域）：[module-webui · F22](design/module-webui.md#f22-监听控制台)（历史设计）
- **UI 面板已于 2026-09-30 删除**（commit `2aa016f`，标题 `feat(ui): manage view = uploaded gallery; drop revert/audit/watch panels`，删除 `renderer/index.html` 31 行；当前 `renderer/index.html` 只有五个视图：`upload` / `stats` / `gallery` / `settings` / `doc`；全仓 `grep -rn 'id="revert\|id="runs\|id="watch' renderer/` → 零命中）。**API 仍在**：`src/ui/routes/watch.ts:7` `GET /api/watch`、`:12` `POST /api/watch/start`、`:50` `POST /api/watch/stop`；且有测试守着：`tests/ui-panels.test.ts:155`（`/api/watch/start`）。以下为历史 AC：可对目录启停 watch（等价 F12 语义）；变更批次在界面可见；**默认 `preview` 仅预览**，可选「确认后同步」；`auto` 须显式打开；停止后进程/监听退出，**无**常驻特权；忽略规则与 F12 一致（`node_modules`/`.git`/`.picbed`）。

## F23 Web 控制台壳层与视觉重设计

- 优先级：P0（已实现）· 模块：**webui**
- 实现（域）：[module-webui · F23](design/module-webui.md#f23-web-控制台壳层与视觉重设计) · 视格：[wireframes/ui-shell.md](design/wireframes/ui-shell.md)（权威：用户《图床工具-UI方案》）
- AC：界面为 **72px 侧栏 + 顶栏 + 内容区**；侧栏视图均可直达且文案为「上传 / 统计 / 图库 / 设置 / 规范」（F25 2026-11-09 第二视图「管理」→「统计」；图库 2026-09-30 加入；「规范」仅本地调试可见，见 F24 补充）；默认进入**上传/文件放置**（DropZone 英雄区 + 照片墙）；图库页浏览仓库文件夹与图片；设置页含配置/doctor 与 Toggle；规范页含令牌与 Logo 切换；主题令牌与组件规格（晨雾蓝×落日暖、Toggle 36×20、Logo 三态）与交付规范一致；**token 不得出现在 DOM 可读文本**；API/`confirm`/掩码/策略 A 契约**无回归**。发包/安装版侧栏不显示「规范」入口。

## F25 使用统计视图

- 优先级：P1 · 模块：**webui**
- 实现（域）：[module-webui · F25](design/module-webui.md#f25-使用统计视图)
- AC（统计视图，2026-11-09；UI 2026-11-11 重设计；**口径 v2 2026-11-12**）：侧栏第二视图由「管理」改为「统计」——manifest 网格、搜索/排序/批量复制外链工具栏与旧四统计卡（文件总数/本月上传/已映射/外链调用）**移除**，替换为使用统计视图（`GET /api/stats` 聚合；hero 卡 48px 大数字 + 副行「已保存记录中成功上传 N 次图像 · 上传时间按运行开始估算」，partial 追加「记录不完整」，unavailable 显示「— / 暂无可用上传记录」；今天 / 过去7天+环比（`deltaPct=null` 分「记录不完整，暂不比较」/「无对比基线」两态）/ 连续天数 / 最忙的一天 四 KPI 卡；过去 365 天 GitHub 风格日历热力图——宽度自适应、5 档色阶 +「少→多」图例；24 小时时段柱状图——左 y 轴、命中区 ≥24px；「当前远端库存」独立卡；刷新按钮）。**计数单位 = 一次成功上传动作**（`measurement.unit='successful-image-upload'`），**runs 是唯一计数源**（`scanAllRuns` 全量读取，`counts.uploaded` 按 `startedAt` 归桶；partial run 已成功部分照计）；**范围恒为 365 日统一窗口**（`period: rolling-days/365`，窗口外 run 不计入但记录仍在，不判 unavailable）。manifest 为映射快照、远端提交不是上传事件，二者均 `not-counted`（`sources.manifest.reason='mapping-snapshot'`、`sources.remoteCommits.reason='not-upload-events'`）；**状态结构化**（`measurement.state` / `sources.runs.state` 三态 available/partial/unavailable，判定表见 module-webui §F25；读取抛错→unavailable≠0）；**远端库存与上传语义分离**（`sources.remoteInventory` 仅上下文，Trees truncated→partial，失败/未配置→unavailable，不参与 count、不称上传）。data 内 `contractVersion: 2`，外层信封 `schemaVersion` 仍为 1；renderer 契约不匹配时显式「统计契约不匹配」，不得 `?? 0` 静默渲染。API 契约（信封/confirm/掩码）不变。

## F26 图库视图

- 优先级：P1（已实现）· 模块：**webui**
- 实现（域）：[module-webui · 图库视图](design/module-webui.md#图库视图)（2026-09-30 随 `8a1c1af` 落地）
- AC：侧栏「图库」进入仓库浏览——文件夹树 + 图片墙（复用 `GET /api/gallery?path=` 列目录/文件）；图片批量删除（`/api/gallery/delete`）；图片格式白名单与 `IMAGE_EXT` 一致（复用 `lib/files.js isImageName()`，不内联枚举）；仅浏览仓库内容，不改 manifest 统计口径。**F26/F25 边界**：图库删图只改仓库远端文件，**不回写、不抵消 F25 历史**（F25 以 runs 成功上传动作计数；删除远端图片不改变既有 run 记录，故历史计数不回落；远端库存卡只是当下仓库快照，删图只影响库存数值本身）。

## F24 桌面应用壳与安装包

- 优先级：P0（已实现）· 模块：**desktop**
- 实现（域）：[module-desktop · F24](design/module-desktop.md#f24-桌面应用壳与安装包)
- AC（2026-11-10 修订：npm 形态移除）——**桌面安装包**为唯一分发形态（原「双形态并存」中 npm/`picbed ui` 侧已随 CLI/MCP 移除）。桌面端启动原生窗口并加载**完整 Web 控制台**（F16–F25 契约不变）；UI 服务仅绑 `127.0.0.1`；提供**原生目录选择**（策略 A 仍强制先绑 root）；窗口尺寸/位置可记忆；关闭窗口释放端口并停 watch；token 不进渲染进程；Windows NSIS 用户级安装包（`picbed-setup.exe`）可在无 Node 环境运行。**调试可见性**：侧栏「规范」仅在本地调试显示（源码树 / `desktop:dev` / `PICBED_UI_DEV=1`）；安装包 `app.isPackaged` **不得**显示该入口（`PICBED_UI_DEV=0` 强制关闭）。**开发热更新（`desktop:dev` = electron-vite）**：渲染层 **Vite HMR**（改 `renderer/*` 免刷新）；主进程/preload 由 electron-vite 重启；核心 `dist/` 由 `tsc -w` 产出。UI 单源在 `renderer/`（详见 module-desktop）。

---

## 优先级说明

- **P0**：最小可用闭环（配置→抽取→计划→上传→回写→Agent JSON）；Web 控制台最小闭环（F16–F18）；**UI 壳层与视觉重设计（F23，已实现）**；**桌面应用壳与安装包（F24）**。
- **P1**：revert/manifest 完备、单文件上传；Web 回滚与配置/doctor（F19–F20）。
- **P2**：Web 审计报告与 watch 控制台（F21–F22）；更丰富 report 增强。
- **P3**：原 backlog（watch、多图床、IDE 集成）——**均已实现**，保留编号仅作交付史。

*定义以本表为准；实现细节以 module-* / cross-cutting 为准；冲突须显式修文档。*
