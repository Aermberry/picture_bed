# Source Index

| date | artifact | role | notes |
|------|----------|------|-------|
| 2026-09-22 | `AGENTS.md` | agent protocol (AgentGo v1.15.1) | authoritative for agent workflow |
| 2026-09-22 | `README.md` | product + usage | yigecli env, login, commands, exit codes, Agent examples |
| 2026-09-22 | `package.json` | package manifest | name `yigecli` 0.1.0; scripts build/test/lint; deps commander |
| 2026-09-22 | `bin/yigecli.js` | CLI entry | thin launcher to dist |
| 2026-09-22 | `src/cli.ts` | command surface | commander wiring, global flags |
| 2026-09-22 | `src/types.ts` | shared types | JSON schemas / domain types |
| 2026-09-22 | `src/config.ts` | F1 config | yigecli.toml + CLI>ENV>file priority |
| 2026-09-22 | `src/login.ts` | F15 OAuth | local callback + Device Flow; user-level credentials |
| 2026-09-22 | `src/scan.ts` | F3 scan | document discovery |
| 2026-09-22 | `src/extract.ts` | F4 extract | MD/HTML image refs with offsets |
| 2026-09-22 | `src/resolve.ts` | F5 resolve | local asset resolve + sha256 dedupe |
| 2026-09-22 | `src/plan.ts` | F6 plan | upload/skip-cache/skip-remote/blocked |
| 2026-09-22 | `src/host/github.ts` | F7/F11 transfer | Contents API host adapter + URL styles |
| 2026-09-22 | `src/rewrite.ts` | F8 rewrite | URL-only replace, atomic write, backup |
| 2026-09-22 | `src/manifest.ts` | F9 manifest/revert | mapping audit + revert |
| 2026-09-22 | `src/store.ts` | local store | cache / credentials path helpers |
| 2026-09-22 | `tests/extract.test.ts` | unit | F4 extract |
| 2026-09-22 | `tests/login.test.ts` | unit | F15 login |
| 2026-09-22 | `tests/pipeline.test.ts` | unit | scan→plan→rewrite pipeline |
| 2026-09-22 | `docs/features-index.md` | **definition authority** | F/P/module/AC index + bidirectional links |
| 2026-09-22 | `docs/architecture.md` | architecture | layering |
| 2026-09-22 | `docs/design/module-ingest.md` | domain design | F3/F4/F5 |
| 2026-09-22 | `docs/design/module-transfer.md` | domain design | F6/F7/F11 |
| 2026-09-22 | `docs/design/module-rewrite.md` | domain design | F8/F9 |
| 2026-09-22 | `docs/design/module-cliops.md` | domain design | F1/F2/F10/F15 |
| 2026-09-22 | `docs/design/cross-cutting.md` | global contracts | exit codes, JSON, flags |
| 2026-09-22 | `docs/design-reading-guide.md` | onboarding | F/P/module/AC glossary |
| 2026-09-22 | `index.html` + `styles.css` + `app.js` | design HTML presentation | no runtime product code |
| 2026-09-22 | `scripts/validate-bootstrap.ps1` | bootstrap layout check | AgentGo layout |
| 2026-09-22 | `scripts/validate-design.ps1` | design pack check | section/asset validation |
| 2026-09-22 | `vitest.config.ts` | test runner config | vitest |
| 2026-09-22 | `tsconfig.json` | TS project | ESM build to `dist/` |
| 2026-09-22 | `.gitignore` | ignore rules | OS/env/node/build/IDE + yigecli local secrets |

No CI config found. Contribution/style guides not present beyond README and design pack.
