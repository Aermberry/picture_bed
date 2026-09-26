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
| 2026-09-23 | 拖拽无 root 策略 | **closed** | 用户选 A：强制先绑根；无暂存预览 |
| 2026-09-23 | Web 前端栈 / watch 默认模式 | **closed** | 采纳建议：轻量 Vite + 原生 SPA；watch 默认 `preview` |
| 2026-09-23 | F16–F18 本地 Web 控制台实现 | **closed** | `picbed ui` + 拖拽工作台 + confirm sync；33/33 tests；feature/f16-webui → develop |
| 2026-09-23 | F19–F22 Web 面板 | **closed** | revert/config-doctor/runs/watch；39/39 tests |
| 2026-09-24 | Commit OpenSpec scaffold + openspec dep | **closed** | 现落在 `docs/openspec`（`236ad43`/`5f66a40` + config）；曾误堆 `feature/npm-publish` |
| 2026-09-24 | Push `docs/openspec` / merge → `develop` | **closed** | `docs/openspec` pushed；merge `43fc1bc` on `develop`，已推 origin |
| 2026-09-24 | Delete `Aermberry/feat-openspec-init` | **blocked** | snaggletooth worktree 有未提交改动（`openspec/`、`.claude/`）；确认后再 worktree remove + branch -D |
| 2026-09-24 | Clean `feature/npm-publish` OpenSpec add/remove | **blocked** | 目标 `git branch -f feature/npm-publish 5a160cf`；本 worktree 禁止跨分支改 ref。需主 checkout / 用户执行。OpenSpec 已在 `docs/openspec` |
| 2026-09-25 | npm Trusted Publishing for `picbed` | **open** | v0.3.2 GitHub Release 成功；`npm publish` E404。需在 npmjs.com 配 Trusted Publisher → Aermberry/picture_bed + `release.yml`，然后重跑 workflow 或发 v0.3.3 |
| 2026-09-25 | F23 Web 控制台壳层与视觉重设计 | **closed** | 用户 UI 方案（晨雾蓝×落日暖四视图）已实现于 `src/ui/static.ts`；40/40 tests；设计包已同步 |
| 2026-09-27 | 评审修复 ① 应用编排层（单一实现） | **closed** | `docs/design/module-app.md`（`38d83f3`/`f8e23c9`）+ `src/app/*`（`5a186e8`）+ CLI 委托；58/58 tests、lint 干净 |
| 2026-09-27 | 评审修复 ② `src/ui/static.ts` 1282 行内联 SPA 出模板串 | **open** | next：先定构建方式（§7.1 冻结 Vite + 原生 SPA，还是最小方案「独立 app.js + 静态服务」），需与用户确认后再开 feature 分支；保留 `new Function` 语法守卫测试（`tests/desktop.test.ts`） |
| 2026-09-27 | 评审修复 ③ `src/ui/server.ts` HTTP 加固 | **open** | next：Origin/Host 校验 + 写接口必需自定义头 + `readBody` 大小上限 + Content-Type 校验；先出设计文档再实现 |
| 2026-09-27 | 残留（评审 2）：TOML 正则写入不转义值中的 `"`/换行 | **open** | 现有受支持 key 均为无引号值，暂不阻塞；若新增自由文本 key（如 customTemplate）需先修转义或换 TOML 库 |
