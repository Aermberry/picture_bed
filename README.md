# picture_bed · picbed

本地 CLI：读取 Markdown / HTML 中的内嵌图片，上传到 PicX 同源 **GitHub 图床**，自动回写稳定链接。面向人与 Agent。

设计文档见 [`docs/`](docs/)（F/P/模块/AC），HTML 呈现见 [`docs/html/index.html`](docs/html/index.html)。

## 安装

**方式 0 · Windows 桌面应用（终端用户推荐，F24）**

到 [Releases](https://github.com/Aermberry/picture_bed/releases) 下载 **`picbed-setup.exe`**（稳定名，始终指向最新版），双击安装后从开始菜单启动。内置完整 Web 控制台（上传/管理/设置/规范），可「浏览…」选择扫描根目录，**无需安装 Node.js**。

> 说明：安装包暂未代码签名，Windows SmartScreen 可能提示「未知发布者」— 选「仍要运行」即可。开发调试：`npm install && npm run desktop:dev`；出安装包：`npm run desktop:dist`。

**方式 1 · Release 包（CLI / 开发者，永远装最新）**

```powershell
npm install -g https://github.com/Aermberry/picture_bed/releases/latest/download/picbed.tgz
```

说明：`/releases/latest/download/picbed.tgz` 会**自动指向最新 Release** 的同名安装包，版本升级后无需改 README 命令，复制粘贴即可。

也可到 [Releases](https://github.com/Aermberry/picture_bed/releases) 下载带版本号的 `picbed-x.y.z.tgz` 后：

```powershell
npm install -g .\picbed-0.3.1.tgz
```

装好后可用全局命令：`picbed`、`picbed-mcp`。

**方式 2 · npm 官方源（Trusted Publishing 自动发布后可用）**

```bash
npm install -g picbed
# 或免安装：
npx picbed ui
```

发版说明：tag `v*` 触发 GitHub Release **同时**用 npm **Trusted Publishing（OIDC）** 发到官方源，**无需**长期 `NPM_TOKEN`。

**方式 3 · npx 直接跑 Release tarball（无需 npm 源）**

不写进全局依赖，直接跑 Release 包（npm ≥ 7）：

```bash
npx --yes https://github.com/Aermberry/picture_bed/releases/latest/download/picbed.tgz ui
```

其它子命令同理，参数接在包后面：

```bash
npx --yes https://github.com/Aermberry/picture_bed/releases/latest/download/picbed.tgz doctor --json
npx --yes https://github.com/Aermberry/picture_bed/releases/latest/download/picbed.tgz plan ./docs
```

也可先下载再 npx：

```powershell
Invoke-WebRequest -Uri https://github.com/Aermberry/picture_bed/releases/latest/download/picbed.tgz -OutFile picbed.tgz
npx --yes .\picbed.tgz ui
```

```bash
curl -L -o picbed.tgz https://github.com/Aermberry/picture_bed/releases/latest/download/picbed.tgz
npx --yes ./picbed.tgz ui
```

> **说明**：若 npm 源尚未同步到当前版本，可用下方 tarball 的 `npx` / `npm install -g …/picbed.tgz`。不要用未注册前的裸名 `npx picbed`。

**方式 4 · 从源码**

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

见 [`docs/features-index.md`](docs/features-index.md)：F1–F24（F24 = 桌面应用壳与安装包）。

## 本地 Web 控制台（F16–F23）

```bash
picbed ui
# → http://127.0.0.1:4780
```

浏览器打开后：**先绑定扫描根目录** → 拖入 md/html 文档 → plan 预览 → 确认后 sync。另含回滚、配置/doctor、run 审计、watch 控制台。默认只监听本机；token 不会出现在页面里。

## 桌面应用（F24 · 双形态）

| 形态 | 命令 / 安装 | 适用 |
|------|-------------|------|
| **npm** | `npm i -g picbed` / `picbed ui` | 本地开发、测试、Agent、CLI |
| **桌面** | 安装包 `picbed-setup.exe` | 终端用户下载安装即用 |

- 桌面端复用**同一**核心与 Web 控制台（契约、confirm、token 掩码不变）。
- 额外原生能力：系统目录选择对话框（「浏览…」）、窗口尺寸记忆。
- Electron 仅在 `devDependencies`，**不会**随 `npm i -g picbed` 安装。

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
