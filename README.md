# picture_bed · picbed

本地 CLI：读取 Markdown / HTML 中的内嵌图片，上传到 PicX 同源 **GitHub 图床**，自动回写稳定链接。面向人与 Agent。

设计文档见 [`docs/`](docs/)（F/P/模块/AC），HTML 呈现见 [`docs/html/index.html`](docs/html/index.html)。

## 安装

**方式 1 · Release 包（推荐，永远装最新）**

```powershell
npm install -g https://github.com/Aermberry/picture_bed/releases/latest/download/picbed.tgz
```

说明：`/releases/latest/download/picbed.tgz` 会**自动指向最新 Release** 的同名安装包，版本升级后无需改 README 命令，复制粘贴即可。

也可到 [Releases](https://github.com/Aermberry/picture_bed/releases) 下载带版本号的 `picbed-x.y.z.tgz` 后：

```powershell
npm install -g .\picbed-0.2.0.tgz
```

装好后可用全局命令：`picbed`、`picbed-mcp`。

**方式 2 · 从源码**

```bash
git clone https://github.com/Aermberry/picture_bed.git
cd picture_bed
npm install
npm run build
node bin/picbed.js --help     # 或 npm link 后直接用 picbed
```

## 环境

- Node.js ≥ 20
- GitHub 访问令牌（PAT）或已登录的 GitHub CLI（`gh`）

## 构建与测试

```bash
npm install
npm run build
npm test
```

## 鉴权（无 OAuth App）

GitHub 图床需要 **访问令牌（token）**，**两种方式**（优先级从高到低）：

```bash
# 方式 1：PAT（和「方式 2」二选一）
export PICBED_GITHUB_TOKEN=ghp_xxx   # 推荐变量名
export GITHUB_TOKEN=ghp_xxx          # 或用这个变量名（同一把 PAT，只是别名）

# 方式 2：复用 GitHub CLI
gh auth login
```

### 不知道 `gh` 是什么？

**`gh` = GitHub CLI（GitHub 官方命令行）**，和 `git` 不是一回事：

| | `git` | `gh` |
|--|-------|------|
| 是什么 | 版本控制本体 | GitHub 网站功能的命令行（PR/Issue/登录等） |
| 装过 git 就有吗 | — | **不一定**，要单独安装 |

- 安装：https://cli.github.com/  
- 登录：`gh auth login`（浏览器点一次）  
- 登录后无需再设 `PICBED_GITHUB_TOKEN`，picbed 会自动调用 `gh auth token`

### 只想用 PAT（不装 gh）

1. 打开 [Personal access tokens](https://github.com/settings/tokens)  
2. 勾选 **`repo`**（或 fine-grained 对图床仓库 Contents 读写）  
3. 复制 `ghp_…` 后写入环境变量 `PICBED_GITHUB_TOKEN`（**不要**写进 `picbed.toml`）

不需要注册 OAuth App，也没有 `login`/`logout` 命令。

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
| `ui` | 启动本地 Web 控制台（拖拽工作台） |
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

见 [`docs/features-index.md`](docs/features-index.md)：F1–F22 全部已实现。

## 本地 Web 控制台（F16–F22）

```bash
picbed ui
# → http://127.0.0.1:4780
```

浏览器打开后：**先绑定扫描根目录** → 拖入 md/html 文档 → plan 预览 → 确认后 sync。另含回滚、配置/doctor、run 审计、watch 控制台。默认只监听本机；token 不会出现在页面里。

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
