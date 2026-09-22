# transfer 模块详细设计

> 归属功能点：F6 上传计划 plan、F7 GitHub 图床上传、F11 单文件上传。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；ingest 见 [`module-ingest.md`](module-ingest.md)；横切见 [`cross-cutting.md`](cross-cutting.md)。
> 栈无关；Host 细节可替换（F13 backlog）。

## 目的

transfer 将 ingest 产出的 `Asset` 变为可写回的 `RemoteImage`：先形成**可预览计划**，再经 **GitHub Contents API**（PicX 同源模型）上传，并按 URL 风格生成公开链接。只读缓存决定跳过，保证幂等。

边界原则：
- **不改文档文本**（rewrite 职责）。
- **不读目录发明引用**（ingest 职责）；可接受单文件路径（F11）。
- Token 仅在适配器边界注入，不进入领域结果对象。

## 模块文件夹结构（栈无关）

```
transfer/
├─ domain/
│  ├─ cqe/          # BuildPlanQuery、UploadAssetsQuery、UploadOneQuery
│  ├─ entity/       # SyncPlan、SyncPlanItem、RemoteImage
│  ├─ service/      # PlanBuilder、UrlComposer、UploadScheduler
│  ├─ port/         # HostAdapter <<interface>>
│  └─ facade/       # TransferFacade
├─ packages/        # 防腐层：GitHubHostAdapter（Contents API）
└─ exceptions/      # UploadFailedError、RateLimitedError、HostAuthError
```

## 端口

```
HostAdapter
  exists(repoPath): boolean|sha
  putFile(repoPath, bytes, message, branch): RemoteRef
  # 实现负责 base64、sha 更新语义、HTTP 重试策略上层可配
```

## 数据

```
SyncPlanItem { action: upload|skip-cache|skip-remote|rewrite-only|blocked,
               asset?, remote?, reason? }
RemoteImage  { publicUrl, rawUrl, cdnUrl?, repoPath, sha256 }
```

## F6 上传计划 plan

分类规则：
| 条件 | action |
|------|--------|
| manifest/cache 命中且策略允许复用 | `skip-cache` |
| ref 已是 http(s) | `skip-remote` |
| 本地 Asset 合法 | `upload` |
| 解析失败/越界 | `blocked` |
| 已远程、仅需替换（可选策略） | `rewrite-only` |

`plan` 与 `sync --dry-run` **不得**调用 `putFile`。

## F7 GitHub 图床上传

- 远端路径模板：`{dir}/{yyyy}/{mm}/{sha12}-{safeName}`（可配置）。
- API：`GET contents` 探测 → `PUT contents` `{message, content: base64, branch}`；已存在同内容可 skip 或带 `sha` 更新策略（默认 skip）。
- URL（`url.style`）：
  - `raw` → `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
  - `jsdelivr` → `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}`
  - `custom` → 用户模板
- 并发默认 2–3；429/403 指数退避；耗尽 → `RateLimitedError`（退出码 5）。
- 单文件失败隔离；汇总 partial（退出码 6）。

## F11 单文件上传

- `upload <file>`：resolve 单文件 → 与 F7 同一适配器与 UrlComposer → 输出 `publicUrl`。
- 可选写入 manifest 以便后续 sync 复用。

## 功能点映射

| F | 本模块章节 |
|---|------------|
| [F6](../features-index.md#f6-上传计划-plan) | §F6 |
| [F7](../features-index.md#f7-github-图床上传) | §F7 |
| [F11](../features-index.md#f11-单文件上传) | §F11 |

*AC 以 features-index 为准；HTTP 形状以本模块 + cross-cutting 为准。*
