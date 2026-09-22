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

## 快速开始

```bash
node bin/yigecli.js init
# 编辑 yigecli.toml：github.owner / github.repo / github.branch / github.dir
export YIGE_GITHUB_TOKEN=ghp_xxx

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
| `doctor` | 配置 / token / API 自检 |
| `scan <path>` | 扫描文档与图片引用 |
| `plan <path>` | 生成上传计划（不写不传） |
| `sync <path>` | 上传并回写链接 |
| `upload <file>` | 单文件上传 |
| `revert <path>` | 按 manifest 还原本地链接 |
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

见 [`docs/features-index.md`](docs/features-index.md)：F1–F11 已实现（P0/P1），F12–F14 为 P3 backlog。
