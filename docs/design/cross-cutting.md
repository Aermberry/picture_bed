# 横切约定（cross-cutting）

> 全局契约：术语对齐、退出码、JSON 信封、密钥、路径安全、测试与验证。
> 与 [`../architecture.md`](../architecture.md)、[`../features-index.md`](../features-index.md) 及 `module-*.md` 配合阅读。

## 0. 术语对齐

| 术语 | 含义 |
|------|------|
| 图床 | GitHub 仓库文件托管 + 公开 URL（PicX 同源模型） |
| Asset | 本地图片（内容哈希标识） |
| ImageRef | 文档内一条可替换的 URL 引用（含偏移） |
| RemoteImage | 上传后的公开 URL 与远端路径 |
| Manifest | local/raw/sha/url 映射（无 secret） |
| Agent 模式 | `--json` + 非 TTY + 退出码契约 |
| Web 控制台 | 本机 HTTP UI（F16–F22）；写操作需 `confirm` |
| 工作集 | UI 会话内选中的文档/根（经拖拽或路径解析到真实 FS） |

## 1. 退出码（全局）

| Code | 含义 | 典型 |
|------|------|------|
| 0 | 成功 | 含 0 变更 |
| 1 | 通用失败 | 未分类 |
| 2 | 用法错误 | 参数非法 |
| 3 | 配置/鉴权 | 缺 token、doctor 失败 |
| 4 | 本地文件 | 缺失、越界 |
| 5 | 远端 API | 4xx/5xx、限流 |
| 6 | 部分成功 | 部分文档失败 |
| 7 | 需要确认 | 无 `--yes` 且将写文件；Web 写操作缺 `confirm` |

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

失败时 `ok=false`，`error`: `{ code, message, path?, hint? }`。  
**禁止**在 message/warnings 中包含 token 明文。  
Web API 使用**同一信封**（`command` 为 `api.*`）；HTTP 状态码可映射退出码语义（409≈7、403/401≈3、404/400≈2/4），**以信封 `error.code` 为准**。

## 3. 密钥纪律

- 名称：`PICBED_GITHUB_TOKEN` / `GITHUB_TOKEN`；或复用 `gh auth token`（无 OAuth Client Secret）。  
- 范围：仅图床仓库 Contents RW（scope `repo` 或 `public_repo`）。  
- 禁止：写入 git 跟踪文件、manifest、backup、runs、日志、JSON data。  
- 展示：掩码 `ghp_****` 或 `****`；Web **无**「显示原文」。  
- 优先级：`PICBED_GITHUB_TOKEN` > `GITHUB_TOKEN` > `gh auth token`。  
- Web：token 仅在服务进程内存；任何 API/页面/SSE 不得携带 secret。

## 4. 路径与 FS 安全

- 相对路径相对**文档目录**解析。  
- 拒绝：逃逸扫描根、默认绝对路径与 `file://`。  
- 文档回写原子（tmp+rename）；图片字节只读。  
- Windows/POSIX 路径在 Resolver 归一。  
- Web 拖拽：浏览器相对线索须在**已绑定 root** 下解析为真实路径；失败进 `blocked`，禁止只改暂存副本却声称已回写。

## 5. 测试与验证对齐

| 层 | 对齐 F |
|----|--------|
| 单测：extract/resolve/rewrite | F4 F5 F8 |
| 契约测：HostAdapter mock | F7 |
| CLI 集成：退出码 + JSON | F10 |
| e2e：fixture 目录 sync | F6–F9 |
| Web API：信封 + confirm + 掩码 + health | F16 F18 F20 |
| Web 工作台：拖拽解析 / plan 分组 / dry-run 无副作用 | F17 |
| Web revert / runs / watch 启停 | F19 F21 F22 |
| 设计文档校验 | 交付前 `scripts/validate-*.ps1` |

规则：**每次改动须有相关测试/验证，全部通过才交付**；无测试框架时必须写明实际验证命令与结果。

## 6. 命令一览（契约索引）

`init` `doctor` `scan` `plan` `sync` `upload` `revert` `config` `ui`  
全局旗标：`--json --quiet --verbose --config --cwd --yes --dry-run`  
Web API：`/api/health|config|doctor|scan|plan|sync|manifest|revert|runs|watch/*`（见 module-webui）

*与 module / features 冲突时：定义看总表，实现细节看 module，全局形态看本文。*
