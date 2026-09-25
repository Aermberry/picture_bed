# desktop 模块详细设计

> 归属功能点：F24 桌面应用壳与安装包。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；Web 控制台契约见 [`module-webui.md`](module-webui.md)；全局契约见 [`cross-cutting.md`](cross-cutting.md)。
> 栈相关（Electron），但**业务规则零复制**：只做壳层宿主、原生桥与安装包。

## 目的

desktop 是**桌面应用壳**限界上下文：在保留 npm CLI 本地开发/测试/Agent 通道的同时，为终端用户提供**下载安装即用**的原生窗口应用。

边界原则：

- **不重写** scan/plan/sync/revert/config/doctor/watch 业务规则；桌面端复用同一 `dist/` 核心与 WebUI 服务（`createUiServer`）。
- **双形态并存**：
  - **npm 形态**（不变）：`picbed` / `picbed-mcp` / `picbed ui`（浏览器打开）。
  - **桌面形态**（新增）：Electron 壳加载同一 Web 控制台，配系统对话框与安装包。
- **安全模型继承 WebUI**：服务仍只绑 `127.0.0.1`；token 不进渲染进程、不进页面；写操作仍走 `confirm` 门。
- **Electron 依赖不进 npm 包**：`electron` / `electron-builder` 仅 devDependencies；`npm pack` 的 `files` 不含 `desktop/`、`release/`。
- 首发平台：**Windows（NSIS `.exe` 安装包）**；macOS/Linux 后续按同一构建矩阵扩展。

## 模块文件夹结构

```
desktop/
├─ main.mjs          # Electron 主进程：起 UI 服务、开窗、菜单、生命周期
├─ preload.mjs       # contextBridge：picbedNative.*（目录/文件对话框、窗口信息）
├─ icon.png          # 应用图标（打包资源）
└─ (无业务逻辑；调用 ../dist 的 createUiServer)
```

根目录构建配置：

```
electron-builder.yml   # win nsis、artifactName、files 白名单
```

## 领域模型（壳层）

```text
DesktopSession {
  ui: UiServerHandle          # 复用 webui：host=127.0.0.1, port=随机/可配
  window: BrowserWindow
  cwd: string                 # 工作目录（影响 picbed.toml / .picbed 解析）
  lastRoot?: string           # 记忆上次扫描根（可选）
}
NativeBridge {
  selectDirectory(): string | null
  selectFiles(filters?): string[]
  getWindowState() / setWindowState(bounds)
}
```

## 模块接口（意图）

### Electron 主进程 `desktop/main.mjs`

```
app.whenReady
  → createUiServer({ cwd, host: '127.0.0.1', port: 0 })  # 0=随机空闲端口
  → BrowserWindow.loadURL(uiHandle.url)
  → 注册 IPC：dialog:selectDirectory | dialog:selectFiles | window:state

app.on('window-all-closed') → app.quit()   # 与多数 Windows 应用一致
app.on('before-quit') → uiHandle.close()   # 端口释放；级联停 watch
```

### Preload 桥 `desktop/preload.mjs`

```
window.picbedNative = {
  selectDirectory(): Promise<string | null>
  selectFiles(opts?: { multi?: boolean, filters?: string[] }): Promise<string[]>
  platform: 'win32' | 'darwin' | 'linux'
}
```

渲染进程约定（WebUI 渐进增强，**不破坏**浏览器形态）：

- 若 `window.picbedNative` 存在 → 路径输入旁显示「浏览…」按钮，调用原生目录选择。
- 若不存在（浏览器 `picbed ui`）→ 保持既有拖拽/手输路径 UX，不报错。

### 打包与分发

| 通道 | 产物 | 命令 | 消费者 |
|------|------|------|--------|
| npm / Release tarball | `picbed.tgz` | `npm pack`（现有） | 开发者、CLI/Agent、`picbed ui` |
| 桌面安装包 | `picbed-setup-<ver>.exe` + 稳定名 `picbed-setup.exe` | `npm run desktop:dist` | 终端用户 |

electron-builder 要点：

- `appId`: `com.aermberry.picbed`
- `productName`: `picbed`
- `directories.output`: `release/`
- `files`: `dist/**`、`desktop/**`、`package.json`（**不含** `src/`、`tests/`、`docs/`、`node_modules` 中无关包）
- `win.target`: `nsis`；`artifactName`: `picbed-setup-${version}.${ext}`
- NSIS：`oneClick: true`，`perMachine: false`（用户级安装，免管理员）
- 无签名证书阶段：允许未签名安装包；文档注明 SmartScreen 提示属预期

## F24 桌面应用壳与安装包

- 输入：桌面应用启动（开始菜单 / 快捷方式 / `.exe`）。
- 规则：
  1. 启动后进入**完整 Web 控制台**（F16–F23 四视图），无需打开系统浏览器。
  2. UI 服务绑定 `127.0.0.1`，端口随机；关闭窗口时释放端口并退出 watch。
  3. **原生目录选择**：桌面端提供「浏览…」调用系统对话框；选中路径写入 root（策略 A 不变）。
  4. **窗口状态记忆**：窗口尺寸/位置在下次启动恢复（写 `app.getPath('userData')`）。
  5. **工作目录**：默认 `process.cwd()` / 用户上次目录；可用对话框切换（影响 `picbed.toml` 发现）。
  6. **Token 纪律不变**：渲染进程无法读取 token 明文；配置页掩码与 F20 一致。
  7. **npm 包不含 Electron**：`npm i -g picbed` 体积与依赖树不因桌面壳膨胀。
  8. 安装包可在无 Node.js 环境的 Windows 上运行（Electron 内嵌运行时）。
- 失败：
  - UI 服务起不来 → 桌面窗口显示错误态（端口/依赖），不白屏。
  - 对话框取消 → 返回 `null`/空数组，不改变当前 root。
  - 打包缺文件（dist/未构建）→ `desktop:dist` 前置 `npm run build` 失败即中止。

## 与 webui 的协作

| 能力 | webui（F16–F23） | desktop（F24） |
|------|------------------|----------------|
| HTTP API / confirm / 掩码 | 实现 | 复用，不改契约 |
| 静态 SPA 四视图 | 实现 | 加载同一 `INDEX_HTML` |
| 路径获取 | 拖拽 + 手输（策略 A） | 增加原生目录对话框（可选桥） |
| 进程宿主 | `picbed ui`（Node） | Electron main |
| 分发 | npm / tarball | Windows 安装包 |

## 失败语义

| 情况 | 行为 |
|------|------|
| 端口占用（随机端口极少见） | 重试若干次；仍失败则窗口错误态 + 可诊断信息 |
| `dist/` 未构建 | `desktop:dev` / `desktop:dist` 报错退出，不静默空窗 |
| 对话框取消 | 无路径变更 |
| 用户目录无 `picbed.toml` | 与 CLI/`picbed ui` 一致：引导 `init` 或设置页配置 |
| SmartScreen 拦截未签名安装包 | 文档说明；不引入自定义驱动 |

## 功能点映射

| F | 本模块章节 |
|---|------------|
| [F24](../features-index.md#f24-桌面应用壳与安装包) | §F24 |

*规则与数据以本模块为准；验收契约以 features-index AC 为准；HTTP/确认/掩码契约以 module-webui 与 cross-cutting 为准；业务不变量以 ingest/transfer/rewrite/cliops 为准。*
