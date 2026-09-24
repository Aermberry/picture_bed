# Secret Requirements

Names, sources, scopes, owners only — never values.

| name | source | scope | owner | notes |
|------|--------|-------|-------|-------|
| GitHub CLI auth (`gh`) | system keyring / `gh auth login` | `repo`, `gist`, `read:org`, `workflow` | local developer (Aermberry) | Used for remote create/push; no token stored in repo |
| `PICBED_GITHUB_TOKEN` | user env (PAT) | `repo` or fine-grained Contents R/W | local developer / agent | Highest auth priority for picbed; never write to tracked files |
| `GITHUB_TOKEN` | user env (PAT, optional fallback) | same as above | local developer / agent | Fallback when PICBED_* unset |
| `gh` auth token | GitHub CLI keyring (`gh auth login`) | `repo` (and whatever gh holds) | local developer | Fallback via `gh auth token`; no secret in picbed |
| `NPM_TOKEN` | npmjs.com Automation token | publish:picbed (automation) | local developer → GitHub Actions Secret | For `npm publish` in release.yml; **never** paste into chat/git; skip publish if unset |

OAuth App Client ID/Secret **removed** (no login command).
