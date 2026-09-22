# Delivery rules

status=active
reviewed_at=2026-09-22
source: user standing instruction (picture_bed session, 2026-09-22)

## Commit after every change

After each completed modification, create a corresponding Git commit so work can be tracked and rolled back.

## Tests before delivery

After each change, write or update related tests. Before delivering results to the user, ensure all tests and validation pass. If no test runner exists yet, state the validation actually run and do not claim untested success.

## Docs/design dedicated branch

Design documentation belongs on branch `docs/design` (created from design freeze `efa3fb7`). Prefer landing design-doc changes on `docs/design`; implementation stays on `feature/*` with Git Flow merges to `develop`/`main`. Sync design snapshots into release branches when freezing milestones.

Evidence: user message 2026-09-22; also recorded in project MEMORY.md (originally 2026-09-19 my_gallery).
