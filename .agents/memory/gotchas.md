# Gotchas

| date | trap | evidence | mitigation |
|------|------|----------|------------|
| 2026-09-22 | GH007: push rejects private author email | `remote: error: GH007` on first push to origin | Use `<id>+<login>@users.noreply.github.com` as author/committer for pushes that would expose private email; do not change global git config |
| 2026-09-22 | PowerShell `gh api user --jq "{id,login}"` yields a string, not an object | `$user.login` empty → `empty ident name` | Query with `gh api user --jq .id` / `--jq .login` separately, or `ConvertFrom-Json` |
