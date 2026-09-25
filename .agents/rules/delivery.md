# Delivery rules

status=active
reviewed_at=2026-09-23
source: user standing instruction (picture_bed session, 2026-09-22/23)

## Git Flow (MANDATORY)

Follow Git Flow for all product work. **One feature point / one coherent change set = one `feature/*` branch.**

| Branch | From | Purpose | When to merge |
|--------|------|---------|----------------|
| `feature/<topic>` | `develop` | **产品实现**一个功能点（如 `feature/f13-multi-host`） | 测试完成后 → `develop` |
| `docs/<topic>` | `develop` 或 `docs/design` | **纯文档/设计**变更（如 `docs/html-layout`） | 设计/文档完成后 → `develop` |
| `docs/design` | design freeze | 设计文档主线 | 设计修订后；里程碑再快照进 release |
| `develop` | — | 功能集成 | — |
| `main` | `develop` | 发布 | Git Flow 发布合并 / FF |
| `release/*` / `hotfix/*` | `develop`/`main` | 发布/热修 | 按 Git Flow |

Rules:
1. **禁止**把多个不相关功能点堆进同一长期 `feature/*`（违规示例：F12/F13/F14 全在 `feature/yigecli-mvp`）。
2. 命名：**实现**用 `feature/<topic>`；**纯文档/设计**用 `docs/<topic>`（违规示例：文档迁移用了 `feature/design-html-path`）。
3. 集成到 `develop` 前：设计已在 `docs/design` 落地（或本次即文档变更）、测试全绿。
4. 隔离 worktree 不能 `checkout` 时：仍须**逻辑上**按 topic 分支；可用 `git commit-tree` / `git fetch . <sha>:refs/heads/feature/<topic>` 创建，或明确记录「本环境无法建分支」并合并前由主 checkout 拆分。

## GitHub Release (MANDATORY when shipping)

1. **CI ≠ Release**：`ci.yml` 只验证；出包必须 **tag `v*`** 触发 `release.yml`。
2. 发版前：版本号与 tag 一致；测试绿；设计/实现已按 Git Flow 落地。
3. 资产双份：`<name>-<ver>.tgz` + 稳定名 `<name>.tgz`；README 用 `/releases/latest/download/<name>.tgz`。
4. Annotated tag 注意 GH007；隔离环境用 `git push origin <sha>:refs/tags/vX.Y.Z`。
5. 推送 `.github/workflows/**` 需要 **`workflow`** scope。
6. Packages/npmjs 另需 `npm publish`，不在 Release workflow 内。

Evidence: picture_bed v0.1.0/v0.2.0 release practice; user asked for release retrospective 2026-09-23.

## Design before implementation (MANDATORY)

Every behavioral change to code **must** land design updates first, then implement:

1. Update the design pack **before** writing application code:
   - `docs/features-index.md` (F/AC definition authority)
   - relevant `docs/design/module-*.md` / `cross-cutting.md`
   - `docs/architecture.md` when layering/constraints change
   - `docs/html/index.html`（设计 HTML 呈现）当展示会过期时——**不放仓库根**
2. Then implement `src/**` + tests to match the revised design on the **topic `feature/*` branch**.
3. Do not ship code whose behavior is not described in the design pack (or an explicit, dated exception noted in changelog + open-items).

Evidence: user standing instruction, 2026-09-22（「每次在改动代码的实现时，都必须要先修改设计文档，然后再做代码实现」）.

## Commit after every change

After each completed modification, create a corresponding Git commit so work can be tracked and rolled back.

## Push after every commit (MANDATORY)

After each `git commit` (including commit-tree landing), **immediately push** the affected branch(es) to `origin`. Do not wait for a separate user request.

- Push scope: the branch(es) just committed/merged (`docs/design`, `feature/*`, `develop`, etc.).
- **Exception — Release**: creating tags, GitHub Releases, `npm publish`, or `release/*` shipping **requires explicit user review/approval first**. Auto-push does **not** authorize release actions.
- Isolated worktree: `git push origin <branch>` or `git push origin <sha>:refs/heads/<branch>` after `git fetch .` landing.

Evidence: user standing instruction 2026-09-25（「每次执行 git-commit 后，自动执行推送；只有在执行 release 时，才需要我的审核」）.

## Tests before delivery

After each change, write or update related tests. Before delivering results to the user, ensure all tests and validation pass. If no test runner exists yet, state the validation actually run and do not claim untested success.

## Docs/design dedicated branch

Design documentation belongs on branch `docs/design`. **Must** land design-doc changes on `docs/design` first (or in the same change set as a design-only commit parented on `docs/design`); implementation stays on `feature/*` with Git Flow merges to `develop`/`main`.

**After every `docs/design` commit, merge `docs/design` → `develop`** (and keep `main` in sync via release/Git Flow). Do not leave `docs/design` unmerged: a design tip that is not an ancestor of `develop` is a process failure.

Under isolated worktree (no `checkout`): build a design-only commit with `GIT_INDEX_FILE` + `read-tree docs/design` + `update-index` design paths + `commit-tree -p docs/design`, then `git fetch . <sha>:docs/design`. For the follow-up merge into `develop`: `commit-tree -p develop -p docs/design` + `git fetch . +<merge>:develop`.

Evidence: user messages 2026-09-22/23; also recorded in project MEMORY.md.

Evidence: user message 2026-09-22; also recorded in project MEMORY.md (originally 2026-09-19 my_gallery).
