# Git hooks（版本化）

按用户规则（2026-09-25）：

1. **每次 commit 后自动 push** → `post-commit`
2. **仅 release 需人工审核** → `pre-push` 拦截 `tags` / `main` / `release/*` / `hotfix/*`

## 安装（新 clone 后执行一次）

```powershell
git config core.hooksPath .githooks
```

Windows 下需保证 hook 可执行（Git for Windows 默认可跑 `sh` hook）。若被拒：

```powershell
git update-index --chmod=+x .githooks/post-commit .githooks/pre-push
```

## 放行一次 release 推送

```powershell
$env:PICBED_RELEASE_OK='1'
git push origin main
# 或 git push origin v1.2.3
Remove-Item Env:PICBED_RELEASE_OK
```

## 边界

- `git commit-tree` **不触发 hook**；隔离 worktree 落地后仍须手动 `git push`。
- `post-commit` 对 `release/*`、`hotfix/*` 不自动 push。
- push 失败只告警，不阻塞 commit。
