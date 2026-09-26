---
name: ui-spec-impl
description: 将 UI 设计交付物（HTML 高保真原型 + 设计交付规范/令牌表）落成 picbed Web 控制台实现。当用户要求「按 UI 方案改进/实现界面」、对齐主题令牌、重做壳层布局、或核对交付检查清单时使用。覆盖：设计包先于代码、四视图壳层、主题换肤与 Logo/图标令牌化、与既有 API/AC 映射、测试与发版注意点。
---

# UI 方案 → 可发布界面

把「可交互原型 + 交付规范」落成 `src/ui/static.ts` 控制台，并保持 **F 契约不变、先改设计包再改代码**。  
主题与数值以用户《设计交付规范》为视觉权威；能力定义仍以 `docs/features-index.md` 为准。

## 适用

- 用户丢来 `图床工具-UI方案.html` / `设计交付规范.md` 要求实现或改进 UI
- 换肤、主题令牌、Logo/图标与原型不一致
- 壳层导航、DropZone、FileCard、Toggle 等与规范对照
- UI 改完要进 Git Flow 并随 Release 分发

## 不适用

- 纯业务 API/CLI 契约变更（先改 features-index / module-*）
- 从零产品设计（先 `project-design`）

---

## 1. 工作顺序（强制）

```text
读原型 + 交付规范
  → 更新设计包（docs/design/wireframes/ui-shell.md + features-index/module-webui）
  → 实现 src/ui/static.ts（及必要测试）
  → npm test + npm run lint
  → commit → 自动 push（release 另需审核）
```

**禁止**先改代码后补文档。AC 权威在 `features-index.md`；视觉令牌权威在**用户交付规范** + `wireframes/ui-shell.md` 映射。

---

## 2. 从规范提取的落地结构（picbed 控制台）

```text
App (flex, 100vh, min-width 860)
├── Sidebar 72px：Logo 44×44 + Nav ×4 + Avatar
└── Main：Topbar 56px + Content 24px 滚动
     ├─ 上传/文件放置（默认）DropZone · root 绑定 · 工作集 · plan/sync
     ├─ 管理  统计 · 文件网格 · 回滚 · 审计 · watch
     ├─ 设置  配置/doctor · Toggle · 主题选择
     └─ 规范  令牌/Logo/图标说明
```

- 侧栏文案固定：**上传 / 管理 / 设置 / 规范**（缺一不可达）。
- UI 只消费既有 `/api/*`；**不**为布局新造与 JSON 信封冲突的字段。
- 拖拽仍为**策略 A**（先绑 root）；token 不进 DOM；写操作 `confirm`。

### 与 F 映射（壳层不改契约）

| 视图 | F |
|------|---|
| 上传 | F17 F18 |
| 管理 | F19 F21 F22 + manifest 展示 |
| 设置 | F20 |
| 全局壳层 | F23 |
| 服务 | F16 |

---

## 3. 主题与令牌（必须 CSS 变量）

### 3.1 分层

```text
:root                         → 默认值
body[data-theme="klein"]      → 主题 A
body[data-theme="cream"]      → 主题 B
body[data-logo="v2"|v3"]      → Logo 候选位（建议 body[data-theme][data-logo] 提升）
```

- JS **只写** `data-theme` / `data-logo`，**禁止** `setAttribute("fill", …)` 注色。
- SVG 造型零色值：`fill: var(--logo-bg, #回退)` 等。
- `--logo-ring` 存 **RGB 三元组**（`78,147,192`），给 `rgba(var(--logo-ring), .45)` 用。
- 阴影在 **body 上现算**：`--shadow-1: … rgba(var(--c-shadow), …)`，勿在 `:root` 拼变量。

### 3.2 京阿尼柔光要点（picture_bed 现行）

- 彩度阴影（Text 带主题色相，不用中性灰）
- 空气渐变 `--c-bg → --c-bg-2` + 顶部白雾
- 彩色柔影 `--c-shadow`，弃 `rgba(0,0,0,.06)`
- 圆角整体偏大（如 8/14/20）
- `--c-primary-vivid` **不做**按钮底（对比不足）

色值**以用户最新《设计交付规范》为准**，实现时只做一张对照表进 `wireframes/ui-shell.md`，不要各面板散写 hex。

### 3.3 组件坑（已踩过）

| 坑 | 做法 |
|----|------|
| Toggle 被 `label{width:150px}` 拉宽 | `.form-row .switch` 提权 + `flex-shrink:0` |
| Logo 渐变/内联色不随主题 | 纯色 + CSS 变量 |
| 图标写死 `#2E4B7E` | `--ico-stroke/soft/muted/dot` + class |
| 候选位盖不过主题块 | `body[data-theme][data-logo="v2"]` |

---

## 4. 实现与验收

1. **静态 UI**：单文件 `INDEX_HTML`（`src/ui/static.ts`）即可；四视图 + Toast + Confirm 浮层。
2. **接线**：`/api/health|session|scan|plan|sync|manifest|revert|config|doctor|runs|watch/*`。
3. **测试**：壳层字符串断言（四导航、令牌 hex、`data-theme`、无 JS 注色）；既有 F17–F22 面板测试保持绿。
4. **本地预览**：`npm run build` 后 `picbed ui`（默认 `127.0.0.1:4780`）。
5. **对照交付检查清单**（规范页 §9）：四视图、三主题、Logo 三态、图标令牌、无散色。

### 常见「不一致」误判

- `npx releases/latest/...` 是旧 tag → 先发版，不是 UI 打包丢文件（见 skill `npm-oidc-release`）。

---

## 5. 交付

- 设计：`docs/design` → 合入 `develop`
- 实现：`feature/<topic>` → `develop`
- commit 后**自动 push**；**release/tag** 需用户审核（`.agents/rules/delivery.md`）

---

## 6. 相关

- `project-design`：F/P/模块/AC 设计包
- `npm-oidc-release`：改完 UI 如何发到 GitHub/npm
- 本项目视格：`docs/design/wireframes/ui-shell.md`
