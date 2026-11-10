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
│   ├── NavItem ×5   上传 / 统计 / 图库 / 设置 / 规范（仅调试显示）
│   └── Avatar       36×36（占位）
└── Main (flex:1)
    ├── Topbar       高 56px，底边 1px，左右 padding 24
    └── Content      padding 24，可滚动
```

| 视图 | 侧栏文案 | 顶栏标题 / 副标题 | 承载 F / 能力 |
|------|----------|-------------------|---------------|
| `上传` | 上传 | 文件放置 ｜ 拖入文件即可上传 | F17 工作集 · F18 同步（放置区英雄） |
| `统计` | 统计 | 使用统计 ｜ 图床用量 · 每日 · 时段 | F25 使用统计（总计/KPI/热力图/时段） |
| `图库` | 图库 | 图库 ｜ 浏览仓库 | 文件夹树 + 图片墙（GitHub 仓库） |
| `设置` | 设置 | 设置 ｜ 图床配置 | F20 配置 / doctor |
| `规范` | 规范 | 设计规范 ｜ 令牌 · 组件 · 原型连线 | 设计系统说明（内部页） |

> **每个视图都必须有侧栏入口**（交付规范 §1 / §8）。文案固定为「上传 / 统计 / 图库 / 设置 / 规范」（F25 2026-11-09：第二视图「管理」改「统计」；图库视图 2026-09-30 加入；「规范」仅本地调试显示）。

### 1.1 上传视图（默认）

1. **DropZone 英雄区**（min-height 420）：拖入 **图片或 md/html 文档**（不接受文件夹）；2px 虚线、圆角 16。
2. **扫描结果 · 照片墙**（`has-photos`）：隐藏空态英雄；顶部「扫描到 N 张图片」+「重置」「上传」；主体 **Material Tailwind Masonry 画廊**式瀑布流（响应式 2/3/4 列，**gap 8**）——图块**满宽**、列顶/底距微差错落、自然宽高比、**r16**、彩色柔影、hover 文件名浮层（**无放大/让位**）。仍可继续拖入。
3. ~~根绑定行 / 工作集 / scan 按钮组 / 计划分组表~~（2026-09-26 收窄移除；扫描结果改照片墙 2026-09-27）。

### 1.2 统计视图（F25 · 使用统计，2026-11-09 替换原管理视图）

1. **工具栏**：来源 hint（「本地 manifest 与远端仓库聚合 · 仅统计图像」）+「刷新」按钮。
2. **总计卡**（2026-11-11 重设计）：hero 48px 大数字 + 副行「过去一年累计上传 N 张图像」（无假数；`GET /api/stats`；原单段「图像」占比条 + 图例已删——单系列无需图例、满宽条零信息量）。
3. **KPI 卡行**（复用 `.stat-row/.stat-card`）：今天 / 过去 7 天（副行环比 ▲绿 ▼红）/ 连续天数（副行「最长 N 天」）/ 最忙的一天（副行当日数量）。
4. **每日 · 过去一年**：GitHub 风格日历热力图 SVG（53 周列 × 7 行；**宽度自适应**——cell 在 9–15px 间随容器伸缩、窄容器横向滚动；5 档顺序色阶 `heat-lv0..4`——lv0=`--c-bg-2`，lv1–4=`--c-primary` @ .25/.45/.7/1，随主题令牌联动，禁止散色；固定阈值 0 / 1 / 2–3 / 4–7 / 8+；卡头「少 → 多」5 色块比例尺图例；顶部月标签防挤压——与上一标签视距 <22px 丢弃；左侧行标签、每格 `<title>` tooltip）。
5. **时段**：24 小时柱状图 SVG（柱 ≤24px、顶 4px 圆角、基线直角；峰桶标注「HH:00–HH+1:00 最忙」；x 刻度 0/6/12/18；hover tooltip；单系列无图例）。
6. ~~manifest 网格 / 搜索 / 排序 / 批量复制外链~~（2026-11-09 随 F25 **移除**；`/api/manifest` 保留给 CLI；图库视图不受影响）。

### 1.3 设置视图

1. **图床配置卡**（信息分层：仓库信息 → 认证凭据 → 操作区 → 操作输出）：
   - **仓库信息**分组（分组小标题：11px 大写 + 主色圆点，同 cfg-actions-label 语言）：`github.owner/repo/branch/dir` · `url.style`；其中 **`github.dir` 输入框为只读展示态**（见下）。
   - **目录输入框只读（`github.dir` 行 · 2026-10-01 补）**：输入框设 `readonly` —— **禁止手工键入**，只负责显示当前选中的目录；值的唯一来源是浮层点选 / 新建成功后回填。readonly 不影响焦点事件：聚焦或点击仍弹出 `#dirPicker`（因此保留 focus 边框色与柔和焦点环），`cursor:pointer`、`background:var(--c-bg-2)` 以示「不可编辑但可点选」，`title` 说明「仅显示当前目录；点此或「选择目录」按钮浏览仓库」。placeholder 仅在未配置时显示 `github.dir`。「保存设置」不再把该输入框当作自由文本参与写配置（其内容恒等于最后一次选择结果）。
   - **目录选择浮层**（`github.dir` 行 · 2026-10-01）：目录输入框右侧「选择目录」幽灵按钮；聚焦输入框或点按钮在页面**底部居中**弹出 `#dirPicker`（toast 视觉语言：**大圆角 14 + 彩色柔影 `--shadow-2` + 微动效** opacity/translateY 0.18s ease-out），**可停留不自动消失**。结构自上而下：① 头行「选择仓库目录」+ 右 × 关闭；② 当前路径面包屑（超出省略，末段高亮）+ 右对齐「↑ 上级」（根时隐藏）/「刷新」；③ 文件夹列表（📁 + 名称 + 进入箭头，max-height 40vh 滚动，hover 淡主色底，当前目录行主色左描边 +「当前」Tag，空态「此目录没有子文件夹」）；④ 操作区（上方内联 12px 错误文本；「选用当前目录」次按钮；「新建文件夹」输入 + 「新建并选用」主色按钮，处理中禁用并显「处理中…」）。收起：× / 点浮层外部 / `Esc`。选中或新建成功 → 立即写 `github.dir` 并 toast「目录已更新为 xxx」后自动收起。**目录不存在（404）时回退**：自动定位到最近存在的祖先目录并列出，提示转为引导文案（`dir-picker-msg.info`，非红色），缺失末段预填进「新建文件夹」输入框，点「新建并选用」即创建。
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
- 窄屏 / 竖窗（≤720px）：移除全局 `min-width:860px`；侧栏收窄 56px；顶栏隐藏副标题；`form-row` 改上下堆叠（label 宽度自适应）；设置卡单列满宽；`file-grid` 降 2 列；stat-row 换行；GitHub 登录块按钮满宽；cfg-actions 网格降单列（既有 ≤480px 规则上移至 720px 生效）；**目录选择浮层**改为左右各 12px 全宽、底部 12px、列表 max-height 45vh、新建输入与按钮上下堆叠且按钮满宽。

## 7. 验收要点（AC 展开，定义以 features-index 为准）

1. 侧栏四视图均可达（含「规范」）。
2. 主题令牌与组件规格与交付规范一致；Toggle 不被拉宽。
3. Logo 三态动效可演示（拖拽触发 / 点击预览）。
4. 默认视图为上传/文件放置；统计（F25）/设置承载真实数据与操作。
5. Token 不进 DOM；写操作 confirm；策略 A 不降级。

## 8. 开放问题

| # | 问题 | 决议 |
|---|------|------|
| 1 | 侧栏项数 | **已定：5 项**（上传/统计/图库/设置/规范；F25 起第二视图为「统计」，图库 2026-09-30 加入，「规范」仅调试显示），以用户 UI 方案为准（覆盖早前 2 项草图） |
| 2 | 主题 | **已定：晨雾蓝 × 落日暖**（覆盖早前暖石+深青） |
| 3 | 统计页假数据 | 不用假 326；计数来自 manifest/runs/远端真实值（F25） |
| 4 | 深色主题 | 不纳入本期 |

---

*视觉与组件以用户《设计交付规范》+ 本映射为准；能力契约以 features-index / module-webui / cross-cutting 为准。*
