# Changelog

2026-09-22T03:45:28Z | mimo:ses_ffe5f38ce6dabffev2shZmznt5 | bootstrap | .agents/ | Created memory/, rules/, workflows/, reports/, experiments/, tmp/, archive/ and seeded memory files | AgentGo v1.15.1 Startup Instructions full pass; .agents/ was absent
2026-09-22 | create | .agents/memory/project-overview.md | Greenfield picture_bed overview, git remote, standing corrections empty | Bootstrap step c
2026-09-22 | create | .agents/memory/source-index.md | Indexed AGENTS.md, README.md, .gitignore, git | Bootstrap step c
2026-09-22 | create | .agents/memory/review-findings.md | Fast read-only review: no stack, no validation, stub README | Bootstrap step d
2026-09-22 | create | .agents/memory/open-items.md | Stack choice, gitignore, README, validation deferred | Bootstrap
2026-09-22 | create | .agents/memory/outcomes.md | Ledger for bootstrap + GH007 fix | Bootstrap
2026-09-22 | create | .agents/memory/decisions.md | Branch, visibility, noreply author, bootstrap decision | First write
2026-09-22 | create | .agents/memory/gotchas.md | GH007 + PowerShell gh jq parsing | First write
2026-09-22 | create | .agents/memory/patterns.md | Greenfield bootstrap pattern candidate | First write
2026-09-22 | create | .agents/memory/secret-requirements.md | gh auth name/scope only | First write
2026-09-22 | create | .agents/rules/delivery.md | Commit after every change; tests/validation before delivery | User standing instruction
2026-09-22 | update | project MEMORY.md | Reaffirmed commit+test rules; noted picture_bed remote | User standing instruction
2026-09-22 | create | scripts/validate-bootstrap.ps1 | Executable check for bootstrap layout and delivery rules | Tests-before-delivery rule
2026-09-22 | create | index.html, styles.css, app.js | picbed architecture and feature design (no implementation) | User requested planning only
2026-09-22 | create | scripts/validate-design.ps1 | Design section/asset validation | Tests-before-delivery rule
2026-09-22T12:05:00Z | mimo:ses_ffe5f380086ffffeYzEzHv5gNt | update | .agents/memory | Recorded F-P-module-AC design-method retrospective and global skill project-design | User asked to distill design process into continuously improvable skill
2026-09-22T17:25:00Z | mimo | update | .agents/memory/project-overview.md | Rewrote status from "no source" to picbed P0/P1 MVP on feature/picbed-mvp | Sync memory to current artifacts (user request)
2026-09-22T17:25:00Z | mimo | update | .agents/memory/source-index.md | Indexed src/, tests/, docs/design, package.json, scripts | Sync memory to current artifacts
2026-09-22T17:25:00Z | mimo | update | .agents/memory/open-items.md | Closed stack/README/validation items; open merge+P3+CI | Sync memory to current artifacts
2026-09-22T17:25:00Z | mimo | update | .agents/memory/decisions.md | Recorded stack, product, auth priority, branch model | Sync memory to current artifacts
2026-09-22T17:25:00Z | mimo | update | .agents/memory/secret-requirements.md | Added PICBED_GITHUB_TOKEN / OAuth client id+secret / stored token names only | Sync memory to current artifacts
2026-09-22T17:25:00Z | mimo | update | .agents/memory/gotchas.md | Added NVM4306 npm block + MIMO_NODE workaround | Observed this session
2026-09-22T17:25:00Z | mimo | update | .agents/memory/review-findings.md | Marked bootstrap gaps resolved post-MVP | Sync memory to current artifacts
2026-09-22T17:25:00Z | mimo | update | .agents/memory/outcomes.md | Ledger: memory sync result=corrected | Outcomes protocol
2026-09-22T17:55:00Z | mimo | update | .agents/memory/open-items.md + gotchas.md | Merge to develop/main blocked by isolated worktree; tests 15/15 on feature | User asked to follow up (Git Flow merge)
2026-09-22T18:05:00Z | mimo | update | .agents/memory/gotchas.md + outcomes.md | Documented commit-tree GH007 rewrite; pushed feature/picbed-mvp@8b2808a | User chose option 1 (push then local merge)
2026-09-22T18:20:00Z | mimo | update | .agents/memory/open-items.md + gotchas.md | Local FF land feature→develop→main at e58cb42 via git fetch . ; remote push pending network | User follow-up (1)
2026-09-22T18:30:00Z | mimo | update | .agents/memory/open-items.md | Closed push item; all three branches at e9a61ff on origin | User asked to retry push
2026-09-22T19:20:00Z | mimo | create | F12/F13/F14 implementation | Host factory+local, watch, picbed-mcp; 25/25 tests | User asked to implement backlog in order
2026-09-22T19:35:00Z | mimo | create | .github/workflows/ci.yml | lint+build+test Node 20/22 | User confirmed CI request
2026-09-22T19:55:00Z | mimo | update | .agents/memory/outcomes.md | CI push ok after gh workflow scope; f391add on origin | User completed auth setup
2026-09-22T20:30:00Z | mimo | rename | yigecli → picbed | CLI/package/config `picbed.toml`/state `.picbed/`/env `PICBED_*`/docs/MCP/bins | User chose product name picbed
2026-09-22T21:50:00Z | mimo | create | .github/workflows/release.yml + tag v0.1.0 | npm pack → GitHub Release with picbed-0.1.0.tgz | User requested Releases/Packages publishing
2026-09-22T22:10:00Z | mimo | delete | OAuth login/logout + src/login.ts | F15 becomes PAT/GITHUB_TOKEN/gh auth token only | User: OAuth too hard to distribute
2026-09-22T23:45:00Z | mimo | update | .agents/rules/delivery.md + Standing corrections | MANDATORY: update design docs before code implementation | User standing instruction
2026-09-23T00:05:00Z | mimo | update | refs/heads/docs/design @ 4300de0 | Design pack snapshot (design-only commit-tree); repair missed docs/design landings | User: design edits must use docs/design
2026-09-23T00:20:00Z | mimo | update | .agents/rules/delivery.md Git Flow | MANDATORY one feature/* per F/topic; record violation of piling F12–F14 | User: follow Git Flow feature branches
2026-09-23T00:35:00Z | mimo | merge | docs/design → develop @ b513fb7 | Join design history; FF main; rule: merge docs/design into develop after each design commit | User: was docs/design merged to develop?
2026-09-23T01:10:00Z | mimo | create/split | skill delivery-git-flow 0.1.0 | Moved Git Flow + Release out of project-design; narrowed git-github-init | User: follow skill-boundary recommendation
2026-09-23T08:20:00Z | mimo | rename | index.html/styles.css/app.js → docs/html/ | Design-first commit then move; topic feature/design-html-path | User: should index.html live at repo root?
2026-09-23T08:40:00Z | mimo | create | refs/heads/docs/html-layout @ 2807db3 | Correct prefix for pure-docs change; feature/design-html-path misnamed | User: doc work should be docs/* not feature/*
2026-09-23T12:00:00Z | mimo | create | docs F16–F22 webui design | features-index + module-webui + architecture/cross-cutting/reading-guide/html; drag-drop workbench; landed docs/design@b90bb15 → develop@85c42c8 | User: 新增 UI + 拖拽文档；本期只设计
2026-09-23T12:30:00Z | mimo | update | freeze Web CLI name `ui` | architecture open Q7 closed; module-webui startUi | User: ui
2026-09-23T12:45:00Z | mimo | update | freeze drag path policy A | force bind root before scan/plan; no staging preview | User: A
2026-09-23T13:00:00Z | mimo | update | freeze web FE stack + watch default | Vite+native SPA; watch default preview | User: 按照你的建议即可
2026-09-23T17:45:00Z | mimo | create | F16–F18 web console impl | picbed ui + RootBinder policy A + confirm sync; 33/33 tests | User: 进入实现
2026-09-23T18:30:00Z | mimo | create | F19–F22 web panels | revert/config-doctor/runs/watch; 39/39 tests | User: 继续做 P1/P2
2026-09-23T19:55:00Z | mimo | create | GitHub Release v0.3.1 | tag push → release.yml; dual assets picbed-0.3.1.tgz + picbed.tgz; v0.3.0 tag orphaned (test fail) | User: 好的（发版）
2026-09-23 | update | .agents/memory/gotchas.md + project-overview.md | Recorded global git user.name=CC leak into design commits; require explicit Aermberry noreply identity on agent commits | User reported wrong commit author
2026-09-23 | update | git history refs/heads/{develop,docs/*,feature/f16-webui} | Rewrote CC-authored commits to Aermberry noreply via filter-branch/commit-tree; restored stashed ui CLI wiring | User approved author rewrite
2026-09-23T20:10:00Z | mimo | update | README.md | Add npx tarball install/run usage (not npm registry name) | User: 在readme上补充npx用法
2026-09-23T20:30:00Z | mimo | create | feature/npm-publish | package.json meta + release.yml npm publish + docs Q6 | User: 已注册 npm 账号
2026-09-24T12:40:59Z | mimo | create | openspec/ + .agents/skills/openspec-* + .agents/workflows/opsx-* | Ran `openspec init` (Antigravity profile, schema spec-driven); doctor OK | User: openspec init
2026-09-24T12:45:00Z | mimo | create | bcf3df6 feature/npm-publish | Commit OpenSpec scaffold + @fission-ai/openspec dep + npm run openspec; 39/39 tests; author forced Aermberry noreply via GIT_* env (PowerShell `git -c user.name="..."` failed) | User: 好的（提交）
2026-09-24T13:05:00Z | mimo:ses_ffe5f2e49c257ffeN1IR0yE1vr | delete | openspec/ + .agents/skills/openspec-* + .agents/workflows/opsx-* + @fission-ai/openspec | Removed OpenSpec scaffold and CLI dep; design authority stays F/P/AC + .agents | User: 按照你的建议执行（不采用 OpenSpec）
2026-09-24T13:40:00Z | mimo:ses_ffe5f2e49c257ffeN1IR0yE1vr | create | docs/openspec @ 236ad43+5f66a40 | User reversed: keep OpenSpec on dedicated docs/openspec (from develop); config.yaml grounded in F/P/AC; reinstall CLI dep | User: 2（保留 OpenSpec）
2026-09-24T14:05:00Z | mimo:ses_ffe5f2e49c257ffeN1IR0yE1vr | merge | docs/openspec → develop @ 43fc1bc; push docs/openspec + develop | Landed OpenSpec tooling on develop via commit-tree merge (worktree blocks git merge) | User: 合并并推送
2026-09-25T00:50:00Z | mimo:ses_ffe5f2e49c257ffeN1IR0yE1vr | create | release/0.3.2 | Bump package.json 0.3.2 (OIDC npm publish + OpenSpec tooling + npx docs); 39/39 tests | User: 发布吧
2026-09-25T00:58:00Z | mimo:ses_ffe5f2e49c257ffeN1IR0yE1vr | create | tag v0.3.2 + GitHub Release | main@1116467; assets picbed-0.3.2.tgz + picbed.tgz OK; **npm publish OIDC E404** (Trusted Publisher 未就绪/包名未建立) | User: 发布吧
