# Open Items

| date | item | status | next action |
|------|------|--------|-------------|
| 2026-09-22 | Choose stack and confirm product scope for picture_bed | **closed** | Done: TypeScript ESM CLI **yigecli**; product = GitHub image-host pipeline |
| 2026-09-22 | Add stack-specific `.gitignore` / tooling when stack known | **closed** | Done: node/ts/vitest tooling + README env vars |
| 2026-09-22 | Expand `README.md` beyond stub | **closed** | Done: usage, login, commands, exit codes, Agent examples |
| 2026-09-22 | Define validation commands (test/lint/build) | **closed** | Done: `npm test` / `npm run lint` / `npm run build` (15/15 tests pass) |
| 2026-09-22 | Merge `feature/yigecli-mvp` → `develop`/`main` | **blocked** | Isolated worktree forbids cross-branch checkout/merge; run Git Flow merge outside this session (or hand to orchestrator): `git checkout develop && git merge --no-ff feature/yigecli-mvp` then same for `main` |
| 2026-09-22 | F12 watch / F13 multi-host / F14 VS Code-MCP | **backlog** | P3 per `docs/features-index.md`; pick when requested |
| 2026-09-22 | Optional: CI workflow | **open** | Not present; add when user wants remote validation |
