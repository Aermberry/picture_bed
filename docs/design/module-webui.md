# webui 模块详细设计

> 归属功能点：F16 本地 Web 控制台服务、F17 目录/拖拽与计划工作台、F18 一键同步、F19 回滚面板、F20 配置与自检面板、F21 审计与报告、F22 监听控制台、F23 控制台壳层与视觉重设计。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；全局契约见 [`cross-cutting.md`](cross-cutting.md)。
> 壳层布局与主题令牌见 [`wireframes/ui-shell.md`](wireframes/ui-shell.md)（F23 视格权威）。
> 栈无关；接口为意图伪码。**本期只设计，不实现业务/UI 代码。**

## 目的

webui 是**本地 Web 控制台**限界上下文：在**仅本机**的 HTTP 界面上，把已有的 scan/plan/sync/revert/config/doctor/watch 能力暴露给人操作，降低 CLI 使用门槛。Agent 契约仍在 CLI（F10）；本模块是**第二呈现层**，不替代 CLI。

边界原则：
- **不重写**抽取/上传/回写/去重业务规则（属 ingest/transfer/rewrite/cliops）；只做会话编排、HTTP API、静态资源与确认门。
- **Token 仅存在于服务进程内存**；HTTP 响应、页面、run 记录、日志一律掩码或省略。
- **默认只绑 `127.0.0.1`**；不做多用户、不做公网部署、不做反向代理鉴权。
- 写操作（sync / revert / config set / watch 自动同步）必须经**显式确认**（页面确认 + 服务端 `confirm`）。
- 对外门面：`WebUiFacade`；对内复用既有应用服务/CLI 契约 DTO。

## 模块文件夹结构（栈无关）

```
webui/
├─ domain/
│  ├─ cqe/           # ServeUiQuery、PlanViewQuery、SyncConfirmCommand、RevertConfirmCommand…
│  ├─ entity/        # UiSession、RunRecord、PlanView、DoctorView、ManifestView
│  ├─ service/       # UiServer、RunRecorder、ConfirmGate、ViewMapper
│  └─ facade/        # WebUiFacade
├─ packages/
│  ├─ http/          # 路由、静态资源、localhost 绑定、优雅退出
│  └─ presenters/    # API JSON / 页面视图模型（不承载业务规则）
├─ exceptions/       # PortInUseError、ConfirmRequiredError、UiHostError
└─ (无 host / 无 rewrite 写盘实现——经应用服务调用)
```

## 领域模型

```text
UiSession   { rootDir, startedAt, watchActive }
RunRecord   { id, command, startedAt, finishedAt, ok, counts, items[], errorCode? }
PlanView    { rootDir, generatedAt, groups: { upload[], skip-cache[], skip-remote[], blocked[] } }
DoctorView  { ok, checks[], failures[] }
ManifestView{ version, entries[] }   # 无 token
```

## 模块接口（意图）

```
WebUiFacade
  startUi(opts: { host?, port?, open? }): UiServerHandle   # CLI 入口 `picbed ui`（已冻结命令名）
  # HTTP 映射（信封同 cross-cutting JSON，command 为 api.*）
  # GET  /api/health
  # GET  /api/config          # token 掩码
  # PUT  /api/config          # 非 secret 键；需 confirm
  # POST /api/doctor
  # POST /api/scan            { root }
  # POST /api/plan            { root }
  # POST /api/sync            { root, confirm: true, dryRun? }
  # GET  /api/manifest
  # POST /api/revert          { root, confirm: true, dryRun? }
  # GET  /api/runs            # F21
  # GET  /api/runs/:id
  # POST /api/watch/start     { root, debounceMs?, autoSync? }  # autoSync 仍要 confirm 策略
  # POST /api/watch/stop
  # GET  /api/events          # SSE/长轮询：watch 与 sync 进度（实现可选）
```

`ViewMapper` 把应用结果 DTO 映射为视图模型；**禁止**在 mapper 中改变 action 分类或退出码语义。

### 上传页布局（2026-09-26 收窄 + 扫描预览）

`#/upload` **仅保留 DropZone**。移除：扫描目录卡片、工作集表、scan/plan/sync 按钮组、计划分组表、结果 `<pre>`。

状态流：

```
idle（拖放提示）
  → drop → session/drop + plan/scan
  → scanned（图片缩略图 +「上传」「重置」）
       ├─ 上传 → confirm → POST /api/sync → 完成回 idle
       └─ 重置 → POST /api/session/reset → 回 idle
```

- 预览：`GET /api/preview?path=` 仅允许扫描根内图片扩展名；预览不上传。
- 「上传」= 原 sync（`confirm: true`）；「重置」丢弃本次扫描，不写文档、不传图床。

静态 SPA 视图（hash 或 JS 切换）：

```
#/upload    # 默认：文件放置 DropZone + root + 工作集 + plan/sync
#/manage    # 统计 + manifest 网格 + 回滚 + 审计 + 监听
#/settings  # 配置 + doctor + 偏好 Toggle
#/doc       # 设计规范（令牌/Logo/图标）
```

- 侧栏固定四文案：**上传 / 管理 / 设置 / 规范**（用户 UI 方案；缺一不可达）。
- 主题「晨雾蓝 × 落日暖」令牌、组件、Logo 动效以 [`wireframes/ui-shell.md`](wireframes/ui-shell.md) + 用户《设计交付规范》为准。
- 壳层组件只消费既有 `/api/*`；禁止为布局新造与信封冲突的私有字段。

### 桌面原生桥（F24 渐进增强，不改 HTTP 契约）

WebUI SPA **同时**服务浏览器（`picbed ui`）与 Electron 壳（[`module-desktop.md`](module-desktop.md)）：

- 若 `window.picbedNative` 存在（preload 注入）：root/工作目录输入旁提供「浏览…」，调用 `picbedNative.selectDirectory()`；取消不改 root。
- 若不存在：保持拖拽 + 手输路径，**禁止**因缺桥而报错或隐藏主流程。
- 桥只返回路径字符串；解析、越界校验、策略 A 仍由服务端 RootBinder 负责。

### 「规范」视图可见性（调试门，不改 HTTP 契约）

侧栏第四项**「规范」**（设计令牌/Logo 页）**仅本地调试显示**：

| 场景 | 显示？ | 判定 |
|------|--------|------|
| 源码树 `picbed ui` / `npm run desktop:dev` | 是 | 包根存在 `src/ui/static.ts`，或 Electron `!app.isPackaged` |
| `PICBED_UI_DEV=1` | 是 | 环境变量强制开 |
| `npm i -g picbed` / `picbed-setup.exe` | **否** | 无 `src/`；打包 `app.isPackaged` |
| `PICBED_UI_DEV=0` | **否** | 环境变量强制关（优先于自动探测） |

服务端在 HTML 注入 `window.__PICBED_UI_DEV__`；SPA **默认隐藏**该 nav，仅标志为 true 时移除 `hidden`。发包版不得通过 UI 进入规范页。

## F16 本地 Web 控制台服务

- 输入：`--host`（默认 `127.0.0.1`）、`--port`（默认可配，如 4780）、`--open`（可选打开浏览器）。
- 规则：
  - 默认拒绝绑定非回环地址；显式 `--host 0.0.0.0` 时打印安全告警并继续（文档层允许，实现须告警）。
  - 端口占用 → 退出码 2，消息含端口。
  - 健康检查 `GET /api/health` → `{ schemaVersion, ok:true, command:"api.health" }`。
  - 退出：SIGINT/SIGTERM → 关闭 HTTP 与 watch → 进程 0。
- 失败：无法绑定、静态资源缺失 → 退出码 2/1，不静默空页。

## F17 目录/拖拽与计划工作台

### 输入方式

1. **拖拽导入**（主交互，2026-09-26 用户确认）：用户**只需拖拽** md/html 文档或文件夹，**不要求**先手动「绑定 root / 策略 A」。
   - **拖入文件夹** → 自动设为扫描根 `root`（覆盖/更新当前根）。
   - **拖入文档** → 自动推断 root（文档所在目录，或沿用已推断根），加入工作集；解析失败 → `blocked` + reason。
   - **混合拖入**：文件夹优先定根，文档落在根下则进工作集，否则 `blocked`。
   - **路径来源**：桌面端（`picbedNative.getPathForFile`）取**绝对路径**；浏览器无绝对路径时退化为「文件夹名 + 相对线索」，仅当能在服务端解析时成功。
   - 拖拽区文案不出现「策略 A / 强制绑根」；界面展示推断后的 root 状态即可。
2. **路径指定**（次要/兜底）：root 表单；桌面端可「浏览…」。浏览器拖不到真实路径时才需要。
3. **不提供**：「选择文件」按钮、「粘贴剪贴板」按钮。
4. **无暂存预览**：不得仅用浏览器文件字节做 plan；sync/revert 仍要求服务端可解析真实路径。

### 路径落地（本地 Web 的安全模型）

浏览器拖拽通常**不能**直接给出绝对路径。设计约定：

- **服务端始终持有真实 FS 路径**；页面只提交相对线索（`name` / `webkitRelativePath` / 句柄元数据）。
- **默认且唯一策略 A（根绑定 + 相对路径解析，已冻结）**：用户必须先绑定 `root`（路径表单或服务端目录浏览 API）；拖拽项在 `root` 下按相对路径解析。解析失败/越界/不在根内 → `blocked` + reason（不可静默忽略）。**策略 B（暂存预览）不纳入本期**。
- 图片资产本身不拖拽上传为图床对象（属 transfer 业务）；工作台拖拽对象是**文档/目录**。

### 规则与失败

- `scan`/`plan` 只读；视图分组与 F6 分类一一对应；`blocked` 展示 reason 与 path。
- 工作集变更（拖入/移出）只影响本次会话视图，不写配置文件。
- 失败：root 不存在/越界 → 退出码 4 语义的 API 错误；单文档问题进 warnings。

## F18 一键同步

- 输入：`root`、`confirm: true`（缺省 → `ConfirmRequiredError`，HTTP 409 或信封 error，对齐退出码 7）、可选 `dryRun`。
- 规则：
  - `dryRun` 等价 `plan`/`sync --dry-run`：不 `putFile`、不改文档。
  - 非 dry-run：经 SyncOrchestrator；进度经事件通道推送（若启用）。
  - 结果 counts：`uploaded/rewritten/skipped/blocked/failed`；partial → `ok:false` 或 `ok:true`+`data.partial`（与 CLI 退出码 6 对齐，信封 error.code 保持稳定）。
- 失败：单文件失败隔离；汇总 partial；远端 429/403 退避后失败映射退出码 5 语义。

## F19 回滚面板

- 输入：`root`、`confirm`、`dryRun`。
- 规则：列表读 manifest；dry-run 只报告将还原 entry；confirm 后 revert（写文档走 rewrite 门面）。
- 失败：`ManifestCorruptError` → 界面错误；不自动 `--force-new-manifest`。

## F20 配置与自检面板

- 读：`ResolvedConfig` 序列化视图，**token 键显示为掩码**（如 `****`），不提供「显示原文」。
- 写：仅非 secret 键；枚举校验同 F1；`confirm` 才落盘。
- doctor：调用 DoctorService；视图展示 `checks[]/failures[]`；缺 token 时 hint 展开 PAT / `gh auth` 说明（同 F15）。
- 失败：非法键/枚举 → 退出码 2 语义；鉴权类失败 → 退出码 3 语义。

## F21 审计与报告

- RunRecord 由各写/批命令成功或结束后追加（存储建议 `./.picbed/runs/`，路径进 `.gitignore` 建议）。
- 报告字段对齐 JSON 信封 `data`；**无 token**。
- 导出：`GET /api/runs/:id` 或导出按钮得到单一 JSON。

## F22 监听控制台

- 启停映射 F12：`fs.watch` + debounce；忽略 `node_modules`/`.git`/`.picbed`。
- 模式：`preview`（**默认，已冻结**：只 plan）| `confirm-each`（每批确认后 sync）| `auto`（**须显式打开**；仍写 RunRecord）。
- 停止：`watch/stop` 或 `ui` 服务退出时级联停止。
- 失败：监听失败 → 错误可见；不引入系统服务/提权。

## F23 Web 控制台壳层与视觉重设计

- **范围**：仅呈现层（布局、导航、主题、文案层级）；**不改** API、JSON 信封、`confirm` 门、token 纪律、拖拽策略 A。
- **壳层**：72px 侧栏 + 56px 顶栏 + 可滚动 Content（min-width 860）。
- **导航**：四视图「上传 / 管理 / 设置 / 规范」。默认上传/文件放置。
- **信息重排**：F17/F18 上传视图；F19/F21/F22 管理视图；F20 设置视图；规范页只读设计系统。
- **主题**：晨雾蓝 × 落日暖（`#4E86AD` / `#E39A6B` / `#F3F7FA`…）；禁止各面板私自改色；Toggle 36×20 且 `flex-shrink:0`。
- **Logo**：44×44 squircle，idle/scanning/uploading 三态；规范页可切 V1–V3。
- **失败**：壳层加载 API 失败时主区可见错误条，不白屏；静态资源缺失仍走 F16 失败语义。

## 失败语义

| 情况 | 行为 |
|------|------|
| 未带 `confirm` 的写操作 | 拒绝；error.code 对齐需确认（7） |
| token 缺失 | 读接口可展示 doctor 失败；写/上传类失败（3） |
| root 越界/绝对路径拒绝 | 本地文件错误（4） |
| 远端 API/限流 | 远端错误（5）；批量 partial（6） |
| 端口占用 | 用法/环境（2） |
| manifest 损坏 | 显式错误；不静默重建 |

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

*规则与数据以本模块为准；验收契约以 features-index AC 为准；视觉与布局以 wireframes/ui-shell.md 为准；业务不变量以 ingest/transfer/rewrite/cliops 为准。*
