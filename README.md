# picture_bed · yigecli

本地 CLI：读取 Markdown / HTML 中的内嵌图片，上传到 PicX 同源 **GitHub 图床**，自动回写稳定链接。面向人与 Agent。

设计文档见 [`docs/`](docs/)（F/P/模块/AC），HTML 呈现见 [`index.html`](index.html)。

## 环境

- Node.js ≥ 20
- GitHub PAT（`repo` 或 fine-grained Contents 读写），写入环境变量 `YIGE_GITHUB_TOKEN`

## 构建与测试

```bash
npm install
npm run build
npm test
```

## 登录（GitHub 点击授权）

在 GitHub 创建 **OAuth App**（Callback URL：`http://127.0.0.1:53682/callback`），然后：

```bash
export YIGE_GITHUB_CLIENT_ID=...
export YIGE_GITHUB_CLIENT_SECRET=...

node bin/yigecli.js login          # 浏览器点击 Authorize（本机回调）
node bin/yigecli.js login --device # 远程/无浏览器：Device Flow（输一次性码）
node bin/yigecli.js logout
```

Token 存用户级 `~/.config/yigecli/credentials.json`（不入库）。也可继续用 `YIGE_GITHUB_TOKEN`（PAT，优先级更高）。

## 快速开始

```bash
node bin/yigecli.js init
# 编辑 yigecli.toml：github.owner / github.repo / github.branch / github.dir
# 登录后无需再导出 PAT；若用 PAT：export YIGE_GITHUB_TOKEN=ghp_xxx

node bin/yigecli.js doctor --json
node bin/yigecli.js plan ./docs --json
node bin/yigecli.js sync ./docs --json --yes
node bin/yigecli.js revert ./docs --dry-run --json
```

也可使用 npm bin 名：`yigecli`（`npm link` 后）。

## 命令

| 命令 | 说明 |
|------|------|
| `init` | 生成 `yigecli.toml` |
| `login` | GitHub OAuth 点击登录（`--device` 走 Device Flow） |
| `logout` | 清除本地 OAuth 凭据 |
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
yigecli doctor --json
yigecli plan ./docs --json
yigecli sync ./docs --json --yes
```

`--json` 时 stdout 为单一 JSON（`schemaVersion: 1`）；诊断走 stderr。

## 功能点

见 [`docs/features-index.md`](docs/features-index.md)：F1–F15 全部已实现。

### 多图床（F13）

```toml
[host]
type = "github"   # github | local

[local]
root = ".yigecli/host-root"
public_base = "https://cdn.example.com"
dir = "img"
```

`host.type = "local"` 时上传写入本地目录，无需 GitHub token。

## MCP 包装（F14）

```bash
node bin/yigecli-mcp.js
# 或 npm link 后：yigecli-mcp
```

stdio JSON-RPC；tools 均转调 `yigecli … --json`。VS Code / Claude 等 MCP 客户端将 command 指到该入口即可。
