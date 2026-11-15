# desktop 模块详细设计

> 归属功能点：F24 桌面应用壳与安装包。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；Web 控制台契约见 [`module-webui.md`](module-webui.md)；全局契约见 [`cross-cutting.md`](cross-cutting.md)。
> Electron 仅提供壳层宿主、原生桥、开发工具链与安装包；业务规则复用核心及 WebUI 服务。UI 单源为 `renderer/`。

## 目的

desktop 是桌面应用壳限界上下文：为终端用户提供下载安装即用的原生窗口应用及本地调试体验。

- 不复制 scan/plan/sync/revert/config/doctor/watch 业务规则；复用 `dist/` 核心与 `createUiServer`。
- Electron 加载 Web 控制台，辅以系统对话框和安装包；仅保留桌面宿主形态。
- UI 服务只绑定 `127.0.0.1`；token 不进入渲染进程或页面，写操作仍经过 `confirm` 门。
- Electron / electron-builder / electron-vite / Vite 仅为 devDependencies。
- 首发为 Windows NSIS `.exe`；macOS/Linux 可按同一构建矩阵扩展。

实现文件：`desktop/icon.png`、`desktop/main.mjs`、`desktop/make-icon.py`、`desktop/preload.cjs`（`src/desktop` 无跟踪文件）。

## 渲染层（electron-vite，当前权威）

| 形态 | 渲染层 / API | 热更新 |
|------|--------------|--------|
| `npm run desktop:dev` | Vite dev server（`ELECTRON_RENDERER_URL`）；主进程 `createUiServer`，Vite `/api` 代理至 `127.0.0.1:4780` | Vite HMR |
| 安装包 | `renderer/` 打包进 asar，由 `createUiServer` 同源静态下发 | 无 |

- `/api/*`、信封、`confirm` 门及 token 掩码契约不变；`window.picbedNative` 为可选渐进增强桥。
- 打包态强制加载 `uiHandle.url`，不得加载 Vite dev URL。
- `renderer/` 是唯一 UI 源；`src/ui/spa` 仅作兼容转发，不回灌模板串。

## 领域模型（壳层）

```text
DesktopSession { ui: UiServerHandle, window: BrowserWindow, cwd: string, lastRoot?: string }
NativeBridge { selectDirectory(): string | null, selectFiles(): string[] }
```

`UiServerHandle` 绑定 `127.0.0.1`：开发态默认端口 `4780`，生产态随机端口；`close()` 随窗口退出释放服务。

## 模块接口（意图）

- `desktop/main.mjs`：`app.whenReady()` 后启动 `createUiServer({ cwd })`、创建窗口并注册 `dialog:selectDirectory`、`dialog:selectFiles`、`app:info` IPC；退出前关闭 UI 服务。
- Preload 通过 `contextBridge` 暴露 `window.picbedNative`：目录/文件选择、平台信息；取消返回 `null` 或空数组。
- Electron API 使用 `createRequire`；若 `ELECTRON_RUN_AS_NODE` 泄漏导致 `require('electron')` 返回路径字符串，清除变量并 re-exec。
- 有原生桥时显示「浏览…」；无桥时保留拖拽/手输，不报错。

## 本地开发热更新（desktop:dev）

命令：`npm run desktop:dev`；supervisor 运行 `tsc -w` 与 `electron-vite dev --entry desktop/main.mjs`。全量编译仅在启动前执行一次。

- 环境开关：`PICBED_DESKTOP_SUPERVISED=1`、`PICBED_DESKTOP_DEV=1`、`ELECTRON_ENTRY=desktop/main.mjs`；清除泄漏的 `ELECTRON_RUN_AS_NODE`。
- Renderer 由 Vite HMR 更新；main/preload 变更由 electron-vite 重启 Electron；`dist/` 变更触发进程级重启，清空 Node ESM 模块缓存。
- Vite 会话中禁止 `loadURL(uiHandle.url)`——那会离开 HMR 页，热更新表现为「改了没反应」（main.mjs 在 rendererDevUrl 存在时提前 return，不落 uiHandle.url）。
- 默认 UI 端口 `4780`；端口占用报错退出，可用 `PICBED_UI_PORT` 调整。打包态不安装热更新监听。
- 子进程快速失败时按 300ms×n（上限 2s）退避，最多重启 5 次；不得误杀 `tsc -w`。SIGINT/SIGTERM 清理子进程并退出。
- `out/` 为 electron-vite 构建产物；不使用打包后的 `out/main` 作为 Electron 入口。

## 打包与分发

| 命令 | 用途 | 产物 |
|------|------|------|
| `npm run desktop:bundle` | `tsc` + `electron-vite build` | `dist/`、`out/` |
| `npm run desktop:dist` | 构建并由 electron-builder 制作 NSIS 安装包 | `release/picbed-setup-<version>.exe` 及稳定名 `release/picbed-setup.exe` |

electron-builder 要点：`appId=com.aermberry.picbed`、`productName=picbed`、入口 `desktop/main.mjs`、输出目录 `release/`；打包包含 `dist/**`、`desktop/**`、`renderer/**`、`out/**`、`package.json`，不含 `src/`、`tests/`、`docs/`。Windows 使用 NSIS、单击安装、用户级（`oneClick: true`、`perMachine: false`）；无签名证书时允许未签名，SmartScreen 提示属预期。

npm 发布已移除；`package.json` 的 `files` / `exports` 和 `validate:pack` 仅作为包面审计守卫保留，不构成发布通道。

## F24 桌面应用壳与安装包

- 输入：从开始菜单、快捷方式或 `.exe` 启动桌面应用。
- 启动进入完整 Web 控制台（F16–F25），无需另开浏览器；关闭窗口时释放端口并退出。
- 原生目录选择调用系统对话框；窗口尺寸/位置写入 `app.getPath('userData')`。
- 渲染进程不可读 token 明文；安装包可在无 Node.js 的 Windows 上运行。
- UI 服务启动失败进入可见错误态，不得白屏；对话框取消不改变当前 root；`desktop:dist` 前置构建失败即中止。

## 与 webui 的协作

| 能力 | webui（F16–F25） | desktop（F24） |
|------|------------------|----------------|
| HTTP API / confirm / 掩码 | 实现 | 复用，不改契约 |
| UI 渲染层 | `renderer/` 单源 | 同一 `renderer/`（Vite HMR / 静态下发） |
| 路径获取 | 拖拽 + 手输（策略 A） | 增加原生目录对话框（可选桥） |
| 进程宿主 | Electron main（内嵌同一 Node 进程） | Electron main |
| 分发 | 随桌面包 | Windows 安装包 |

## 失败语义

| 情况 | 行为 |
|------|------|
| 端口占用（dev 默认 4780） | 报错并退出/窗口错误态；可改 `PICBED_UI_PORT` |
| `dist/` 或 `renderer/` 未就绪 | `desktop:dev` / `desktop:dist` 报错退出，不静默空窗 |
| 对话框取消 | 无路径变更 |
| 无 `picbed.toml` | 引导配置模板或设置页 |
| SmartScreen 拦截未签名安装包 | 文档说明 |
| `ELECTRON_RUN_AS_NODE` 泄漏 | 主进程 re-exec 真 Electron，不崩 |

## 历史决策（只读）

| 日期 | 决策 | 后续 |
|------|------|------|
| 2026-09-26 | F24：Electron + NSIS + 原生对话框 | 仍有效 |
| 2026-09-27 | 分层 `fs.watch` 热更新（reload / 重启 UI / relaunch） | **已被 electron-vite 取代**；仅作无 Vite 回退思路 |
| 2026-09-27 | SPA 出模板串 → `src/ui/spa/` TS 模块（见 [`module-webui-spa-split.md`](archive/module-webui-spa-split.md)） | **已被 `renderer/` 单源取代** |
| 2026-09-27 | 迁移 electron-vite；入口 `desktop/main.mjs`；`createRequire` + `RUN_AS_NODE` re-exec | **当前权威** |

实现落点（TS/Electron 适配）：`desktop/main.mjs`、`desktop/preload.cjs`、`electron.vite.config.mjs`、`src/ui/server.ts`；业务服务与路由见 `src/ui/**`。

## 功能点映射

| F | 本模块章节 |
|---|------------|
| [F24](../features-index.md#f24-桌面应用壳与安装包) | §F24 |

*规则与数据以本模块为准；验收契约以 features-index AC 为准；HTTP/确认/掩码契约以 module-webui 与 cross-cutting 为准；业务不变量以 ingest/transfer/rewrite/cliops 为准。*
