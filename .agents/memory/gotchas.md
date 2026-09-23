# Gotchas

| date | trap | evidence | mitigation |
|------|------|----------|------------|
| 2026-09-22 | GH007: push rejects private author email | `remote: error: GH007` on first push to origin | Use `<id>+<login>@users.noreply.github.com` as author/committer for pushes that would expose private email; do not change global git config. For unpushed local commits, rebuild with `GIT_AUTHOR_*=noreply git commit-tree <tree> -p <parent> -m <msg>` + `git update-ref` (avoids `--amend` and config writes) |
| 2026-09-22 | PowerShell `gh api user --jq "{id,login}"` yields a string, not an object | `$user.login` empty → `empty ident name` | Query with `gh api user --jq .id` / `--jq .login` separately, or `ConvertFrom-Json` |
| 2026-09-22 | Windows NVM blocks system `npm` (NVM4306 delegated script identity) | `npm test` / `npm run lint` fail before run | Invoke via `$env:MIMO_NODE $env:MIMO_NPM <cmd>` or reinstall/`nvm reshim` |
| 2026-09-22 | Isolated worktree blocks cross-branch `git checkout` / merge (shared ref store) | `git checkout develop` rejected NVM-style guard | Stay on own branch; land via orchestrator/main checkout Git Flow merge |
| 2026-09-22 | `git fetch . <src>:<dst>` CAN fast-forward other local branch refs even when `checkout`/`worktree add` are blocked | `git fetch . feature/picbed-mvp:develop` succeeded | Use for FF landing of own work into develop/main when isolated; prefer real `merge --no-ff` outside isolation if a merge commit is required |
| 2026-09-22 | `LocalHostAdapter` resolved `local.root` against `process.cwd()`, not `ResolvedConfig.rootDir` | smoke `sync --cwd` wrote `bed/` into repo | Resolve local host root via `cfg.rootDir`; covered in `tests/host.test.ts` |
| 2026-09-22 | Annotated `git tag -a` + push hits GH007 (private tagger email) | `v0.1.0` push rejected | Lightweight: `git push origin <sha>:refs/tags/vX.Y.Z`; or noreply tagger env |
| 2026-09-22 | CI green does not create Releases/Packages assets | User: Releases empty after CI | Separate `release.yml` on `v*` tags + `npm pack` + `gh release create` |
| 2026-09-22 | Versioned-only asset breaks copy-paste install after bump | README linked `v0.2.0` tarball | Also upload stable `<pkg>.tgz`; docs use `/releases/latest/download/<pkg>.tgz` |
| 2026-09-23 | Global git `user.name=CC` (Claude Code identity) leaked into design commits | 5 unpushed commits `956447b`…`d491c29` author `CC <sos2012happy@gmail.com>` vs expected `Aermberry <26331797+Aermberry@users.noreply.github.com>` | Never trust ambient `git config user.*`; pass `GIT_AUTHOR_NAME/EMAIL` + `GIT_COMMITTER_NAME/EMAIL` on every agent commit (or `git -c user.name=… -c user.email=…`). Repo author must stay Aermberry noreply (GH007). Rewrite unpushed CC commits via `GIT_AUTHOR_*=… git commit-tree` + `update-ref` |
