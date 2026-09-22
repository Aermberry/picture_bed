# picture_bed · picbed

本地 CLI：读取 Markdown / HTML 中的内嵌图片，上传到 PicX 同源 **GitHub 图床**，自动回写稳定链接。面向人与 Agent。

设计文档见 [`docs/`](docs/)（F/P/模块/AC），HTML 呈现见 [`index.html`](index.html)。

## 环境

- Node.js ≥ 20
- GitHub PAT（`repo` 或 fine-grained Contents 读写），写入环境变量 `PICBED_GITHUB_TOKEN`

## 构建与测试

```bash
npm install
npm run build
npm test
```

## 鉴权（无 OAuth App）

GitHub 图床需要 token，三选一（优先级从高到低）：

```bash
export PICBED_GITHUB_TOKEN=ghp_xxx   # 推荐：自建 PAT（repo 或 Contents RW）
export GITHUB_TOKEN=ghp_xxx          # 兼容通用变量
gh auth login                        # 或直接复用 GitHub CLI 的 token
```

不需要注册 OAuth App，也没有 `login`/`logout`。

## 快速开始

```bash
node bin/picbed.js init
# 编辑 picbed.toml：github.owner / github.repo / github.branch / github.dir
export PICBED_GITHUB_TOKEN=ghp_xxx   # 或已 gh auth login

node bin/picbed.js doctor --json
node bin/picbed.js plan ./docs --json
node bin/picbed.js sync ./docs --json --yes
node bin/picbed.js revert ./docs --dry-run --json
```

也可使用 npm bin 名：`picbed`（`npm link` 后）。

## 命令

| 命令 | 说明 |
|------|------|
| `init` | 生成 `picbed.toml` |
| `doctor` | 配置 / token / API 自检 |
| `scan <path>` | 扫描文档与图片引用 |
| `plan <path>` | 生成上传计划（不写不传） |
| `sync <path>` | 上传并回写链接 |
| `upload <file>` | 单文件上传 |
| `revert <path>` | 按 manifest 还原本地链接 |
| `watch <path>` | 监听变更并触发 sync（F12） |
| `config get\|set\|list` | 配置读写（token 掩码） |
| `commands` | 列出命令 |

全局旗标：`--json` `--quiet` `--verbose` `--config` `--cwd` `--yes` `--dry-run`

## 退出码

0 成功 · 2 用法 · 3 配置/鉴权 · 4 本地文件 · 5 远端 API · 6 部分成功 · 7 需确认

## Agent 调用示例

```bash
picbed doctor --json
picbed plan ./docs --json
picbed sync ./docs --json --yes
```

`--json` 时 stdout 为单一 JSON（`schemaVersion: 1`）；诊断走 stderr。

## 功能点

见 [`docs/features-index.md`](docs/features-index.md)：F1–F15 全部已实现。

### 多图床（F13）

```toml
[host]
type = "github"   # github | local

[local]
root = ".picbed/host-root"
public_base = "https://cdn.example.com"
dir = "img"
```

`host.type = "local"` 时上传写入本地目录，无需 GitHub token。

## MCP 包装（F14）

```bash
node bin/picbed-mcp.js
# 或 npm link 后：picbed-mcp
```

stdio JSON-RPC；tools 均转调 `picbed … --json`。VS Code / Claude 等 MCP 客户端将 command 指到该入口即可。
