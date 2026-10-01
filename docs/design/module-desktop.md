# desktop 模块详细设计

> 归属功能点：F24 桌面应用壳与安装包。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；Web 控制台契约见 [`module-webui.md`](module-webui.md)；全局契约见 [`cross-cutting.md`](cross-cutting.md)。
> 栈相关（Electron + electron-vite），但**业务规则零复制**：只做壳层宿主、原生桥、开发工具链与安装包。
> **UI 单源**：`renderer/`（Vite root）。见下文「渲染层」。

## 目的

desktop 是**桌面应用壳**限界上下文：在保留 npm CLI 本地开发/测试/Agent 通道的同时，为终端用户提供**下载安装即用**的原生窗口应用，并提供接近 Flutter Hot Reload 的本地调试体验。

边界原则：

- **不重写** scan/plan/sync/revert/config/doctor/watch 业务规则；桌面端复用同一 `dist/` 核心与 WebUI 服务（`createUiServer`）。
- **双形态并存**：
  - **npm 形态**（不变）：`picbed` / `picbed-mcp` / `picbed ui`（浏览器打开）。
  - **桌面形态**：Electron 壳加载同一 Web 控制台，配系统对话框与安装包。
- **安全模型继承 WebUI**：服务仍只绑 `127.0.0.1`；token 不进渲染进程、不进页面；写操作仍走 `confirm` 门。
- **Electron 依赖不进 npm 包**：`electron` / `electron-builder` / `electron-vite` / `vite` 仅 devDependencies；`npm pack` 的 `files` 不含 `desktop/`、`renderer/`、`out/`、`release/`。
- 首发平台：**Windows（NSIS `.exe` 安装包）**；macOS/Linux 后续按同一构建矩阵扩展。

## 目录结构（与实现一致）

```text
renderer/                 # UI 单源（Vite root）
  index.html
  styles.css
  main.js
desktop/                  # Electron 壳
  main.mjs                # 主进程：createUiServer + 窗口 + IPC + 生命周期
  preload.cjs             # contextBridge：picbedNative.*
  icon.png
electron.vite.config.mjs  # main / preload / renderer 三段
out/                      # electron-vite build 产物（gitignore）
src/                      # CLI + app 核心 → dist/
scripts/
  desktop-dev.mjs         # 开发 supervisor（tsc -w + electron-vite dev）
  build-desktop.mjs       # NSIS 打包（electron-builder API）
  validate.mjs            # 仓库校验（design/bootstrap/scripts 三个 profile，跨平台）
electron-builder.yml
```

`src/ui/spa/*` 仅保留**薄适配**（从 `renderer/` 读文件 re-export），供测试与 `createUiServer` 兼容；**禁止**再往模板串回灌 UI。

## 渲染层（electron-vite，当前权威）

| 形态 | 渲染层来源 | API | 热更新 |
|------|------------|-----|--------|
| `npm run desktop:dev` | Vite dev server（`ELECTRON_RENDERER_URL`） | 主进程 `createUiServer`；Vite `proxy /api` → `127.0.0.1:4780` | **Vite HMR** |
| 桌面安装包 | `renderer/`（打包进 asar，由 `createUiServer` 静态下发） | 同上，同源 | 无 |
| `picbed ui` 浏览器 | `renderer/` 静态下发 | 同上，同源 | 无（刷新即可） |

契约：

1. `/api/*` 路径、信封、confirm 门、token 掩码 **零变更**。
2. `window.picbedNative` preload 桥不变；无桥时浏览器形态不报错。
3. 打包版不得加载 Vite dev URL（`app.isPackaged` 时强制 `uiHandle.url`）。
4. UI 单源是 `renderer/`；`src/ui/spa` 只读文件转发，不是设计源。

## 领域模型（壳层）

```text
DesktopSession {
  ui: UiServerHandle          # host=127.0.0.1；dev 固定 4780 供 Vite proxy，prod 随机
  window: BrowserWindow
  cwd: string
  lastRoot?: string
}
NativeBridge {
  selectDirectory(): string | null
  selectFiles(filters?): string[]
}
```

## 模块接口（意图）

### Electron 主进程 `desktop/main.mjs`

```
// electron API 必须 createRequire 加载（ESM import 'electron' 在 Electron 33 / Node 20
// 会踩 cjsPreparseModuleExports）；若 ELECTRON_RUN_AS_NODE 泄漏（require 返回路径字符串）则 re-exec。

app.whenReady
  → createUiServer({ cwd }) → listen(port, '127.0.0.1')
       dev (PICBED_DESKTOP_DEV=1): port=4780；否则 port=0
  → 若存在 ELECTRON_RENDERER_URL 且未打包 → loadURL(Vite)
  → 否则 loadURL(uiHandle.url)
  → 注册 IPC：dialog:selectDirectory | dialog:selectFiles | app:info

app.on('window-all-closed') → app.quit()
app.on('before-quit') → uiHandle.close()
```

### Preload 桥 `desktop/preload.cjs`

```
window.picbedNative = {
  selectDirectory(): Promise<string | null>
  selectFiles(opts?: { multi?: boolean, filters?: string[] }): Promise<string[]>
  platform: 'win32' | 'darwin' | 'linux'
}
```

渲染进程约定：有 `picbedNative` 则显示「浏览…」；无则保持拖拽/手输，不报错。

## 本地开发热更新（desktop:dev）

```text
scripts/desktop-dev.mjs（supervisor）
  ├─ tsc -w（CLI/app 核心 → dist/）
  ├─ electron-vite dev --entry desktop/main.mjs
  │     ├─ renderer/*  → Vite HMR
  │     └─ main/preload 变更 → electron-vite 重启 Electron
  └─ 子进程退出 → 退避 respawn（≤5 次）；禁止误杀 tsc/supervisor
```

| 变更 | 行为 | 状态 |
|------|------|------|
| `renderer/*` | Vite HMR | 页面内状态可保留 |
| `desktop/*` | Electron 进程重启 | 丢弃 |
| `src/**` → `dist/` | `tsc -w` 产出；API 热更需重进/重启服务 | 视改动而定 |

### Supervisor 契约（`scripts/desktop-dev.mjs`）

1. 设置 `PICBED_DESKTOP_SUPERVISED=1`、`PICBED_DESKTOP_DEV=1`、`ELECTRON_ENTRY=desktop/main.mjs`。
2. **删除 `ELECTRON_RUN_AS_NODE`**（泄漏会导致 `require('electron')` 变成路径字符串）。
3. 子进程快速失败 → 退避 respawn（300ms×n，上限 2s，最多 5 次）后退出；**禁止**因退出杀掉 `tsc -w`。
4. `SIGINT`/`SIGTERM` → 杀子进程与 tsc → 退出 0。

### 主进程与 Vite HMR（禁止抢窗口）

1. 窗口 URL 优先 `ELECTRON_RENDERER_URL`（Vite）；否则 `uiHandle.url`。
2. **Vite 会话中禁止 `loadURL(uiHandle.url)`**——那会离开 HMR 页，热更新表现为「改了没反应」。
3. `fs.watch` 在 Vite 会话下：`dist/` 变更只**重启 API 服务**（窗口不动）；`desktop/` 交给 electron-vite，不自行 relaunch。
4. 启动日志打印当前 renderer 来源（Vite / 本地 UI 服务），便于排查。

### Electron 入口契约（`desktop/main.mjs`）

1. **入口文件**：`desktop/main.mjs`（`package.json.main` 与 `ELECTRON_ENTRY` 一致）。不用 rollup 打包后的 `out/main`（Electron 33 ESM/CJS 互操作不稳）。
2. **`electron` 模块**：`createRequire` 加载；若返回字符串（`ELECTRON_RUN_AS_NODE`）→ 清 env 后 re-exec 真 Electron。
3. 打包版（`app.isPackaged`）**不**注册任何开发热更新监听、**不**加载 Vite URL。

## 打包与分发

| 通道 | 产物 | 命令 | 消费者 |
|------|------|------|--------|
| npm / Release tarball | `picbed.tgz` | `npm pack` | 开发者、CLI/Agent、`picbed ui` |
| 桌面安装包 | `picbed-setup-<ver>.exe` + 稳定名 `picbed-setup.exe` | `npm run desktop:dist` | 终端用户 |

`desktop:dist` = `tsc` + `electron-vite build` + electron-builder；`desktop:bundle` = 只做前两步（不出安装包，命名据此澄清）。`desktop:dev` = `tsc` 一次 + supervisor（`tsc -w` + `electron-vite dev`），supervisor 内**不再**重复全量编译。

electron-builder 要点：

- `appId`: `com.aermberry.picbed` · `productName`: `picbed`
- `extraMetadata.main`: `desktop/main.mjs`
- `directories.output`: `release/`
- `files`: `dist/**`、`desktop/**`、`renderer/**`、`out/**`、`package.json`（**不含** `src/`、`tests/`、`docs/`）
- `win.target`: `nsis`；`artifactName`: `picbed-setup-${version}.${ext}`
- NSIS：`oneClick: true`，`perMachine: false`（用户级，免管理员）
- 无签名证书阶段：允许未签名；SmartScreen 提示属预期

## F24 桌面应用壳与安装包

- 输入：桌面应用启动（开始菜单 / 快捷方式 / `.exe`）。
- 规则：
  1. 启动后进入**完整 Web 控制台**（F16–F23 四视图），无需打开系统浏览器。
  2. UI 服务绑定 `127.0.0.1`；关闭窗口时释放端口并退出 watch。
  3. **原生目录选择**：提供「浏览…」调用系统对话框（策略 A 不变）。
  4. **窗口状态记忆**：尺寸/位置写 `app.getPath('userData')`。
  5. **Token 纪律不变**：渲染进程无法读取 token 明文。
  6. **npm 包不含 Electron/desktop/renderer**。
  7. 安装包可在无 Node.js 的 Windows 上运行。
- 失败：
  - UI 服务起不来 → 窗口错误态（端口/依赖），不白屏。
  - 对话框取消 → 返回 `null`/空数组，不改变当前 root。
  - `desktop:dist` 前置构建失败即中止。

## 与 webui 的协作

| 能力 | webui（F16–F23） | desktop（F24） |
|------|------------------|----------------|
| HTTP API / confirm / 掩码 | 实现 | 复用，不改契约 |
| UI 渲染层 | `renderer/` 单源 | 同一 `renderer/`（Vite HMR / 静态下发） |
| 路径获取 | 拖拽 + 手输（策略 A） | 增加原生目录对话框（可选桥） |
| 进程宿主 | `picbed ui`（Node） | Electron main |
| 分发 | npm / tarball | Windows 安装包 |

## 失败语义

| 情况 | 行为 |
|------|------|
| 端口占用（dev 默认 4780） | 报错并退出/窗口错误态；可改 `PICBED_UI_PORT` |
| `dist/` 或 `renderer/` 未就绪 | `desktop:dev` / `desktop:dist` 报错退出，不静默空窗 |
| 对话框取消 | 无路径变更 |
| 无 `picbed.toml` | 与 CLI/`picbed ui` 一致：引导 `init` 或设置页 |
| SmartScreen 拦截未签名安装包 | 文档说明 |
| `ELECTRON_RUN_AS_NODE` 泄漏 | 主进程 re-exec 真 Electron，不崩 |

## 历史决策（只读）

| 日期 | 决策 | 后续 |
|------|------|------|
| 2026-09-26 | F24：Electron + NSIS + 原生对话框 | 仍有效 |
| 2026-09-27 | 分层 `fs.watch` 热更新（reload / 重启 UI / relaunch） | **已被 electron-vite 取代**；仅作无 Vite 回退思路 |
| 2026-09-27 | SPA 出模板串 → `src/ui/spa/` TS 模块（见 [`module-webui-spa-split.md`](module-webui-spa-split.md)） | **已被 `renderer/` 单源取代** |
| 2026-09-27 | 迁移 electron-vite；入口 `desktop/main.mjs`；`createRequire` + `RUN_AS_NODE` re-exec | **当前权威** |

## 功能点映射

| F | 本模块章节 |
|---|------------|
| [F24](../features-index.md#f24-桌面应用壳与安装包) | §F24 |

*规则与数据以本模块为准；验收契约以 features-index AC 为准；HTTP/确认/掩码契约以 module-webui 与 cross-cutting 为准；业务不变量以 ingest/transfer/rewrite/cliops 为准。*
