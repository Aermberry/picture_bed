# 功能点规格总表（索引 + 双向链接）

> **新人阅读入口**：先读 [`design-reading-guide.md`](design-reading-guide.md)——了解 **F/P/模块/AC** 等标识，再回本表查具体功能点。
>
> 本文件是功能点的**定义与归属权威**；AC 给出完成判据，模块文档给出域实现契约。
> **产品定位**：**picbed** 桌面应用——扫描文档内嵌图片 → GitHub 图床上传 → 链接回写；Electron 是唯一宿主。
> 详细实现设计按 DDD 模块拆分：
> - **ingest**（F3/F4 扫描抽取、F5 解析去重）→ [`design/module-ingest.md`](design/module-ingest.md)
> - **transfer**（F6/F7 上传与 URL）→ [`design/module-transfer.md`](design/module-transfer.md)
> - **rewrite**（F8/F9 回写与 revert）→ [`design/module-rewrite.md`](design/module-rewrite.md)
> - **cliops**（F1/F2/F10/F11 配置、自检、机器接口）→ [`design/module-cliops.md`](design/module-cliops.md)
> - **webui**（F16–F23 控制台、工作台与壳层）→ [`design/module-webui.md`](design/module-webui.md)
> - **desktop**（F24 桌面应用壳与安装包）→ [`design/module-desktop.md`](design/module-desktop.md)
> - **app**（共享应用编排层，非限界上下文）→ [`design/module-app.md`](design/module-app.md)
> - 横切契约 / 退出码 / JSON → [`design/cross-cutting.md`](design/cross-cutting.md)
>
> 模块文档的「功能点映射」链回本表，形成双向链接。优先级说明见文末；架构分层见 [`architecture.md`](architecture.md)。

## 总览

| ID | 名称 | 优先级 | 模块 | AC 摘要 |
|----|------|--------|------|---------|
| F1 | 项目初始化与配置 | P0 | cliops | 初始化合法模板；配置读写校验；token 掩码 |
| F2 | 环境与鉴权自检 | P0 | cliops | 报告配置/token/权限问题；失败退出码 3 |
| F3 | 目录扫描与文档发现 | P0 | ingest | 按扩展名和 ignore 规则扫描；不进入 node_modules |
| F4 | 图片引用抽取 | P0 | ingest | 覆盖 MD/HTML；代码区不误抽；偏移可替换 |
| F5 | 本地资产解析与去重 | P0 | ingest | 相对路径解析；缺失/越界可诊断；按 sha256 去重 |
| F6 | 上传计划 plan | P0 | transfer | upload/skip-cache/skip-remote/blocked 分类；支持 dry-run |
| F7 | GitHub 图床上传 | P0 | transfer | Contents API 上传；URL 风格正确；同 sha 幂等 |
| F8 | 文档链接回写 | P0 | rewrite | 仅替换 URL 子串；原子写；默认 backup |
| F9 | Manifest 与 revert | P1 | rewrite | 映射可审计；revert 恢复原路径；不含 token |
| F10 | Agent 机器接口 | removed | cliops | CLI 宿主已移除；Web API 承载存活契约 |
| F11 | 单文件上传 | P1 | transfer | 上传输出 publicUrl；复用 HostAdapter |
| F15 | GitHub Token 鉴权 | P0 | cliops | 支持 PAT/GITHUB_TOKEN/gh auth；无 OAuth App |
| F12 | watch 监听 | P3 | cliops | 变更触发增量 plan/sync；可退出 |
| F13 | 多图床适配器 | P3 | transfer | HostAdapter 支持替换后端 |
| F14 | VS Code / MCP 包装 | removed | cliops | MCP 宿主已移除；历史设计保留 |
| F16 | 本地 Web 控制台服务 | P0 | webui | 本机 HTTP 起停；健康检查；token 不出响应 |
| F17 | 目录/拖拽与计划工作台 | P0 | webui | 拖入、预览、选择与确认上传；dry-run 无副作用 |
| F18 | 一键同步 | P0 | webui | 确认后 sync；进度、结果及部分失败可见 |
| F19 | 回滚面板 | removed | webui | UI 面板已移除；相关 API 仍在 |
| F20 | 配置与自检面板 | P1 | webui | 掩码编辑配置；doctor 结果可见 |
| F21 | 审计与报告 | removed | webui | UI 面板已移除；runs API 仍在 |
| F22 | 监听控制台 | removed | webui | UI 面板已移除；watch API 仍在 |
| F23 | Web 控制台壳层与视觉重设计 | P0 | webui | 多视图与主题令牌；API/确认/掩码契约不变 |
| F24 | 桌面应用壳与安装包 | P0 | desktop | Electron 完整控制台；Windows NSIS 安装包 |
| F25 | 使用统计视图 | P1 | webui | runs 唯一计数源；365 日统计、热力图与时段分布 |
| F26 | 图库视图 | P1 | webui | 仓库图片浏览与批量删除；不改统计口径 |

## F1 项目初始化与配置

- 优先级：P0 · 模块：**cliops**
- 实现（域）：[module-cliops · F1](design/module-cliops.md#f1-项目初始化与配置)
- 现状：init 在空目录生成不含 secret 的合法 `picbed.toml` 模板；`--force` 可覆盖；config list 掩码 token、set 校验键名与枚举；配置优先级 ENV > 项目文件，无用户级配置。

## F2 环境与鉴权自检

- 优先级：P0 · 模块：**cliops**
- 实现（域）：[module-cliops · F2](design/module-cliops.md#f2-环境与鉴权自检)
- 现状：doctor 检查配置、token、API 可达性与仓库 Contents 权限；问题可定位到缺键名/HTTP 状态；失败退出码 3，成功摘要含 `ok:true`。

## F3 目录扫描与文档发现

- 优先级：P0 · 模块：**ingest**
- 实现（域）：[module-ingest · F3](design/module-ingest.md#f3-目录扫描与文档发现)
- 现状：默认扫描 `md,html,htm`（可配置）并遵循 ignore glob；跳过 `node_modules`/`.git`，不跟随出根 symlink；结果按规范化路径稳定排序，不可读目录记 warning 后继续。

## F4 图片引用抽取

- 优先级：P0 · 模块：**ingest**
- 实现（域）：[module-ingest · F4](design/module-ingest.md#f4-图片引用抽取)
- 现状：抽取 Markdown 图片、图片扩展名链接及 HTML `img`/`source`/SVG `image`；fenced/行内代码中的伪引用不产出；每条引用含 URL 子串精确 `start/end`，同文档重复引用保留供后续合并。

## F5 本地资产解析与去重

- 优先级：P0 · 模块：**ingest**
- 实现（域）：[module-ingest · F5](design/module-ingest.md#f5-本地资产解析与去重)
- 现状：相对路径以文档目录为基准并校验扫描根；绝对路径与 `file://` 始终拒绝，缺失/非白名单扩展名进入 blocked；按内容 `sha256` 合并资产，data 图片解码入内存、单张上限 10 MB。

## F6 上传计划 plan

- 优先级：P0 · 模块：**transfer**
- 实现（域）：[module-transfer · F6](design/module-transfer.md#f6-上传计划-plan)
- 现状：缓存命中、远端 URL、本地合法文件、解析失败分别归为 `skip-cache`/`skip-remote`/`upload`/`blocked`；plan 与 `sync --dry-run` 不上传、不改文档，计划包含 action 与 reason。

## F7 GitHub 图床上传

- 优先级：P0 · 模块：**transfer**
- 实现（域）：[module-transfer · F7](design/module-transfer.md#f7-github-图床上传)
- 现状：经 Contents API 上传并生成 `raw`/`jsdelivr`/`custom` URL；同 sha 重复 sync 不重复上传；429/403 退避后重试或以退出码 5 明确失败，commit message 可配置。

## F8 文档链接回写

- 优先级：P0 · 模块：**rewrite**
- 实现（域）：[module-rewrite · F8](design/module-rewrite.md#f8-文档链接回写)
- 现状：只替换引用 URL 子串，保留 alt/title/周边文本且不改代码区；原子写避免半截文件；默认生成 backup，可由 `[rewrite] backup = false` 关闭。

## F9 Manifest 与 revert

- 优先级：P1 · 模块：**rewrite**
- 实现（域）：[module-rewrite · F9](design/module-rewrite.md#f9-manifest-与-revert)
- 现状：manifest 记录 doc/raw/localPath/sha256/publicUrl 且不含 token；revert 恢复原文档 raw 路径，dry-run 不写盘；损坏 manifest 显式报错，不静默丢映射。

## F10 Agent 机器接口

- 优先级：~~P0 · 模块：**cliops**~~
- 实现（域）：[module-cliops · F10](design/module-cliops.md#f10-agent-机器接口)（历史设计）
> 已移除：2026-11-10，CLI / MCP / npm 宿主随 Electron 单宿主收敛而移除；`--json` 信封语义由 Web API 承载，退出码映射仍在 `src/app/errors.ts`。

## F11 单文件上传

- 优先级：P1 · 模块：**transfer**
- 实现（域）：[module-transfer · F11](design/module-transfer.md#f11-单文件上传)
- 现状：`upload <file>` 输出 publicUrl（人类/JSON）；与 sync 共用 HostAdapter 和 URL 策略，失败映射到既有退出码。

## F15 GitHub Token 鉴权

- 优先级：P0 · 模块：**cliops**
- 实现（域）：[module-cliops · F15](design/module-cliops.md#f15-github-token-鉴权)
- 现状：无 OAuth App/login；token 顺序为 `PICBED_GITHUB_TOKEN` → `GITHUB_TOKEN` → `~/.picbed/credentials.json` → `gh auth token`；缺失时 doctor/sync 退出码 3，输出一律掩码。

## F12 watch 监听

- 优先级：P3 · 模块：**cliops**
- 实现（域）：[module-cliops · F12](design/module-cliops.md#f12-watch-监听)
- 现状：watch 递归监听并防抖，变更触发增量 sync；SIGINT/SIGTERM 可退出，忽略 `node_modules`/`.git`/`.picbed`，不引入常驻特权。

## F13 多图床适配器

- 优先级：P3 · 模块：**transfer**
- 实现（域）：[module-transfer · F13](design/module-transfer.md#f13-多图床适配器)
- 现状：`HostAdapter` 可替换为非 GitHub 后端且保留 AC7 语义；`github`/`local` 由 `createHostAdapter` 注入，URL 与远端路径由适配器提供。

## F14 VS Code / MCP 包装

- 优先级：~~P3 · 模块：**cliops**~~
- 实现（域）：[module-cliops · F14](design/module-cliops.md#f14-vs-code--mcp-包装)（历史设计）
> 已移除：2026-11-10，CLI/MCP 宿主移除后不再分发 VS Code / MCP 包装；包装层历史契约见 [module-cliops](design/module-cliops.md#f14-vs-code--mcp-包装)，存活 API 契约见 [cross-cutting.md](design/cross-cutting.md)。

## F16 本地 Web 控制台服务

- 优先级：P0 · 模块：**webui**
- 实现（域）：[module-webui · F16](design/module-webui.md#f16-本地-web-控制台服务)
- 现状：UI 服务仅监听 `127.0.0.1`，支持指定端口、健康检查与干净退出；端口占用明确失败，任意 HTTP 响应均不得含 token 或可还原 secret。

## F17 目录/拖拽与计划工作台

- 优先级：P0 · 模块：**webui**
- 实现（域）：[module-webui · F17](design/module-webui.md#f17-目录拖拽与计划工作台)
- 现状：拖放仅接受图片或可扫描文档，拒绝文件夹；成功扫描后以照片墙预览本次拖入图片及文档引用的本地图片，连续拖入按路径/内容去重累加；多选删除仅移出会话工作集，重置或上传成功清空；上传确认后仅作用于工作集，失败原因可见，不提供文件选择器或剪贴板粘贴。

## F18 一键同步

- 优先级：P0 · 模块：**webui**
- 实现（域）：[module-webui · F18](design/module-webui.md#f18-一键同步)
- 现状：拖放后进入上传流程，写盘/上传前仍需显式 `confirm`；完成反馈含计数、部分失败可见且幂等；计划/同步面板已移除，`/api/plan`、`/api/sync` 仍供照片墙流程调用，manifest/runs API 保留。

## F19 回滚面板

- 优先级：~~P1 · 模块：**webui**~~
- 实现（域）：[module-webui · F19](design/module-webui.md#f19-回滚面板)（历史设计）
> 已移除：2026-09-30，commit `2aa016f` 删除 UI 面板；`GET /api/runs` 仍在 `src/ui/routes/runs.ts:7,12`，测试守卫在 `tests/ui-panels.test.ts:130`。

## F20 配置与自检面板

- 优先级：P1 · 模块：**webui**
- 实现（域）：[module-webui · F20](design/module-webui.md#f20-配置与自检面板)
- 现状：配置可查看且 token 掩码，可编辑非 secret 键并运行 doctor；`github.dir` 通过远端目录浮层点选/新建后立即保存且只读，`github.branch` 通过分支下拉点选后立即保存且只读；缺少 owner/repo/token 时给引导。

## F21 审计与报告

- 优先级：~~P2 · 模块：**webui**~~
- 实现（域）：[module-webui · F21](design/module-webui.md#f21-审计与报告)（历史设计）
> 已移除：2026-09-30，commit `2aa016f` 删除 UI 面板；`GET /api/runs` 与 `GET /api/runs/<id>` 仍在 `src/ui/routes/runs.ts:7,12`，测试守卫在 `tests/ui-panels.test.ts:130`。

## F22 监听控制台

- 优先级：~~P2 · 模块：**webui**~~
- 实现（域）：[module-webui · F22](design/module-webui.md#f22-监听控制台)（历史设计）
> 已移除：2026-09-30，commit `2aa016f` 删除 UI 面板；`/api/watch`、`/api/watch/start`、`/api/watch/stop` 仍在 `src/ui/routes/watch.ts`，测试守卫在 `tests/ui-panels.test.ts:155`。

## F23 Web 控制台壳层与视觉重设计

- 优先级：P0 · 模块：**webui**
- 实现（域）：[module-webui · F23](design/module-webui.md#f23-web-控制台壳层与视觉重设计) · 视格：[wireframes/ui-shell.md](design/wireframes/ui-shell.md)（权威：用户《图床工具-UI方案》）
- 现状：72px 侧栏、顶栏与内容区提供上传/统计/图库/设置/规范多视图，默认进入上传；晨雾蓝×落日暖令牌与组件规格一致，规范仅调试可见；token 不进入 DOM 文本，API/confirm/掩码/策略 A 契约不变。

## F25 使用统计视图

- 优先级：P1 · 模块：**webui**
- 实现（域）：[module-webui · F25](design/module-webui.md#f25-使用统计视图)
- 现状：`GET /api/stats` 以全量 runs 的成功上传动作计数，按 `startedAt` 归桶、统一 rolling 365 日窗口，partial run 成功部分照计；manifest/远端提交不计数，远端库存仅作上下文；measurement 与来源用 available/partial/unavailable 三态，读取错误不得当作 0；视图含 today/7-day 与环比/连续天数/最忙日 KPI、365 日热力图、24 小时时段图和远端库存卡，契约不匹配显式提示。

## F26 图库视图

- 优先级：P1 · 模块：**webui**
- 实现（域）：[module-webui · 图库视图](design/module-webui.md#f26-图库视图)
- 现状：`GET /api/gallery` 提供仓库目录树与图片墙，支持图片批量删除；图片白名单复用 `IMAGE_EXT`/`isImageName()`，图库只浏览仓库，不改变 F25 统计，远端删除不回写或抵消历史上传计数。

## F24 桌面应用壳与安装包

- 优先级：P0 · 模块：**desktop**
- 实现（域）：[module-desktop · F24](design/module-desktop.md#f24-桌面应用壳与安装包)
- 现状：桌面安装包为唯一分发形态；Electron 窗口加载完整 Web 控制台，UI 服务仅绑 `127.0.0.1`，原生目录选择仍先绑定 root；窗口位置可记忆、关闭释放端口并停 watch、token 不进渲染进程；Windows NSIS 用户级安装包无需 Node，规范入口仅开发态可见。

---

## 优先级说明

- **P0**：最小可用闭环（配置→抽取→计划→上传→回写）；Web 控制台闭环 F16–F18、壳层 F23 与桌面壳 F24。
- **P1**：revert/manifest、单文件上传、配置与自检；统计和图库视图。
- **P2**：增强能力。
- **P3**：原 backlog；watch、多图床、IDE 集成均已实现，保留编号以供追溯。

*定义以本表为准；实现细节以 module-* / cross-cutting 为准；冲突须显式修订文档。*
