# Web 控制台壳层与视觉规格（F23）

> 归属功能点：[F23 Web 控制台壳层与视觉重设计](../../features-index.md#f23-web-控制台壳层与视觉重设计)
> 模块：[`module-webui.md`](../module-webui.md) · 全局契约：[`cross-cutting.md`](../cross-cutting.md)
> **视觉权威**：用户交付《图床工具-UI方案.html》+《图床工具-设计交付规范.md》（主题「晨雾蓝 × 落日暖」，2026-09-25）。本文件为该方案在 picbed 的落地映射。
> 画布基线：桌面 Web `1440×900`，最小宽度 `860px`。

## 1. 信息架构（四视图，侧栏全可达）

```text
App (flex, height 100vh)
├── Sidebar          固定 72px，右侧 1px 边框
│   ├── Logo         44×44 squircle（三态动效）
│   ├── NavItem ×4   上传 / 管理 / 设置 / 规范
│   └── Avatar       36×36（占位）
└── Main (flex:1)
    ├── Topbar       高 56px，底边 1px，左右 padding 24
    └── Content      padding 24，可滚动
```

| 视图 | 侧栏文案 | 顶栏标题 / 副标题 | 承载 F / 能力 |
|------|----------|-------------------|---------------|
| `上传` | 上传 | 文件放置 ｜ 拖入文件即可上传 | F17 工作集 · F18 同步（放置区英雄） |
| `管理` | 管理 | 文件管理 ｜ 共 N 个文件 | 已上传图片库 |
| `图库` | 图库 | 图库 ｜ 浏览仓库 | 文件夹树 + 图片墙（GitHub 仓库） |
| `设置` | 设置 | 设置 ｜ 图床配置 | F20 配置 / doctor |
| `规范` | 规范 | 设计规范 ｜ 令牌 · 组件 · 原型连线 | 设计系统说明（内部页） |

> **四视图都必须有侧栏入口**（交付规范 §1 / §8）。文案固定为「上传 / 管理 / 设置 / 规范」。

### 1.1 上传视图（默认）

1. **DropZone 英雄区**（min-height 420）：拖入 **图片或 md/html 文档**（不接受文件夹）；2px 虚线、圆角 16。
2. **扫描结果 · 照片墙**（`has-photos`）：隐藏空态英雄；顶部「扫描到 N 张图片」+「重置」「上传」；主体 **Material Tailwind Masonry 画廊**式瀑布流（响应式 2/3/4 列，**gap 8**）——图块**满宽**、列顶/底距微差错落、自然宽高比、**r16**、彩色柔影、hover 文件名浮层（**无放大/让位**）。仍可继续拖入。
3. ~~根绑定行 / 工作集 / scan 按钮组 / 计划分组表~~（2026-09-26 收窄移除；扫描结果改照片墙 2026-09-27）。

### 1.2 管理视图（查看已上传图片）

1. **StatCard 行**：文件总数 / 本月上传 / 已映射 / 外链调用（数据来自 manifest，无假数）。
2. **工具栏**：搜索文件名、排序、批量复制外链（有 URL 的 entry）。
3. **FileCard 网格**（4 列，窄屏 3 列）：manifest 资产缩略/色块 + 文件名 + 大小/Tag（已复制 / 外链中）。
4. ~~回滚区（F19）~~ · ~~审计区（F21）~~ · ~~监听区（F22）~~（2026-09-28 **UI 移除**；CLI 仍保留 revert/watch）。

### 1.3 设置视图

1. **图床配置卡**（信息分层：仓库信息 → 认证凭据 → 操作区 → 操作输出）：
   - **仓库信息**分组（分组小标题：11px 大写 + 主色圆点，同 cfg-actions-label 语言）：`github.owner/repo/branch/dir` · `url.style`。
   - **认证凭据**分组：**Token** 输入框直接粘贴 PAT（写 `~/.picbed/credentials.json`，不进 git / 不写 picbed.toml；掩码展示，粘贴新 PAT 后点「保存设置」覆盖；行内「已配置」Tag 随本机凭据状态联动）；下接动态状态行 `authHint` 与 **GitHub 一键登录**深色块（gh auth login --web，含日志浮层）。
   - **操作区**：主操作（读配置 / 保存设置）与备份/迁移（导出 / 导入 picbed.toml）两组网格按钮，主操作组淡主色底、次操作组中性底；组下 hint 说明导出/导入语义。
   - **操作输出**：带「操作输出」小标题的 `pre` 面板（最近 API 结果，token 掩码），替代无标题裸输出框。
2. **外观主题**：三套主题选择，即时生效并 localStorage 记忆；卡头副标题替代重复 hint。
3. ~~上传偏好~~ · ~~自检 doctor~~（2026-09-28 **UI 移除**；CLI 仍保留 `doctor`）。

### 1.4 规范视图

色板 / 文字 / 间距 / 图标 / Logo 三态 / 组件与原型说明（可切换 Logo 配色 V1–V3）。

## 2. 设计令牌（京阿尼柔光 · 三主题 · 禁止散色）

色调法：**京阿尼式水彩赛璐璐**——去浊提纯 · 彩度阴影 · 高光留白 · 空气透视 · 亮色分离 · 柔化降饱和 · 彩色柔影。  
颜色全部走 CSS 变量；`body[data-theme]` 整体换肤（`""` / `klein` / `cream`）。

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

圆角：`8 / 14 / 20 / 999`（整体 +2~4）。阴影在 `body` 用 `rgba(var(--c-shadow),…)` 现算。

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

候选位提升：`var(--logo-*-vN, var(--logo-*-生效))`，**不写死 hex**。SVG 零硬编码；JS 只写 `data-theme` / `data-logo`。

**60-30-10**：晨光白/纯白铺底 · 晴空蓝块面 · 夕照金点睛（同屏 ≤3）。

### 2.1 文字

| 角色 | 规格 |
|------|------|
| H1 页面标题 | 16px / 600 / Text |
| H2 区块标题 | 18px / 700 / Text |
| Body | 14px / 400 / Text |
| Caption | 12px / 400 / Text-3 |
| 导航标签 | 12px / 400（选中 600）/ Text-2 → Primary |

字体：`"PingFang SC", "Microsoft YaHei", -apple-system, sans-serif`

### 2.2 形状与阴影

- 间距：`4 / 8 / 12 / 16 / 20 / 24 / 32`
- 圆角：小 6 · 卡片/按钮 10 · 大块 16 · 胶囊 999
- 阴影：`shadow-1 = 0 1px 3px rgba(0,0,0,.06)` · `shadow-2 = 0 4px 12px rgba(0,0,0,.08)`

## 3. 组件规格

| 组件 | 规格 | 状态 |
|------|------|------|
| NavItem | 宽 56，图标 22 + 标签 12 | default / hover / active |
| DropZone | min-h 420，2px dashed，r16 | idle / hover / dragging / has-photos |
| PhotoWall | 最短列瀑布流 2/3/4 列，gap 6；图块满宽 r16 | 顶栏下独立子栏（扫描到 N + 勾选提示 + 删除/重置/上传）；点选多选 |
| FileCard | 缩略 110 + meta pad 12，网格 4 列 gap 16 | hover 上浮 2px + shadow-2 |
| StatCard | 标签 13 + 数值 22/700 | — |
| Toggle | **36×20**，滑块 16，r999，**flex-shrink:0** | on / off |
| Button | pad 10/24，r10 | primary / ghost |
| SearchInput | 高约 36，r10，max-w 320 | focus 边框 primary |
| Tag | 11px，Primary-Soft 底 + Primary 字 | 已复制 / 外链中 |
| Logo | 44×44，r14 squircle | idle / scanning / uploading |

**实现坑（必须遵守）**：`.form-row .switch` 选择器提权，避免被 `label{width:150px}` 拉宽；Logo 渐变用 JS `setAttribute("fill",…)`；扫描线用琥珀 `#EF9F27`。

## 4. Logo 与图标

- **Logo 语义**：层叠相片 + 外链斜线（上传图片 → 拿到外链）。全部 `var(--logo-*)`。
- **动效**：`scanning`（dragover）扫描线 1.2s + 光环；`uploading`（drop）箭头升腾 0.9s；idle hover `scale(1.06)`。
- **图标令牌**：`--ico-stroke` / `--ico-fill` / `--ico-soft` / `--ico-muted` / `--ico-dot`；symbol 内只挂 class（`ico-s` `ico-stroke` `ico-soft` `ico-muted` `ico-dot`），**零硬编码色**，随主题联动。
- symbol：`i-upload` `i-folder` `i-gear` `i-search` `i-image` `i-book`。

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

- 桌面（>720px）：`file-grid` 4 列，≤1100px 降 3 列；侧栏 72px；设置表单左标签（120px）+ 右控件；设置列 max-width 720 并水平居中。
- 窄屏 / 竖窗（≤720px）：移除全局 `min-width:860px`；侧栏收窄 56px；顶栏隐藏副标题；`form-row` 改上下堆叠（label 宽度自适应）；设置卡单列满宽；`file-grid` 降 2 列；stat-row 换行；GitHub 登录块按钮满宽；cfg-actions 网格降单列（既有 ≤480px 规则上移至 720px 生效）。

## 7. 验收要点（AC 展开，定义以 features-index 为准）

1. 侧栏四视图均可达（含「规范」）。
2. 主题令牌与组件规格与交付规范一致；Toggle 不被拉宽。
3. Logo 三态动效可演示（拖拽触发 / 点击预览）。
4. 默认视图为上传/文件放置；管理/设置承载 F17–F22 真实数据与操作。
5. Token 不进 DOM；写操作 confirm；策略 A 不降级。

## 8. 开放问题

| # | 问题 | 决议 |
|---|------|------|
| 1 | 侧栏项数 | **已定：4 项**（上传/管理/设置/规范），以用户 UI 方案为准（覆盖早前 2 项草图） |
| 2 | 主题 | **已定：晨雾蓝 × 落日暖**（覆盖早前暖石+深青） |
| 3 | 管理页假数据 | 不用假 326；计数来自 manifest/runs 真实值 |
| 4 | 深色主题 | 不纳入本期 |

---

*视觉与组件以用户《设计交付规范》+ 本映射为准；能力契约以 features-index / module-webui / cross-cutting 为准。*
