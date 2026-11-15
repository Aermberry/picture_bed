# rewrite 模块设计

> 归属功能点：F8 文档链接回写、F9 Manifest 与 revert。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；ingest 锚点见 [`module-ingest.md`](module-ingest.md)；横切见 [`cross-cutting.md`](cross-cutting.md)。

## 目的与边界

rewrite 将已有图片引用精确替换为图床 URL，并维护可审计、可回滚的 manifest。不上传、不抽取新引用、不改图片；输入是 `ImageRef` 锚点与 URL 映射。

实现落点：`src/rewrite.ts`、`src/manifest.ts`、`src/plan.ts`、`src/types.ts`。

## 数据契约

- `Manifest { version, entries }`；`ManifestEntry { doc, raw, localPath, sha256, publicUrl, updatedAt }`。
- Manifest 不得包含 token 或其他 secret。
- Manifest 合并键为 `doc+raw+localPath`；缓存命中键为 `sha256`，两者语义不可混用。

## F8 文档链接回写

- 按 `ImageRef.start/end` 从后往前做偏移切片，仅替换 URL 子串；alt、title、srcset 其他候选与周边文本保持不变。
- 回写锚点越界或偏移不匹配时报错，不扩展替换范围。
- 原地回写使用临时文件 `<target>.picbed-tmp` 后 rename；写入失败不破坏原文件。
- 默认生成 `.picbed/backup/<doc>.<ts>.bak`；`[rewrite] backup=false` 可关闭备份，无 CLI flag。

## F9 Manifest 与 revert

- 成功替换后按 `doc+raw+localPath` upsert manifest entry；同键更新 `publicUrl`。
- revert 依赖 manifest 中记录的 URL 与原始引用，不依赖 backup；只将文档中仍匹配 `publicUrl` 的子串还原为 `raw`。
- `revert --dry-run` 只报告将还原的条目，不写文档。
- Manifest 损坏抛 `ManifestCorruptError` / `E_MANIFEST_CORRUPT` 并报错，不静默清空或重建；无自动重建。

## 失败语义

单文档回写失败不阻断其他文档；部分成功以 `E_PARTIAL` 表达。Manifest 损坏在 revert 开始时显式失败并记录运行结果；原子写失败不覆盖原文件。完整错误映射见 [`module-app.md`](module-app.md)。

## 功能点映射

| F | 本模块章节 |
|---|------------|
| [F8](../features-index.md#f8-文档链接回写) | §F8 |
| [F9](../features-index.md#f9-manifest-与-revert) | §F9 |

*回写正确性 AC 以 features-index 为准。*
