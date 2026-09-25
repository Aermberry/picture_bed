# Decisions

| date | decision | evidence / rationale | status |
|------|----------|----------------------|--------|
| 2026-09-22 | Default branch `main` | User accepted GitHub remote create+push flow | active |
| 2026-09-22 | Public GitHub remote `Aermberry/picture_bed` | User chose Public | active |
| 2026-09-22 | Commit author uses GitHub noreply for this repo's init commit | GH007 email privacy on push; no global git config change | active |
| 2026-09-22 | Bootstrap `.agents/` per AgentGo v1.15.1 | User requested initialize per downloaded AGENTS.md | active |
| 2026-09-22 | Design method captured as global skill `project-design` (F-P-module-AC) | User asked for sustainable, improvable skill from this design pass | active |
| 2026-09-22 | Definition authority = features-index; domain rules = module-*; global contracts = cross-cutting | Avoid dual AC definitions; enforce bidirectional links | active |
| 2026-09-22 | Stack: TypeScript ESM + Node ≥ 20 + commander + vitest + tsc | Implemented picbed MVP; validation scripts in package.json | active |
| 2026-09-22 | Product: local CLI extract→GitHub image host→rewrite; Agent `--json` contract | README + features-index F1–F15 | active |
| 2026-09-23 | **Git Flow: one `feature/<topic>` per feature point** | User standing instruction; F12–F14 historically piled on one branch (violation) | active |
| 2026-09-22 | **Process: design pack first, then code** | User standing instruction; recorded in `.agents/rules/delivery.md` | active |
| 2026-09-22 | Auth: `PICBED_GITHUB_TOKEN` > `GITHUB_TOKEN` > `gh auth token`; **OAuth login removed** | User: OAuth App too heavy to distribute | active |
| 2026-09-22 | Impl on `feature/yigecli-mvp` (CLI name now `picbed`; branch rename blocked in isolated worktree); design freeze `efa3fb7` on `docs/design`/`develop`/`main` | delivery.md branch model | active |
| 2026-09-22 | Freeze CLI/package name as **`picbed`** (renamed from `yigecli`) | User chose `picbed`; config `picbed.toml`, state `.picbed/`, env `PICBED_*`, bins `picbed`/`picbed-mcp` | active |
| 2026-09-23 | Freeze Web 子命令名为 **`ui`**（非 `serve`，无别名） | User: 「ui」 | active |
| 2026-09-23 | Web 拖拽路径策略 **A：强制先绑 root** | User: 「A」；无暂存预览（策略 B 不纳入） | active |
| 2026-09-23 | Web 前端 **轻量 Vite + 原生 SPA**；watch 默认 **`preview`** | User: 「按照你的建议即可」 | active |
| 2026-09-23 | npm 发布用 **Trusted Publishing (OIDC)**，不用长期 token | User: 「A」；Classic Token 已移除；workflow `release.yml` + `id-token: write` | active |
| 2026-09-24 | **保留 OpenSpec**，落在独立分支 `docs/openspec`；`config.yaml` 对齐 F/P/AC 与 design-first | User 选 2；规格权威仍是 `docs/features-index.md`，OpenSpec 只做 change 工作流 | active |
| 2026-09-25 | **F23 UI 壳层**：72px 侧栏四视图「上传/管理/设置/规范」；主题「晨雾蓝 × 落日暖」 | 用户交付《图床工具-UI方案.html》+《设计交付规范》覆盖早前 2 项草图；已实现 `src/ui/static.ts` | active |
| 2026-09-25 | **Commit 后自动 push；release 才需审核** | User: 「每次执行git-commit后，自动执行推送；只有在执行release时，才需要我的审核」；写入 `.agents/rules/delivery.md` | active |
| 2026-09-26 | 发版经验沉淀为项目 skill 
pm-oidc-release（非全局） | User 要求项目内可复用；含 OIDC/npm11.5/NODE_AUTH_TOKEN 分层排障 | active |
| 2026-09-26 | UI design/impl skill ui-spec-impl (project only) | pairs with npm-oidc-release | active |
