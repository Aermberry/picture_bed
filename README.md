# picture_bed · picbed

**Electron 桌面应用**：读取 Markdown / HTML 中的内嵌图片，上传到 PicX 同源 **GitHub 图床**，自动回写稳定链接。完整 Web 控制台内嵌于桌面窗口，面向终端用户。

> 形态说明（2026-11-10）：CLI / MCP / npm 发布已移除，桌面安装包是唯一分发与使用方式。历史文档中的 CLI 命令与 `picbed ui` 启动方式已失效。

设计文档见 [`docs/`](docs/)（F/P/模块/AC），HTML 呈现见 [`docs/html/index.html`](docs/html/index.html)。

## 安装

到 [Releases](https://github.com/Aermberry/picture_bed/releases) 下载 **`picbed-setup.exe`**（稳定名，始终指向最新版），双击安装后从开始菜单启动。内置完整 Web 控制台（上传/统计/图库/设置/规范），可「浏览…」选择扫描根目录，**无需安装 Node.js**。

> 说明：安装包暂未代码签名，Windows SmartScreen 可能提示「未知发布者」— 选「仍要运行」即可。

## 环境（仅开发需要）

- Node.js ≥ 20
- GitHub 访问令牌（PAT）或已登录的 GitHub CLI（`gh`）——应用内「设置」页可粘贴 PAT

## 构建与测试（开发）

```bash
npm install
npm run desktop:dev    # 开发调试：electron-vite HMR（改 renderer/* 即时生效）
npm test               # vitest 全量用例
npm run desktop:dist   # 出 picbed-setup.exe
```

## 源码组织

| 目录 | 内容 | 构建 | 去哪 |
|------|------|------|------|
| `src/` | UI 服务器 + app 编排 + 领域核心（TypeScript） | `tsc` → `dist/` | **桌面包**（`dist/ui/index.js` 是 Electron 后端唯一入口） |
| `renderer/` | Web 控制台前端 F16–F25（浏览器原生 ESM，零构建） | 无 | 桌面包；Electron 窗口经 UI 服务器静态下发 |
| `desktop/` | Electron 壳 | `electron-vite` → `out/` | 桌面包 |
| `scripts/` | 构建 / 巡检工具 | `node` 直跑 | 仓库本地 / CI |
| `tests/` | vitest 用例 | — | 仓库本地 |

改了目录或 `package.json` 的 `files` / `exports` 之后，跑 `npm run validate:pack`（需先 `npm run build`）确认打包面没跑偏。详见 [`docs/architecture.md`](docs/architecture.md) §2.4。

## 鉴权（无 OAuth App）

GitHub 图床需要 **访问令牌（token）**，两种方式（优先级从高到低）：

1. **应用内粘贴**：「设置」页 PAT 表单保存到本机凭据（`~/.picbed/credentials.json`，不进 git、不写 `picbed.toml`）。
2. **复用 GitHub CLI**：`gh auth login` 后 picbed 自动调用 `gh auth token`。

### 只想用 PAT（不装 gh）

1. 打开 [Personal access tokens](https://github.com/settings/tokens)
2. 勾选 **`repo`**（或 fine-grained 对图床仓库 Contents 读写）
3. 复制 `ghp_…` 粘贴进应用「设置」页

不需要注册 OAuth App。

## 快速开始（应用内）

启动桌面应用后：

1. 「设置」页填 owner / repo / branch / dir（或先 `gh auth login` / 粘贴 PAT），可用「自检」验证连通。
2. 「上传」视图拖入图片或 md/html 文档（不接受文件夹）→ 自动扫描 → **照片墙**展示已解析图片（可继续拖入累加；点选可批量删除）。有图后才出现「上传」「重置」：上传需确认后 sync，重置清空。
3. 「统计」视图展示图床用量（总计、今天/过去7天环比/连续天数/最忙一天、年历热力图、时段分布）。
4. 另含「图库」（远端目录浏览/批量删除）、回滚、run 审计、watch。

扫描根随投放自动切换：拖入的文件若不在当前根内，根会重绑到该文件所在目录并清空先前照片墙（跨目录自动跟手，无需重启）。文档里的图片若**早已上传并改写为远程链接**，扫描后提示「已是远程链接，无需上传」——这不是故障。

图片格式白名单：`png` `jpg` `jpeg` `gif` `webp` `avif` `bmp` `ico` `svg`。其中 **SVG 按原字节上传**（不做消毒、不转码，去重仍按文件 `sha256`）；控制台预览用它自己的 `<img>` 上下文渲染，不会执行 SVG 内脚本。

## 功能点

见 [`docs/features-index.md`](docs/features-index.md)：F1–F25（F24 = 桌面应用壳与安装包；F25 = 使用统计视图）。CLI / MCP 相关的 F10 / F14 已于 2026-11-10 移除。

## 桌面应用（F24）

- 桌面端复用核心与 Web 控制台（契约、confirm、token 掩码不变）。
- 额外原生能力：系统目录选择对话框（「浏览…」）、窗口尺寸记忆。
- Electron / electron-vite 仅在 `devDependencies`。

### 开发调试与打包

```bash
npm install
npm run desktop:dev    # electron-vite：改 renderer/* 即时 HMR
npm run desktop:dist   # 出 picbed-setup.exe
```

UI 单源在 `renderer/`；开发时 Vite 热更新，安装包走同一套静态资源。详见 [`docs/design/module-desktop.md`](docs/design/module-desktop.md)。

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
