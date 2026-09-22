# Secret Requirements

Names, sources, scopes, owners only — never values.

| name | source | scope | owner | notes |
|------|--------|-------|-------|-------|
| GitHub CLI auth (`gh`) | system keyring / `gh auth login` | `repo`, `gist`, `read:org` | local developer (Aermberry) | Used for remote create/push; no token stored in repo |
