# Open Items

| date | item | status | next action |
|------|------|--------|-------------|
| 2026-09-22 | Choose stack and confirm product scope for picture_bed | **closed** | Done: TypeScript ESM CLI **picbed**; product = GitHub image-host pipeline |
| 2026-09-22 | Add stack-specific `.gitignore` / tooling when stack known | **closed** | Done: node/ts/vitest tooling + README env vars |
| 2026-09-22 | Expand `README.md` beyond stub | **closed** | Done: usage, login, commands, exit codes, Agent examples |
| 2026-09-22 | Define validation commands (test/lint/build) | **closed** | Done: `npm test` / `npm run lint` / `npm run build` (15/15 tests pass) |
| 2026-09-22 | Merge `feature/picbed-mvp` → `develop`/`main` | **done (local)** | Landed via `git fetch . feature/picbed-mvp:develop` + `git fetch . develop:main` (FF to `e58cb42`); `docs/design` stays at design freeze `efa3fb7` |
| 2026-09-22 | Push `develop`/`main` to origin | **closed** | Pushed `feature/picbed-mvp` + `develop` + `main` at `e9a61ff` |
| 2026-09-22 | F12 watch / F13 multi-host / F14 VS Code-MCP | **closed** | Implemented on `feature/picbed-mvp`: F13 host factory+local, F12 watch, F14 picbed-mcp |
| 2026-09-22 | Optional: CI workflow | **closed** | `.github/workflows/ci.yml`: lint+build+test on Node 20/22 |
| 2026-09-22 | GitHub Release on tag `v*` | **closed** | `release.yml` + tag `v0.1.0` → Release with `picbed-*.tgz` |
| 2026-09-22 | GitHub Packages (npm) publish | **closed** | User: not needed; Releases tarball only |
| 2026-09-23 | Delete merged topic branches | **open** | User main checkout: `feature/design-html-path` `feature/process-notes` `docs/html-layout`（已合）；`feature/yigecli-mvp` 不再开发后删；本地+`git push origin --delete` |
| 2026-09-23 | F16–F22 本地 Web 控制台（拖拽工作台） | **design only** | 设计已进 docs/design→develop；待开放问题拍板后再实现 |
| 2026-09-23 | Web 子命令名 `ui` | **closed** | 用户确认 `ui`（无 `serve` 别名） |
| 2026-09-23 | Web 开放问题：前端栈、拖拽无 root 策略、watch 默认模式 | **open** | 实现前确认（architecture.md §11.8–10） |
