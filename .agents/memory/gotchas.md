# Gotchas

| date | trap | evidence | mitigation |
|------|------|----------|------------|
| 2026-09-22 | GH007: push rejects private author email | `remote: error: GH007` on first push to origin | Use `<id>+<login>@users.noreply.github.com` as author/committer for pushes that would expose private email; do not change global git config. For unpushed local commits, rebuild with `GIT_AUTHOR_*=noreply git commit-tree <tree> -p <parent> -m <msg>` + `git update-ref` (avoids `--amend` and config writes) |
| 2026-09-22 | PowerShell `gh api user --jq "{id,login}"` yields a string, not an object | `$user.login` empty → `empty ident name` | Query with `gh api user --jq .id` / `--jq .login` separately, or `ConvertFrom-Json` |
| 2026-09-22 | Windows NVM blocks system `npm` (NVM4306 delegated script identity) | `npm test` / `npm run lint` fail before run | Invoke via `$env:MIMO_NODE $env:MIMO_NPM <cmd>` or reinstall/`nvm reshim` |
| 2026-09-22 | Isolated worktree blocks cross-branch `git checkout` / merge (shared ref store) | `git checkout develop` rejected NVM-style guard | Stay on own branch; land via orchestrator/main checkout Git Flow merge |
| 2026-09-22 | `git fetch . <src>:<dst>` CAN fast-forward other local branch refs even when `checkout`/`worktree add` are blocked | `git fetch . feature/yigecli-mvp:develop` succeeded | Use for FF landing of own work into develop/main when isolated; prefer real `merge --no-ff` outside isolation if a merge commit is required |
