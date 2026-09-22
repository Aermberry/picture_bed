# Secret Requirements

Names, sources, scopes, owners only — never values.

| name | source | scope | owner | notes |
|------|--------|-------|-------|-------|
| GitHub CLI auth (`gh`) | system keyring / `gh auth login` | `repo`, `gist`, `read:org`, `workflow` | local developer (Aermberry) | Used for remote create/push; no token stored in repo |
| `PICBED_GITHUB_TOKEN` | user env (PAT) | `repo` or fine-grained Contents R/W | local developer / agent | Highest auth priority for picbed; never write to tracked files |
| `PICBED_GITHUB_CLIENT_ID` | GitHub OAuth App env | OAuth App identity | local developer | Required for `login`; mask in output |
| `PICBED_GITHUB_CLIENT_SECRET` | GitHub OAuth App env | OAuth App secret | local developer | Required for `login`; mask in output |
| OAuth access token (stored) | `~/.config/picbed/credentials.json` | same as PAT used for Contents | local user | User-level file mode 0600; not in repo; cleared by `logout` |
