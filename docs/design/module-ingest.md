# ingest 模块设计

> 归属功能点：F3 目录扫描与文档发现、F4 图片引用抽取、F5 本地资产解析与去重。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；横切见 [`cross-cutting.md`](cross-cutting.md)；上传见 [`module-transfer.md`](module-transfer.md)；编排见 [`module-app.md`](module-app.md)。

## 目的与边界

ingest 是**文档发现与图片引用入库**限界上下文：在只读前提下扫描目录、从 Markdown/HTML 抽取图片引用、解析为本地资产并按内容哈希去重，为 transfer 提供可上传的 `Asset` 集，为 rewrite 提供精确替换锚点。

- **不写文档、不写图片、不发起网络 I/O**（回写属 rewrite；上传属 transfer）。
- 对外门面：`IngestFacade`——`scanDocs` / `extractRefs` / `resolveAssets`。
- 实现落点：`src/{scan,extract,resolve}.ts`；共享底座 `src/{manifest,plan}.ts` 与 `src/lib/{doc,hash,img,inline,paths}.ts`。概念→代码映射见 [`../architecture.md`](../architecture.md) §2.5.2。

## 数据契约

```text
DocFile     { path, kind: markdown|html }
ImageRef    { docPath, raw, start, end, syntax, alt? }
Asset       { localPath, sha256, bytes, mime, refs[], data? }
              data 有值 = 文档内嵌图（data: URI）的内存字节，此时不读 localPath
BlockedItem { ref, reason, code }
```

`syntax` 取值：`md-image | md-link | html-img | html-srcset | html-source | other`。

## F3 目录扫描与文档发现

- 默认扩展名 `md,html,htm`（可配置）；遵循 ignore glob。
- 跳过 `node_modules` / `.git` / `.picbed`；不跟随 symlink 出根。
- 输出按规范化路径排序（稳定、可 diff）。
- 不可读目录 → 计入 warnings，不中断整次扫描。

## F4 图片引用抽取

- 覆盖语法：MD `![alt](url)`、URL 扩展名在图片白名单的 `[text](url)`；HTML `img[src|srcset]`、`source[src|srcset]`、`image[href|xlink:href]`。
- **代码块防护先于抽取**：fenced / 行内代码内的伪引用不产出 `ImageRef`。误改文档不可接受，这是第一道闸。
- **精确偏移是回写锚点**：每条引用携带指向 URL 子串的 `start/end`，rewrite 据此切片替换，alt/title/周边文本不动。
- 同文档重复 raw 产出多条 ref，由 F5 合并为单资产。

## F5 本地资产解析与去重

- **三个键，语义不可混用**：去重维度 = 内容 `sha256`（非路径、非引用文本）；manifest 合并键 = `doc+raw+localPath`；缓存命中键 = `sha256`。同一张图在多篇文档出现只产生一次上传。
- 相对路径相对**该文档所在目录**解析（不是扫描根），`normalize` 后做根约束校验。
- **拒绝规则**：路径逃逸出扫描根默认拒绝（可显式允许）；绝对路径与 `file://` **始终拒绝、无开关**；文件不存在 / 非白名单扩展名 → blocked。
- 已是 `http(s)://` 的引用不 resolve，留给 plan 判 `skip-remote`（ref 仍输出）。
- **`data:image/*` 内嵌图是内存资产**：base64 与 URL-encoded 均解码参与上传，与本地图同池按 `sha256` 去重；`localPath` 仅为合成占位名（`inline/<sha12>.<ext>`，用于推导远端文件名），**不落盘**到用户目录；扩展名由 MIME 反查 `IMAGE_MIME`。超限即 blocked：MIME 不在白名单（`E_INLINE_MIME`）、解码失败（`E_INLINE_DATA`）、单张 > 10 MB（`E_INLINE_TOO_LARGE`）。`[scan] inline_images`（默认 `true`）置 `false` 时退回一律 blocked；非图片 data URI 与页内锚点、空引用走 `E_SKIP_REF`。

## 失败语义

| 情况 | 行为 |
|------|------|
| 单文档解析异常 | 记入 errors，继续其它文档 |
| 单引用 blocked | 不中断；进入 plan 的 blocked 组 |
| 缺文件 | blocked：`E_ASSET_MISSING` |

## 功能点映射

| F | 本模块章节 |
|---|------------|
| [F3](../features-index.md#f3-目录扫描与文档发现) | §F3 |
| [F4](../features-index.md#f4-图片引用抽取) | §F4 |
| [F5](../features-index.md#f5-本地资产解析与去重) | §F5 |

*规则与数据以本模块为准；验收契约以 features-index AC 为准。*
