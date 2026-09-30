# Secret Requirements

Names, sources, scopes, owners only — never values.

| name | source | scope | owner | notes |
|------|--------|-------|-------|-------|
| GitHub CLI auth (`gh`) | system keyring / `gh auth login` | `repo`, `gist`, `read:org`, `workflow` | local developer (Aermberry) | Used for remote create/push; no token stored in repo |
| `PICBED_GITHUB_TOKEN` | user env (PAT) | `repo` or fine-grained Contents R/W | local developer / agent | Highest auth priority for picbed; never write to tracked files |
| `GITHUB_TOKEN` | user env (PAT, optional fallback) | same as above | local developer / agent | Fallback when PICBED_* unset |
| `gh` auth token | GitHub CLI keyring (`gh auth login`) | `repo` (and whatever gh holds) | local developer | Fallback via `gh auth token`; no secret in picbed |
| user-stored PAT | `~/.picbed/credentials.json`（可用 `PICBED_USER_TOKEN_PATH` 覆盖） | `repo` or fine-grained Contents R/W | local developer | 设置页「Token 登录」粘贴保存；不进 git / 不写 picbed.toml；API 仅回掩码 |
| `NPM_TOKEN` | ~~npmjs.com Automation token~~ | — | — | **Not used**: npm Classic tokens removed (2025-11); publish via **Trusted Publishing (OIDC)** — no long-lived token. Configure on npmjs.com package Settings → Trusted Publisher (GitHub `Aermberry/picture_bed`, workflow `release.yml`) |

OAuth App Client ID/Secret **removed** (no login command).
