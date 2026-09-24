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
