# 功能点规格总表（索引 + 双向链接）

> **新人阅读入口**：先读 [`design-reading-guide.md`](design-reading-guide.md)——文中 **F/P/模块/AC** 等标识的含义与用途，再回本表查具体功能点。
>
> 本文件为功能点**索引与归属枢纽**：每节给出优先级、**所属模块**、实现归属（域/CLI）、AC 摘要。
> **产品定位**：本地 CLI **picbed**——扫描文档内嵌图片 → GitHub 图床上传 → 链接回写；Agent 可驱动。
> 详细实现设计按 DDD 模块拆分：
> - **ingest** 模块（F3/F4 扫描抽取、F5 解析去重）→ [`design/module-ingest.md`](design/module-ingest.md)
> - **transfer** 模块（F6/F7 上传与 URL）→ [`design/module-transfer.md`](design/module-transfer.md)
> - **rewrite** 模块（F8/F9 回写与 revert）→ [`design/module-rewrite.md`](design/module-rewrite.md)
> - **cliops** 模块（F1/F2/F10/F11 配置、doctor、Agent 契约）→ [`design/module-cliops.md`](design/module-cliops.md)
> - 横切约定 / 退出码 / JSON → [`design/cross-cutting.md`](design/cross-cutting.md)
>
> 模块文档内有「功能点映射」节链回本文件，形成相向链接。
> 优先级：P0=MVP 最小闭环，P1=第二批，P2=后续增强，P3=backlog。架构分层见 [`architecture.md`](architecture.md)。

## 总览

| ID | 名称 | 优先级 | 模块 | AC 摘要 |
|----|------|--------|------|---------|
| F1 | 项目初始化与配置 | P0 | cliops | init 生成合法模板；config get/set/list 正确；token 掩码 |
| F2 | 环境与鉴权自检 | P0 | cliops | doctor 报告缺项/坏 token/无权限；失败退出码 3 |
| F3 | 目录扫描与文档发现 | P0 | ingest | 按扩展名/忽略规则列出文档；不误入 node_modules |
| F4 | 图片引用抽取 | P0 | ingest | MD/HTML 语法覆盖；代码块内不误伤；偏移可替换 |
| F5 | 本地资产解析与去重 | P0 | ingest | 相对路径正确；缺失/越界可诊断；sha256 合并多引用 |
| F6 | 上传计划 plan | P0 | transfer | upload/skip-cache/skip-remote/blocked 分类正确；可 dry-run |
| F7 | GitHub 图床上传 | P0 | transfer | Contents API 写入成功；URL 风格正确；同 sha 幂等 |
| F8 | 文档链接回写 | P0 | rewrite | 仅替换 URL 子串；原子写；默认 backup |
| F9 | Manifest 与 revert | P1 | rewrite | 映射可审计；revert 还原本地路径；无 token |
| F10 | Agent 机器接口 | P0 | cliops | `--json` schema 稳定；退出码契约；无 TTY 不阻塞 |
| F11 | 单文件上传 | P1 | transfer | upload 子命令输出 URL；与 sync 共用适配器 |
| F15 | GitHub 点击登录 | P0 | cliops | 本机回调 OAuth 优先；Device Flow 回退；token 本地安全存储；ENV PAT 仍可用 |
| F12 | watch 监听 | P3→**done** | cliops | 目录变更触发增量 plan/sync；可退出；不引入常驻特权 |
| F13 | 多图床适配器 | P3→**done** | transfer | HostAdapter 可替换为非 GitHub 后端且 AC7 语义保持 |
| F14 | VS Code / MCP 包装 | P3→**done** | cliops | 包装层不复制业务规则，只调用 CLI 契约 |

---

## F1 项目初始化与配置

- 优先级：P0 · 模块：**cliops**
- 实现（域）：[module-cliops · F1](design/module-cliops.md#f1-项目初始化与配置)
- AC：`init` 在空目录生成 `picbed.toml` 合法模板（无 secret）；`--force` 可覆盖；`config list` 对 token 掩码；`config set` 校验键名与枚举（如 `url.style`）；优先级 CLI>ENV>项目文件生效。

## F2 环境与鉴权自检

- 优先级：P0 · 模块：**cliops**
- 实现（域）：[module-cliops · F2](design/module-cliops.md#f2-环境与鉴权自检)
- AC：`doctor` 检查配置完整、token 存在、API 可达、目标仓库 Contents 权限；问题项可定位（缺键名/HTTP 状态）；失败退出码 3；成功含 `ok:true` 摘要。

## F3 目录扫描与文档发现

- 优先级：P0 · 模块：**ingest**
- 实现（域）：[module-ingest · F3](design/module-ingest.md#f3-目录扫描与文档发现)
- AC：默认扩展名 `md,html,htm` 可配置；遵循 ignore glob；不进入 `node_modules`/`.git`；结果路径稳定排序，便于 diff。

## F4 图片引用抽取

- 优先级：P0 · 模块：**ingest**
- 实现（域）：[module-ingest · F4](design/module-ingest.md#f4-图片引用抽取)
- AC：覆盖 `![]()`、图片扩展名链接、`<img src|srcset>`、`<source>`、SVG `<image href>`；**代码块/行内代码中的伪引用不抽取**；每条引用含精确 `start/end`；多语法混排不漏不重。

## F5 本地资产解析与去重

- 优先级：P0 · 模块：**ingest**
- 实现（域）：[module-ingest · F5](design/module-ingest.md#f5-本地资产解析与去重)
- AC：相对路径相对**文档目录**解析；文件缺失/非图片扩展名报 blocked 且含 path；默认拒绝绝对路径与 `file://`；`sha256` 相同的多引用合并为单 Asset。

## F6 上传计划 plan

- 优先级：P0 · 模块：**transfer**
- 实现（域）：[module-transfer · F6](design/module-transfer.md#f6-上传计划-plan)
- AC：缓存命中 → `skip-cache`；已是 http(s) → `skip-remote`；合法本地文件 → `upload`；解析失败 → `blocked`；`plan`/`sync --dry-run` 不上传不改文档；计划 JSON 含 action 与 reason。

## F7 GitHub 图床上传

- 优先级：P0 · 模块：**transfer**
- 实现（域）：[module-transfer · F7](design/module-transfer.md#f7-github-图床上传)
- AC：`PUT contents` 成功并返回可解析路径；`raw`/`jsdelivr`/`custom` URL 生成正确；同一 `sha256` 重复 sync 不二次上传；429/403 退避后可重试或明确失败（退出码 5）；commit message 可配置。

## F8 文档链接回写

- 优先级：P0 · 模块：**rewrite**
- 实现（域）：[module-rewrite · F8](design/module-rewrite.md#f8-文档链接回写)
- AC：仅替换引用 URL 子串，alt/title/周边文本不变；代码块内不改写；原子写无半截文件；默认生成 backup；`--out-dir` 时源文件不变。

## F9 Manifest 与 revert

- 优先级：P1 · 模块：**rewrite**
- 实现（域）：[module-rewrite · F9](design/module-rewrite.md#f9-manifest-与-revert)
- AC：manifest 记录 doc/raw/localPath/sha256/publicUrl；**无 token**；`revert` 将 URL 还原为原文档中的 raw 路径；`revert --dry-run` 不写盘；损坏 manifest 报错不静默丢映射。

## F10 Agent 机器接口

- 优先级：P0 · 模块：**cliops**
- 实现（域）：[module-cliops · F10](design/module-cliops.md#f10-agent-机器接口)
- AC：支持命令均有 `--json`；stdout 单一 JSON（诊断走 stderr）；含 `schemaVersion`；非 TTY 写文件需 `--yes` 否则退出码 7；退出码与文档表一致；重复 run 幂等可预期。

## F11 单文件上传

- 优先级：P1 · 模块：**transfer**
- 实现（域）：[module-transfer · F11](design/module-transfer.md#f11-单文件上传)
- AC：`upload <file>` 成功输出 publicUrl（人类/JSON）；与 `sync` 共用 HostAdapter 与 URL 策略；失败映射到既有退出码。

## F15 GitHub 点击登录

- 优先级：P0 · 模块：**cliops**
- 实现（域）：[module-cliops · F15](design/module-cliops.md#f15-github-点击登录)
- AC：`login` 默认启动 `127.0.0.1` 回调并打开浏览器完成 OAuth；`login --device` 走 Device Flow（显示 user_code）；授权成功后 token 写入用户级凭据文件（0600，不入库）；`PICBED_GITHUB_TOKEN` 优先于存储的 OAuth token；`logout` 可清除；client_id/secret 来自 ENV 或用户配置且输出掩码；state 校验防 CSRF。

## F12 watch 监听

- 优先级：P3（已实现）· 模块：**cliops**
- 实现（域）：[module-cliops · F12](design/module-cliops.md#f12-watch-监听)
- AC：目录变更触发增量 plan/sync；可退出；不引入常驻特权。实现：`watch <path> --debounce <ms>`；`fs.watch` 递归监听 + 防抖批处理；变更时 spawn 既有 `sync`（只调 CLI 契约）；SIGINT/SIGTERM 可退出；忽略 `node_modules`/`.git`/`.picbed`。

## F13 多图床适配器

- 优先级：P3（已实现）· 模块：**transfer**
- 实现（域）：[module-transfer · F13](design/module-transfer.md#f13-多图床适配器)
- AC：`HostAdapter` 可替换为非 GitHub 后端且 AC7 语义保持。实现：`host.type = github | local`；`local` 为文件系统图床（无需 token）；工厂 `createHostAdapter` 注入 sync/upload；URL/远端路径由适配器 `composeUrls`/`remotePath` 提供。

## F14 VS Code / MCP 包装

- 优先级：P3（已实现）· 模块：**cliops**
- 实现（域）：[module-cliops · F14](design/module-cliops.md#f14-vs-code--mcp-包装)
- AC：包装层不复制业务规则，只调用 CLI 契约。实现：`picbed-mcp` stdio JSON-RPC 服务；tools = doctor/scan/plan/sync/upload/revert；全部 `spawn` 既有 CLI + `--json`。

---

## 优先级说明

- **P0**：最小可用闭环（配置→抽取→计划→上传→回写→Agent JSON）。
- **P1**：revert/manifest 完备、单文件上传。
- **P2**：（预留）增强，如更丰富 report。
- **P3**：明确 backlog（watch、多图床、IDE 集成）。

*定义以本表为准；实现细节以 module-* / cross-cutting 为准；冲突须显式修文档。*
