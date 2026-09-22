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
| 7 | 需要确认 | 无 `--yes` 且将写文件 |

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

## 3. 密钥纪律

- 名称：`PICBED_GITHUB_TOKEN` / `GITHUB_TOKEN`；OAuth 另有 `PICBED_GITHUB_CLIENT_ID`、`PICBED_GITHUB_CLIENT_SECRET`。  
- OAuth 用户 token 存用户级凭据文件（非仓库），权限 0600。  
- 范围：仅图床仓库 Contents RW（scope `repo` 或 `public_repo`）。  
- 禁止：写入 git 跟踪文件、manifest、backup、日志、JSON data。  
- 展示：掩码 `ghp_****` 或 `****`。  
- 优先级：ENV PAT > 用户凭据文件 OAuth token。

## 4. 路径与 FS 安全

- 相对路径相对**文档目录**解析。  
- 拒绝：逃逸扫描根、默认绝对路径与 `file://`。  
- 文档回写原子（tmp+rename）；图片字节只读。  
- Windows/POSIX 路径在 Resolver 归一。

## 5. 测试与验证对齐

| 层 | 对齐 F |
|----|--------|
| 单测：extract/resolve/rewrite | F4 F5 F8 |
| 契约测：HostAdapter mock | F7 |
| CLI 集成：退出码 + JSON | F10 |
| e2e：fixture 目录 sync | F6–F9 |
| 设计文档校验 | 交付前 `scripts/validate-*.ps1` |

规则：**每次改动须有相关测试/验证，全部通过才交付**；无测试框架时必须写明实际验证命令与结果。

## 6. 命令一览（契约索引）

`init` `doctor` `scan` `plan` `sync` `upload` `revert` `config`  
全局旗标：`--json --quiet --verbose --config --cwd --yes --dry-run`

*与 module / features 冲突时：定义看总表，实现细节看 module，全局形态看本文。*
