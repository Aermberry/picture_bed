# Web 控制台壳层与视觉规格（F23）

> 归属功能点：[F23 Web 控制台壳层与视觉重设计](../../features-index.md#f23-web-控制台壳层与视觉重设计)
> 模块：[`module-webui.md`](../module-webui.md) · 全局契约：[`cross-cutting.md`](../cross-cutting.md)
> **视觉权威**：用户交付《图床工具-UI方案.html》+《图床工具-设计交付规范.md》（主题「晨雾蓝 × 落日暖」）；本文件记录 picbed 落地映射。桌面 Web 基线 `1440×900`，最小宽度 `860px`。

## 1. 信息架构（四视图，侧栏全可达）

```text
App (flex, height 100vh)
├── Sidebar 72px（窄屏 56px）
│   ├── Logo 44×44
│   ├── NavItem ×5：上传 / 统计 / 图库 / 设置 / 规范（仅调试显示）
│   └── Avatar 36×36（占位）
└── Main (flex:1)
    ├── Topbar 56px
    └── Content padding 24px，可滚动
```

| 视图 | 侧栏 / 顶栏文案 | 承载 F / 能力 |
|------|-----------------|---------------|
| 上传 | 上传 / 文件放置 · 拖入文件即可上传 | F17 工作集、F18 同步 |
| 统计 | 统计 / 使用统计 · 图床用量 · 每日 · 时段 | F25 总计、KPI、热力图、时段 |
| 图库 | 图库 / 浏览仓库 | 文件夹树、GitHub 仓库图片墙 |
| 设置 | 设置 / 图床配置 | F20 配置 / doctor |
| 规范 | 规范 / 设计规范 · 令牌 · 组件 · 原型连线 | 设计系统说明（内部页） |

五项均须有侧栏入口；导航文案固定为「上传 / 统计 / 图库 / 设置 / 规范」。

### 1.1 上传视图（默认）

- 空态为 DropZone 英雄区（最小高度 420px），接受图片或 md/html 文档，不接受文件夹。
- 有扫描结果时显示照片墙：扫描数量、重置/上传操作，Material Tailwind Masonry 瀑布流 2/3/4 列、间距 6（与 renderer/styles.css `.photo-wall` 的 gap:6px 一致）；图块满宽、保留自然宽高比、圆角 16，hover 显示文件名。可继续拖入。
- 已移除根绑定行、工作集、scan 按钮组及计划分组表。

### 1.2 统计视图（F25）

- 工具栏显示来源提示；有 warning 时展示首条，tooltip 列出全部，并提供刷新。
- 总计卡展示成功上传次数与估算口径；`partial` 标注记录不完整，`unavailable` 显示 `—` 和暂无记录，不以 0 冒充真实值。
- KPI：今天、过去 7 天及环比、连续天数及最长记录、最忙的一天及数量。
- 每日热力图覆盖过去一年（53×7），5 档顺序色阶、固定阈值、月标签防挤压及单格 tooltip；窄容器横向滚动。
- 24 小时柱图展示峰值时段及 tooltip，刻度为 0/6/12/18。原 manifest 网格、搜索、排序、批量复制外链已移除；图库视图不受影响。

### 1.3 设置视图

- 配置卡依次呈现仓库信息、认证凭据、操作区和操作输出。`github.dir` 只读，通过目录选择浮层点选或新建后回填；浮层支持路径面包屑、上级/刷新、文件夹列表、错误提示与选用/新建操作。
- Token 粘贴 PAT 后保存到 `~/.picbed/credentials.json`，页面掩码显示，不写入 `picbed.toml`；提供配置状态、动态认证提示及 GitHub 网页登录。
- 提供读取/保存配置、导出/导入 `picbed.toml`；结果显示在有标题的输出面板，token 掩码。
- 外观主题即时切换并由 localStorage 记忆；doctor 与上传偏好不在 UI 中。

### 1.4 规范视图

展示色板、文字、间距、图标、Logo 三态及组件说明；支持预览 Logo 配色。

## 2. 设计令牌（京阿尼柔光 · 三主题 · 禁止散色）

色调法：去浊提纯、彩度阴影、高光留白、空气透视与彩色柔影。颜色统一走 CSS 变量；`body[data-theme]` 整体换肤（`""` / `klein` / `cream`）。

### 2.1 默认 · 晴空蓝 × 夕照金

| Token | 色值 | 用途 |
|-------|------|------|
| `--c-primary` | `#4E93C0` | 主按钮、导航选中、Tag |
| `--c-primary-hover` | `#3C7BA6` | hover |
| `--c-primary-soft` / `-mist` | `#E8F4FB` / `#F3F9FD` | 选中底 / 大面积淡底 |
| `--c-primary-vivid` | `#8ACFEE` | **仅装饰/缩略图**，不做按钮底 |
| `--c-accent` | `#FFC978` | 夕照金点睛 |
| `--c-success` / `--c-danger` | `#6BD9B4` / `#FF8B96` | 成功 / 错误 |
| `--c-bg` / `--c-bg-2` | `#EDF4FA` / `#E4EEF8` | 空气渐变上下端 |
| `--c-surface` | `#FFFFFF` | 纯白高光 |
| `--c-border` | `#DCE9F5` | 柔雾描边 |
| `--c-text` / `-2` / `-3` | `#3E5670` / `#6B85A2` / `#93B1CC` | 彩度阴影（非中性灰） |
| `--c-shadow` | `90,130,170` | 彩色柔影 RGB（取代死黑） |

圆角 `8 / 14 / 20 / 999`；阴影在 `body` 用 `rgba(var(--c-shadow),…)` 现算。

### 2.2 变体

| Token | A 柔群青 `klein` | B 柔樱粉 `cream` |
|-------|-----------------|-----------------|
| Primary | `#6484CE` | `#D37493` |
| Accent | `#FFA978` | `#86D9B4` |
| BG / BG-2 | `#EDF2F9` / `#E5EBF5` | `#FAF1F4` / `#F6E9EF` |
| Border | `#DEE5F0` | `#F7E1E9` |
| Text 阶 | `#3E4A63` / `#66748F` / `#9FAEC6` | `#63495E` / `#8E718A` / `#C6AAC0` |
| Shadow | `100,120,165` | `175,120,145` |

### 2.3 Logo 专属令牌

| Token | 默认 | A | B |
|-------|------|---|---|
| `--logo-bg` | `#4E93C0` | `#6484CE` | `#D37493` |
| `--logo-ink` | `#FFFFFF`（三套统一） | 同 | 同 |
| `--logo-accent` | `#A9DDF3` | `#A9C0F2` | `#F8C9DC` |
| `--logo-line` | `#FFC978` | `#FFA978` | `#FFFFFF` |
| `--logo-ring` | `78,147,192` | `100,132,206` | `211,116,147` |

Logo 候选位使用 `var(--logo-*-vN, var(--logo-*-生效))`，SVG 零硬编码；JS 只写 `data-theme` / `data-logo`。60-30-10 配色：晨光白/纯白铺底、晴空蓝块面、夕照金点睛，同屏不超过三色。

### 2.4 文字

| 角色 | 规格 |
|------|------|
| H1 页面标题 | 16px / 600 / Text |
| H2 区块标题 | 18px / 700 / Text |
| Body | 14px / 400 / Text |
| Caption | 12px / 400 / Text-3 |
| 导航标签 | 12px / 400（选中 600）/ Text-2 → Primary |

字体：`"PingFang SC", "Microsoft YaHei", -apple-system, sans-serif`。

### 2.5 形状与阴影

- 间距：`4 / 8 / 12 / 16 / 20 / 24 / 32`
- 圆角：小 6、卡片/按钮 10、大块 16、胶囊 999
- 阴影：`shadow-1 = 0 1px 3px rgba(0,0,0,.06)`；`shadow-2 = 0 4px 12px rgba(0,0,0,.08)`

## 3. 组件规格

| 组件 | 规格 | 状态 / 说明 |
|------|------|-------------|
| NavItem | 宽 56，图标 22 + 标签 12 | default / hover / active |
| DropZone | min-h 420，2px dashed，r16 | idle / hover / dragging / has-photos |
| PhotoWall | 瀑布流 2/3/4 列，图块满宽 r16 | 扫描数、勾选提示及删除/重置/上传 |
| FileCard | 缩略 110 + meta pad 12，4 列 gap 16 | hover 上浮 2px + shadow-2 |
| StatCard | 标签 13 + 数值 22/700 | — |
| Toggle | 36×20，滑块 16，r999，flex-shrink:0 | on / off |
| Button / SearchInput | 按钮 pad 10/24、r10；输入高约 36、r10、max-w 320 | primary / ghost；focus 主色边框 |
| Tag | 11px，Primary-Soft 底 + Primary 字 | 已复制 / 外链中 |
| Logo | 44×44，r14 squircle | idle / scanning / uploading |

实现注意：`.form-row .switch` 需避免被 `label{width:150px}` 拉宽；Logo 渐变由 JS 设置 `fill`；扫描线使用琥珀色 `#EF9F27`。

## 4. Logo 与图标

- Logo 表达层叠相片与外链斜线，颜色全部使用 `var(--logo-*)`。
- `scanning`（dragover）显示扫描线/光环；`uploading`（drop）显示升腾箭头；idle hover 缩放至 `1.06`。
- 图标令牌：`--ico-stroke` / `--ico-fill` / `--ico-soft` / `--ico-muted` / `--ico-dot`；symbol 只挂 class，禁止硬编码颜色。
- symbols：`i-upload`、`i-folder`、`i-gear`、`i-search`、`i-image`、`i-book`。

## 5. 与 picbed 能力映射（契约不改）

| 界面能力 | API / F | 说明 |
|----------|---------|------|
| 拖入图片/文档 | `/api/session/drop` · F17 | 仅图片或文档；文件夹拒绝 |
| 绑定 root | `/api/session/bind-root` · F17 | 会话绑定 |
| scan / plan / sync | `/api/scan|plan|sync` · F17/F18 | dry-run 零副作用；sync 需 confirm |
| manifest 网格 / 复制外链 | `/api/manifest` · F9/F19 | 无 token |
| revert | `/api/revert` · F19 | dry-run + confirm |
| runs 审计 | `/api/runs` · F21 | JSON 信封 |
| watch | `/api/watch/*` · F22 | 默认 preview |
| 配置 / doctor | `/api/config` `/api/doctor` · F20 | token 掩码 |

HTTP 信封、`confirm` 门、路径安全、token 纪律不变（见 cross-cutting）。

## 6. 响应式

- 桌面（>720px）：侧栏 72px；文件网格 4 列，≤1100px 为 3 列；设置表单左右分栏、最大宽度 720px 并居中。
- 窄屏/竖窗（≤720px）：取消全局 `min-width:860px`，侧栏 56px，隐藏顶栏副标题；表单纵向排列、设置卡单列、文件网格 2 列、统计卡换行。
- 窄屏登录按钮满宽、设置操作单列；目录浮层两侧留 12px、底部 12px，列表最高 45vh，输入/按钮纵向堆叠。

## 7. 验收要点（AC 展开，定义以 features-index 为准）

1. 侧栏五视图均可达（含「规范」）。
2. 主题令牌与组件规格符合交付规范，Toggle 不被拉宽。
3. Logo 三态动效可演示，拖拽可触发并可点击预览。
4. 默认视图为上传/文件放置；统计（F25）和设置承载真实数据与操作。
5. Token 不进 DOM；写操作经过 confirm；策略 A 不降级。

## 8. 开放问题

- 深色主题：**不纳入本期**（F23 范围决策，已裁决）。
暂无未决问题。

---

*视觉与组件以用户《设计交付规范》+ 本映射为准；能力契约以 features-index / module-webui / cross-cutting 为准。*
