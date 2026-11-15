# 设计文档阅读指南

## 1. 文档地图

- [功能点总表](features-index.md)：F/P/模块归属与 AC 定义权威；[架构总纲](architecture.md)：分层、选型与分期。
- [横切约定](design/cross-cutting.md)：跨模块契约；[`design/module-*.md`](design/)：各模块域规则、数据、不变量、接口与失败语义。
- [UI 视格](design/wireframes/ui-shell.md)：F23 视图与主题令牌；[桌面模块](design/module-desktop.md)：Electron、`renderer/` 单源与 electron-vite。
- [SPA 拆分文档](design/archive/module-webui-spa-split.md)：历史决策轨迹；本文说明如何阅读标识及其链接关系。

## 2. 阅读路径

1. 在功能点总表锁定目标 `Fx`，阅读其优先级、归属模块和 AC。
2. 进入对应 `module-*` 阅读域规则；跨模块契约再查 cross-cutting。
3. 需要理解分层或选型时查 architecture；修改 UI 视觉时查 wireframes。

## 3. 标识体系

**F（Feature Point ID）**：稳定指称一项可独立描述、验收的产品能力，定义权威在 [features-index.md](features-index.md)。
F 号只保证唯一，不是类名、开发任务号或 issue 号；发布后不复用、不改指。

**P（Priority）**：表示交付顺序，不代表难度或缺陷等级；数字越小越优先。
P0 为 MVP 闭环（含 F16–F18、F23、F24），P1 为第二批，P2 为增强，P3 为 backlog；按优先级安排阅读深度。

**模块（module）**：表示主要业务责任归属，不等同于代码目录或 CLI 子命令。
`ingest`/`transfer`/`rewrite`/`cliops`/`webui`/`desktop` 是模块；`app` 是非限界上下文的共享应用编排层。

**AC（Acceptance Criteria）**：从属于 F 的可观察完成条件，是对外承诺的验收判据。
AC 不是实现步骤或 API 字段表；模块文档补充实现规则，不重定义 AC。

## 4. 双向链接

定义权威：features-index；域实现：module 文档；全局契约：cross-cutting；分层与选型：architecture。
`features-index.md（F 定义） ↔ design/module-*.md（域实现与功能点映射） ↔ design/cross-cutting.md（全局契约）`；architecture 负责分层视图。

## 5. 示例：读懂 F4

1. 总表中的 F4：P0、归属 ingest，AC 覆盖多语法、代码区不误抽、偏移精确。
2. [module-ingest.md#f4](design/module-ingest.md#f4-图片引用抽取)：查看抽取算法、跳过规则与 `ImageRef` 形状。
3. 全局 ref 字段语义查 [cross-cutting.md](design/cross-cutting.md)。
4. 实现争议先回到对应 AC；同样路径适用于其他 Fx。

## 6. 维护约定

新增 F 时先登记总表，再由 module 文档建立映射；分期变化同步更新 architecture。
仅在确需表达流程或状态时使用 Mermaid；模块文档默认无图，架构图归 [architecture.md](architecture.md)。
标识是索引，不是实现；修改契约时同步维护定义、域实现和双向链接。
