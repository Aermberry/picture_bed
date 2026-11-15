# cliops 模块（历史附录）

> 归属功能点：F1 项目初始化与配置、F2 环境与鉴权自检、F10 Agent 机器接口、F12 watch 监听、F14 VS Code/MCP 包装、F15 Token 鉴权。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；全局契约见 [`cross-cutting.md`](cross-cutting.md)。
>
> **⚠️ 状态（2026-11-10）：CLI / MCP 宿主已删除**（`src/cli.ts`、`src/mcp/`、`bin/*` 随 Electron 单形态收敛移除）。本文件保留为**历史设计**（`validate:design` profile 仍要求其存在），F10/F14 的命令面与 MCP 通道已不存在；配置模型 / token 解析顺序 / doctor 语义仍由 app 层实现并被 WebUI 复用。
> 宿主（CLI/MCP/npm 面）已移除；本文档保留 F1/F2/F15 存活契约与 F10/F12/F14 历史归属。

## 目的

本文是 cliops 的历史附录。宿主已随 2026-11-10 Electron 单宿主收敛移除；配置、自检与 doctor 现由 `src/app/settings.ts` 与 WebUI routes 承载，存活契约以当前实现为准。

## 配置模型（ResolvedConfig）

历史配置由 `host`（github/local）、`url`（raw/jsdelivr/custom）、`scan`（extensions/ignore）、`upload`（concurrency/commitMessage）和 `rewrite.backup` 组成；GitHub 与本地 host 分别配置仓库或根目录/publicBase。解析优先级为 `PICBED_*` ENV > `./picbed.toml` > `./.picbed/config.toml`（从 cwd 向上查找）；token 不进入可序列化配置。当前对应物由 `src/app/settings.ts` 提供。

## F1 项目初始化与配置

历史 CLI 的 `init` 写无 secret 的 `picbed.toml` 模板，`config get|set|list` 由 app 层校验配置键、掩码 secret。当前配置读写契约由 `src/app/settings.ts` 和 WebUI routes 承载；非法配置的历史退出码 2/3 分别表示用法错误/缺鉴权。

## F2 环境与鉴权自检

doctor 语义仍由 app 层与 WebUI `/api/doctor` 承载：github 检查必需配置、token、API 可达性及 Contents 读写权限；local 不要求 token 或 API 探测。历史 github hard failure 退出码 3，在 Web API 中对应信封 `error.code`。

## F10 Agent 机器接口

墓碑：2026-11-10 随 CLI 宿主移除；`--json` 信封语义由 Web API 承载。

## F12 watch 监听

watch API 契约现由 [`module-webui.md`](module-webui.md) 数据契约的路由表承载；历史 `fs.watch` 递归监听以 debounce 合并变更，再触发 sync，可 dry-run，SIGINT/SIGTERM 关闭 watcher。

## F14 VS Code / MCP 包装

墓碑：2026-11-10 随 CLI/MCP 宿主移除（与 features-index F14 墓碑一致）。

## F15 GitHub Token 鉴权

解析顺序契约见 [`cross-cutting.md`](cross-cutting.md#7-github-token-解析顺序)；token 只在内存中使用，诊断与输出必须掩码且不得回显。

## 实现落点（历史）

- 2026-11-10 移除的 `src/cli.ts` 曾导出 `run(argv): Promise<ExitCode>`，负责 argv 分发及退出码映射。
- CLI 的 `emit` / `fail` 输出信封已删除；WebUI 使用自身 envelope。
- `src/app/index.ts` 是应用服务 barrel；`src/types.ts` 保留 WebUI 使用的 `JsonEnvelope` / `EXIT` 类型。
- `loadCfg` 历史上转调 `app/settings.ts#resolvedConfig`。
- 2026-10-27 分层收敛修正 CLI 直连 `./config.js`；历史 layering 守卫曾漏检 `src/` 根文件。

## 功能点映射

| F | 本模块章节 | 状态 |
|---|------------|------|
| [F1](../features-index.md#f1-项目初始化与配置) | §F1 | CLI 面已移除；配置读写经 app 层由设置页使用 |
| [F2](../features-index.md#f2-环境与鉴权自检) | §F2 | doctor 经 `/api/doctor` 存活 |
| [F10](../features-index.md#f10-agent-机器接口) | §F10 | **removed 2026-11-10** |
| [F12](../features-index.md#f12-watch-监听) | §F12 | watch 经 `/api/watch` 存活 |
| [F14](../features-index.md#f14-vs-code--mcp-包装) | §F14 | **removed 2026-11-10** |
| [F15](../features-index.md#f15-github-token-鉴权) | §F15 | token 解析顺序存活（app/auth.ts） |

*规则与数据以本模块为准；验收契约以 features-index AC 为准。*
