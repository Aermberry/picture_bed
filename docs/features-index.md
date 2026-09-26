# 功能点规格总表（索引 + 双向链接）

> **新人阅读入口**：先读 [`design-reading-guide.md`](design-reading-guide.md)——文中 **F/P/模块/AC** 等标识的含义与用途，再回本表查具体功能点。
>
> 本文件为功能点**索引与归属枢纽**：每节给出优先级、**所属模块**、实现归属（域/CLI）、AC 摘要。
> **产品定位**：本地 CLI **picbed**——扫描文档内嵌图片 → GitHub 图床上传 → 链接回写；Agent 可驱动。
> 详细实现设计按 DDD 模块拆分：
> - **ingest** 模块（F3/F4 扫描抽取、F5 解析去重）→ [`design/module-ingest.md`](design/module-ingest.md)
> - **transfer** 模块（F6/F7 上传与 URL）→ [`design/module-transfer.md`](design/module-transfer.md)
> - **rewrite** 模块（F8/F9 回写与 revert）→ [`design/module-rewrite.md`](design/module-rewrite.md)
> - **cliops** 模块（F1/F2/F10/F11 配置、doctor、Agent 契约）→ [`design/module-cliops.md`](design/module-cliops.md)
> - **webui** 模块（F16–F23 本地 Web 控制台，含拖拽工作台与壳层视觉）→ [`design/module-webui.md`](design/module-webui.md)
> - **desktop** 模块（F24 桌面应用壳与安装包）→ [`design/module-desktop.md`](design/module-desktop.md)
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
| F10 | Agent 机器接口 | P0 | cliops | `--json` schema 稳定；退出码契约；无 TTY 不阻塞 |
| F11 | 单文件上传 | P1 | transfer | upload 子命令输出 URL；与 sync 共用适配器 |
| F15 | GitHub Token 鉴权 | P0→**done** | cliops | PAT/GITHUB_TOKEN/gh auth；无 OAuth App |
| F12 | watch 监听 | P3→**done** | cliops | 目录变更触发增量 plan/sync；可退出；不引入常驻特权 |
| F13 | 多图床适配器 | P3→**done** | transfer | HostAdapter 可替换为非 GitHub 后端且 AC7 语义保持 |
| F14 | VS Code / MCP 包装 | P3→**done** | cliops | 包装层不复制业务规则，只调用 CLI 契约 |
| F16 | 本地 Web 控制台服务 | P0→**done** | webui | 本机 HTTP 起停、健康检查、token 不出响应 |
| F17 | 目录/拖拽与计划工作台 | P0→**done** | webui | 路径或拖拽导入；scan/plan；dry-run 无副作用 |
| F18 | 一键同步 | P0→**done** | webui | 确认后 sync；进度与结果可观察 |
| F19 | 回滚面板 | P1→**done** | webui | manifest 可视；revert 可 dry-run |
| F20 | 配置与自检面板 | P1→**done** | webui | config 掩码编辑；doctor 报告可见 |
| F21 | 审计与报告 | P2→**done** | webui | run 记录/失败明细；JSON 与契约对齐 |
| F22 | 监听控制台 | P2→**done** | webui | watch 启停与事件日志；无常驻特权 |
| F23 | 控制台壳层与视觉重设计 | P0→**done** | webui | 72px 侧栏四视图「上传/管理/设置/规范」；晨雾蓝×落日暖令牌；F17–F22 可达且契约不变 |
| F24 | 桌面应用壳与安装包 | P0→**done** | desktop | Electron 壳加载完整控制台；原生目录对话框；Windows NSIS 安装包；npm 形态不受影响 |

---

## F1 项目初始化与配置

- 优先级：P0 · 模块：**cliops**
- 实现（域）：[module-cliops · F1](design/module-cliops.md#f1-项目初始化与配置)
- AC：`init` 在空目录生成 `picbed.toml` 合法模板（无 secret）；`--force` 可覆盖；`config list` 对 token 掩码；`config set` 校验键名与枚举（如 `url.style`）；优先级 CLI>ENV>项目文件生效。

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
- AC：仅替换引用 URL 子串，alt/title/周边文本不变；代码块内不改写；原子写无半截文件；默认生成 backup；`--out-dir` 时源文件不变。

## F9 Manifest 与 revert

- 优先级：P1 · 模块：**rewrite**
- 实现（域）：[module-rewrite · F9](design/module-rewrite.md#f9-manifest-与-revert)
- AC：manifest 记录 doc/raw/localPath/sha256/publicUrl；**无 token**；`revert` 将 URL 还原为原文档中的 raw 路径；`revert --dry-run` 不写盘；损坏 manifest 报错不静默丢映射。

## F10 Agent 机器接口

- 优先级：P0 · 模块：**cliops**
- 实现（域）：[module-cliops · F10](design/module-cliops.md#f10-agent-机器接口)
- AC：支持命令均有 `--json`；stdout 单一 JSON（诊断走 stderr）；含 `schemaVersion`；非 TTY 写文件需 `--yes` 否则退出码 7；退出码与文档表一致；重复 run 幂等可预期。

## F11 单文件上传

- 优先级：P1 · 模块：**transfer**
- 实现（域）：[module-transfer · F11](design/module-transfer.md#f11-单文件上传)
- AC：`upload <file>` 成功输出 publicUrl（人类/JSON）；与 `sync` 共用 HostAdapter 与 URL 策略；失败映射到既有退出码。

## F15 GitHub Token 鉴权

- 优先级：P0（已实现）· 模块：**cliops**
- 实现（域）：[module-cliops · F15](design/module-cliops.md#f15-github-token-鉴权)
- AC：**无 OAuth App / 无 login 命令**。token 解析顺序：`PICBED_GITHUB_TOKEN` → `GITHUB_TOKEN` → `gh auth token`；缺失时 `doctor`/`sync` 退出码 3；输出一律掩码。原 OAuth 点击登录已移除（分发成本过高）。

## F12 watch 监听

- 优先级：P3（已实现）· 模块：**cliops**
- 实现（域）：[module-cliops · F12](design/module-cliops.md#f12-watch-监听)
- AC：目录变更触发增量 plan/sync；可退出；不引入常驻特权。实现：`watch <path> --debounce <ms>`；`fs.watch` 递归监听 + 防抖批处理；变更时 spawn 既有 `sync`（只调 CLI 契约）；SIGINT/SIGTERM 可退出；忽略 `node_modules`/`.git`/`.picbed`。

## F13 多图床适配器

- 优先级：P3（已实现）· 模块：**transfer**
- 实现（域）：[module-transfer · F13](design/module-transfer.md#f13-多图床适配器)
- AC：`HostAdapter` 可替换为非 GitHub 后端且 AC7 语义保持。实现：`host.type = github | local`；`local` 为文件系统图床（无需 token）；工厂 `createHostAdapter` 注入 sync/upload；URL/远端路径由适配器 `composeUrls`/`remotePath` 提供。

## F14 VS Code / MCP 包装

- 优先级：P3（已实现）· 模块：**cliops**
- 实现（域）：[module-cliops · F14](design/module-cliops.md#f14-vs-code--mcp-包装)
- AC：包装层不复制业务规则，只调用 CLI 契约。实现：`picbed-mcp` stdio JSON-RPC 服务；tools = doctor/scan/plan/sync/upload/revert；全部 `spawn` 既有 CLI + `--json`。

## F16 本地 Web 控制台服务

- 优先级：P0 · 模块：**webui**
- 实现（域）：[module-webui · F16](design/module-webui.md#f16-本地-web-控制台服务)
- AC：`ui` 子命令在本机拉起 HTTP 控制台并打印可访问 URL；默认**仅**监听 `127.0.0.1`；`--port` 可指定端口，占用时失败退出码 2 并提示；SIGINT/SIGTERM 干净退出且不残留监听；`GET /api/health` 返回 `ok:true` 与 `schemaVersion`；**任意** HTTP 响应不得出现 token 明文或可还原 secret。

## F17 目录/拖拽与计划工作台

- 优先级：P0 · 模块：**webui**
- 实现（域）：[module-webui · F17](design/module-webui.md#f17-目录拖拽与计划工作台)
- AC：上传页**仅有拖放区**。拖入后自动扫描；**扫描成功**时拖放区展示**已解析图片预览**（缩略图）+ **「上传」「重置」**按钮。上传 = 确认后 `sync`；重置 = 清除本次扫描结果并回到空拖放区（不上传、不改文档）。未解析/失败仍提示原因。不提供「选择文件」「粘贴剪贴板」。CLI 的 plan/dry-run 语义不变。

## F18 一键同步

- 优先级：P0 · 模块：**webui**
- 实现（域）：[module-webui · F18](design/module-webui.md#f18-一键同步)
- AC：**拖放完成即触发 sync**（无独立「计划/同步」面板）；写盘/上传前仍**显式确认**（服务端需 `confirm`）；完成后 toast/简要反馈 uploaded 等计数；部分失败可见；幂等可预期。原 scan/plan/sync 按钮与计划表**移除**（API 保留给 CLI/管理流）。

## F19 回滚面板

- 优先级：P1 · 模块：**webui**
- 实现（域）：[module-webui · F19](design/module-webui.md#f19-回滚面板)
- AC：可浏览 manifest（doc / raw / publicUrl / sha256）；支持 `revert --dry-run` 等价预览（不写盘）；确认后将 URL 还原为原文档 raw 路径；manifest 损坏时界面可见错误且不静默清空。

## F20 配置与自检面板

- 优先级：P1 · 模块：**webui**
- 实现（域）：[module-webui · F20](design/module-webui.md#f20-配置与自检面板)
- AC：可查看当前配置且 **token 一律掩码**；可编辑非 secret 配置键并校验枚举（如 `url.style`）；可触发 doctor 并展示 checks / failures（含缺键名、HTTP 状态）；缺 token 时给出 PAT 与 `gh auth` 获取指引（hint），不回显 secret。

## F21 审计与报告

- 优先级：P2 · 模块：**webui**
- 实现（域）：[module-webui · F21](design/module-webui.md#f21-审计与报告)
- AC：可查看最近 run 记录（时间、命令、counts、ok/partial/fail）；可展开失败明细（path + reason + 退出码语义）；可导出 JSON，信封含 `schemaVersion` 且字段与 [`cross-cutting.md`](design/cross-cutting.md) 对齐；报告**无 token**。

## F22 监听控制台

- 优先级：P2 · 模块：**webui**
- 实现（域）：[module-webui · F22](design/module-webui.md#f22-监听控制台)
- AC：可对目录启停 watch（等价 F12 语义）；变更批次在界面可见；**默认 `preview` 仅预览**，可选「确认后同步」；`auto` 须显式打开；停止后进程/监听退出，**无**常驻特权；忽略规则与 F12 一致（`node_modules`/`.git`/`.picbed`）。

## F23 Web 控制台壳层与视觉重设计

- 优先级：P0（已实现）· 模块：**webui**
- 实现（域）：[module-webui · F23](design/module-webui.md#f23-web-控制台壳层与视觉重设计) · 视格：[wireframes/ui-shell.md](design/wireframes/ui-shell.md)（权威：用户《图床工具-UI方案》）
- AC：界面为 **72px 侧栏 + 顶栏 + 内容区**；侧栏**四视图**均可直达且文案为「上传 / 管理 / 设置 / 规范」；默认进入**上传/文件放置**（DropZone 英雄区 + 根绑定 + 工作集 + plan/sync）；管理页含统计、manifest 网格、回滚、审计、监听；设置页含配置/doctor 与 Toggle；规范页含令牌与 Logo 切换；主题令牌与组件规格（晨雾蓝×落日暖、Toggle 36×20、Logo 三态）与交付规范一致；**token 不得出现在 DOM 可读文本**；API/`confirm`/掩码/策略 A 契约**无回归**。**「规范」视图仅本地调试可见**（见 F24 补充），发包/安装版侧栏不显示该入口。

## F24 桌面应用壳与安装包

- 优先级：P0（已实现）· 模块：**desktop**
- 实现（域）：[module-desktop · F24](design/module-desktop.md#f24-桌面应用壳与安装包)
- AC：双形态并存——**npm**（`picbed`/`picbed-mcp`/`picbed ui`，供本地开发测试与 Agent）与**桌面安装包**（下载安装即用）互不破坏。桌面端启动原生窗口并加载**完整 Web 控制台**（F16–F23 契约不变）；UI 服务仅绑 `127.0.0.1`；提供**原生目录选择**（策略 A 仍强制先绑 root）；窗口尺寸/位置可记忆；关闭窗口释放端口并停 watch；token 不进渲染进程；`npm pack` **不含** Electron/`desktop/`；Windows NSIS 用户级安装包（`picbed-setup.exe`）可在无 Node 环境运行。**调试可见性**：侧栏「规范」仅在本地调试显示（源码树 / `desktop:dev` / `PICBED_UI_DEV=1`）；正式发包（`npm i -g`、安装包 `app.isPackaged`）**不得**显示该入口（`PICBED_UI_DEV=0` 强制关闭）。

---

## 优先级说明

- **P0**：最小可用闭环（配置→抽取→计划→上传→回写→Agent JSON）；Web 控制台最小闭环（F16–F18）；**UI 壳层与视觉重设计（F23，已实现）**；**桌面应用壳与安装包（F24）**。
- **P1**：revert/manifest 完备、单文件上传；Web 回滚与配置/doctor（F19–F20）。
- **P2**：Web 审计报告与 watch 控制台（F21–F22）；更丰富 report 增强。
- **P3**：原 backlog（watch、多图床、IDE 集成）——**均已实现**，保留编号仅作交付史。

*定义以本表为准；实现细节以 module-* / cross-cutting 为准；冲突须显式修文档。*
