# Delivery rules

status=active
reviewed_at=2026-09-23
source: user standing instruction (picture_bed session, 2026-09-22/23)

## Git Flow (MANDATORY)

Follow Git Flow for all product work. **One feature point / one coherent change set = one `feature/*` branch.**

| Branch | From | Purpose | When to merge |
|--------|------|---------|----------------|
| `feature/<topic>` | `develop` | 一个功能点 / 一次完整变更（如 `feature/f13-multi-host`） | 该 F 的设计+实现+测试完成后 → `develop` |
| `docs/design` | design freeze | 设计文档 | 设计修订后；里程碑再快照进 release |
| `develop` | — | 功能集成 | — |
| `main` | `develop` | 发布 | Git Flow 发布合并 / FF |
| `release/*` / `hotfix/*` | `develop`/`main` | 发布/热修 | 按 Git Flow |

Rules:
1. **禁止**把多个不相关功能点堆进同一长期 `feature/*`（违规示例：F12/F13/F14 全在 `feature/yigecli-mvp`）。
2. 命名：`feature/f12-watch`、`feature/f13-multi-host`、`feature/f14-mcp`… 或语义化短横线主题。
3. 集成到 `develop` 前：设计已在 `docs/design` 落地、测试全绿。
4. 隔离 worktree 不能 `checkout` 时：仍须**逻辑上**按 topic 分支；可用 `git commit-tree` / `git fetch . <sha>:refs/heads/feature/<topic>` 创建，或明确记录「本环境无法建分支」并合并前由主 checkout 拆分。

## Design before implementation (MANDATORY)

Every behavioral change to code **must** land design updates first, then implement:

1. Update the design pack **before** writing application code:
   - `docs/features-index.md` (F/AC definition authority)
   - relevant `docs/design/module-*.md` / `cross-cutting.md`
   - `docs/architecture.md` when layering/constraints change
   - `index.html` when the HTML design presentation would go stale
2. Then implement `src/**` + tests to match the revised design on the **topic `feature/*` branch**.
3. Do not ship code whose behavior is not described in the design pack (or an explicit, dated exception noted in changelog + open-items).

Evidence: user standing instruction, 2026-09-22（「每次在改动代码的实现时，都必须要先修改设计文档，然后再做代码实现」）.

## Commit after every change

After each completed modification, create a corresponding Git commit so work can be tracked and rolled back.

## Tests before delivery

After each change, write or update related tests. Before delivering results to the user, ensure all tests and validation pass. If no test runner exists yet, state the validation actually run and do not claim untested success.

## Docs/design dedicated branch

Design documentation belongs on branch `docs/design`. **Must** land design-doc changes on `docs/design` first (or in the same change set as a design-only commit parented on `docs/design`); implementation stays on `feature/*` with Git Flow merges to `develop`/`main`.

Under isolated worktree (no `checkout`): build a design-only commit with `GIT_INDEX_FILE` + `read-tree docs/design` + `update-index` design paths + `commit-tree -p docs/design`, then `git fetch . <sha>:docs/design`.

Evidence: user messages 2026-09-22/23; also recorded in project MEMORY.md.

Evidence: user message 2026-09-22; also recorded in project MEMORY.md (originally 2026-09-19 my_gallery).
