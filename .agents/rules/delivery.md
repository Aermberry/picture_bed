# Delivery rules

status=active
reviewed_at=2026-09-22
source: user standing instruction (picture_bed session, 2026-09-22)

## Design before implementation (MANDATORY)

Every behavioral change to code **must** land design updates first, then implement:

1. Update the design pack **before** writing application code:
   - `docs/features-index.md` (F/AC definition authority)
   - relevant `docs/design/module-*.md` / `cross-cutting.md`
   - `docs/architecture.md` when layering/constraints change
   - `index.html` when the HTML design presentation would go stale
2. Then implement `src/**` + tests to match the revised design.
3. Do not ship code whose behavior is not described in the design pack (or an explicit, dated exception noted in changelog + open-items).

Evidence: user standing instruction, 2026-09-22（「每次在改动代码的实现时，都必须要先修改设计文档，然后再做代码实现」）.

## Commit after every change

After each completed modification, create a corresponding Git commit so work can be tracked and rolled back.

## Tests before delivery

After each change, write or update related tests. Before delivering results to the user, ensure all tests and validation pass. If no test runner exists yet, state the validation actually run and do not claim untested success.

## Docs/design dedicated branch

Design documentation belongs on branch `docs/design` (created from design freeze `efa3fb7`). **Must** land design-doc changes on `docs/design` first (or in the same change set as a design-only commit parented on `docs/design`); implementation stays on `feature/*` with Git Flow merges to `develop`/`main`. Sync design snapshots into release branches when freezing milestones.

Under isolated worktree (no `checkout`): build a design-only commit with `GIT_INDEX_FILE` + `read-tree docs/design` + `update-index` design paths + `commit-tree -p docs/design`, then `git fetch . <sha>:docs/design`.

Evidence: user message 2026-09-22; also recorded in project MEMORY.md (originally 2026-09-19 my_gallery).
