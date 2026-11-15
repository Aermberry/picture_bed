# 横切约定（cross-cutting）

> 全局契约：术语、退出码、JSON 信封、密钥、路径安全、测试与验证。
> 与 [`../architecture.md`](../architecture.md)、[`../features-index.md`](../features-index.md) 及 `module-*.md` 配合阅读。
> CLI/MCP 宿主已移除；以下仍适用的全局约定由 Web API 与 app 层承载。

## 0. 术语对齐

| 术语 | 含义 |
|------|------|
| 图床 | GitHub 仓库文件托管 + 公开 URL（PicX 同源模型） |
| Asset | 本地图片（内容哈希标识） |
| ImageRef | 文档内一条可替换的 URL 引用（含偏移） |
| RemoteImage | 上传后的公开 URL 与远端路径 |
| Manifest | local/raw/sha/url 映射，不含 secret |
| Agent 模式 | `--json` + 非 TTY + 退出码契约已移除；信封语义由 Web API 承载 |
| Web 控制台 | 本机 HTTP UI（F16–F25，Electron 内嵌）；写操作需 `confirm` |
| 工作集 | UI 会话内选中的文档/根，解析为真实 FS 路径 |
| app 共享层 | `src/app/` 唯一应用编排：collect/plan/sync/revert/doctor/config/runs；见 [`module-app.md`](module-app.md) |

## 1. 退出码（全局）

CLI 退出码面已移除；这些错误类别仍作为 app 内部语义，并映射到 HTTP 状态码。

| Code | 含义 | 典型 |
|------|------|------|
| 0 | 成功 | 含 0 变更 |
| 1 | 通用失败 | 未分类 |
| 2 | 用法错误 | 参数非法 |
| 3 | 配置/鉴权 | 缺 token、doctor 失败 |
| 4 | 本地文件 | 缺失、越界 |
| 5 | 远端 API | 4xx/5xx、限流 |
| 6 | 部分成功 | 部分文档失败 |
| 7 | 需要确认 | Web 写操作缺 `confirm` |

## 2. JSON 信封

```json
{
  "schemaVersion": 1,
  "ok": true,
  "command": "sync",
  "data": {},
  "warnings": [],
  "error": null
}
```

失败时 `ok=false`，`error` 为 `{ code, message, path?, hint? }`。Web API 使用同一信封（`command` 为 `api.*`）；HTTP 状态码从 app 层 `AppError` 单点派生（409≈7、401≈3、400≈2/4、502≈5、207≈6），以信封 `error.code` 为准，见 [`module-app.md`](module-app.md)。message、warnings 与 JSON data 不得包含 token 明文。

## 3. 密钥纪律

- 名称：`PICBED_GITHUB_TOKEN` / `GITHUB_TOKEN`；本机凭据 `~/.picbed/credentials.json` 由设置页 `POST /api/auth/token` 写入；也可使用 `gh auth token`，不需 OAuth Client Secret。
- 权限范围仅图床仓库 Contents RW（`repo` 或 `public_repo`）。
- 不得写入 git 跟踪文件、manifest、backup、runs、日志或 JSON data。
- 展示必须掩码（如 `ghp_****` / `****`）；Web 无“显示原文”。
- Web token 仅在服务进程内存；任何 API、页面与 SSE 都不得携带 secret。

## 4. 路径与 FS 安全

- 相对路径以**文档目录**为基准；拒绝逃逸扫描根，默认拒绝绝对路径与 `file://`。
- 文档回写使用 tmp+rename 原子替换；图片字节只读。
- Resolver 归一 Windows/POSIX 路径。
- Web 拖拽的相对线索须在已绑定 root 下解析为真实路径；失败进入 `blocked`，不得只改暂存副本却声称已回写。

## 5. 测试与验证对齐

| 层 | 对齐 F |
|----|--------|
| app：collect/plan/sync/revert/doctor/config（含 RunRecord / 错误码映射） | F1 F2 F6–F9 F18 F20 F21 |
| 单测：extract/resolve/rewrite | F4 F5 F8 |
| 契约测：HostAdapter mock | F7 |
| CLI 集成：退出码 + JSON（已移除） | F10 |
| e2e：fixture 目录 sync | F6–F9 |
| Web API：信封 + confirm + 掩码 + health | F16 F18 F20 |
| Web 工作台：拖拽解析 / plan 分组 / dry-run 无副作用 | F17 |
| Web revert / runs / watch 启停 | F19 F21 F22 |
| 设计文档校验 | 交付前 `npm run validate`（`scripts/validate.mjs`） |

每次改动须有相关测试/验证且全部通过；无测试框架时须注明实际验证命令与结果。

## 6. 命令一览（契约索引）

CLI 命令面与全局旗标已移除：`init`、`doctor`、`scan`、`plan`、`sync`、`upload`、`revert`、`watch`、`config`、`ui`、`commands`；`--json`、`--quiet`、`--verbose`、`--config`、`--cwd`、`--yes`、`--dry-run`。Web API：`/api/health|config|doctor|scan|plan|sync|manifest|revert|runs|watch/*|stats|gallery|branches`（见 module-webui）。

## 7. GitHub Token 解析顺序

不提供 OAuth 登录；使用用户已有凭据，优先顺序如下：

1. `PICBED_GITHUB_TOKEN`
2. `GITHUB_TOKEN`
3. 本机凭据 `~/.picbed/credentials.json`（由 Web 设置页 `POST /api/auth/token` 写入）
4. `gh auth token`（`gh` 是 GitHub CLI，不是 `git`；需先 `gh auth login`。未安装 `gh` 时跳过）

实现位于 `src/infra/gh-cli.ts#resolveToken`，来源标识依次为 `env` / `user` / `gh`。缺 token 时错误 hint 须说明如何获取 PAT 或使用 GitHub CLI。Token 只在服务进程内存中注入，不得进入可序列化输出、manifest、日志、API 响应、页面或 SSE；展示时只允许掩码，禁止回显原文。

| 情况 | 错误语义 |
|------|----------|
| 无任何 token | 3 |
| token 无权限 / API 失败 | 5（doctor 汇总时可为 3） |
| `login` / `logout` | 2；命令已移除并提供 hint |

*与 module / features 冲突时：功能定义看总表，实现细节看 module，全局约定以本文为准。*
