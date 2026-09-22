# Project Overview

| Field | Value |
|-------|-------|
| date | 2026-09-22 |
| name | picture_bed · picbed |
| type | greenfield software (local CLI image-host tool) |
| status | P0/P1 MVP implemented on `feature/picbed-mvp`; design freeze on `docs/design`/`develop`/`main` |
| language/stack | TypeScript ESM, Node.js ≥ 20, commander, vitest, tsc |
| entry points | `bin/picbed.js` → `src/cli.ts` (dist/) |
| validation | `npm test` (vitest), `npm run lint` (`tsc --noEmit`), `npm run build` |
| git | local `main` → `origin` `https://github.com/Aermberry/picture_bed` (PUBLIC) |
| branches | `feature/picbed-mvp` (impl HEAD `88e7c32`), `develop`/`docs/design`/`main` at design freeze `efa3fb7` |
| primary artifacts | `src/**`, `tests/**`, `docs/**` (F/P/module/AC), `README.md`, `bin/picbed.js`, `package.json` |

## Product

Local CLI **picbed**: scan Markdown/HTML embedded images → upload to PicX-style **GitHub image host** → rewrite stable links. Agent-facing (`--json`, schemaVersion 1, exit-code contract).

Commands: `init` · `doctor` · `scan` · `plan` · `sync` · `upload` · `revert` · `watch` · `config` · `commands`（`login`/`logout` 已移除）。

## Feature progress (authoritative: `docs/features-index.md`)

- Done: F1–F15（含 F12 watch、F13 multi-host、F14 MCP、F15 Token 鉴权）
- Released: GitHub Release `v0.2.0`（资产 `picbed.tgz` 跟随 `/releases/latest`）

## Source of truth

Current project artifacts win over this memory. `AGENTS.md` (AgentGo v1.15.1) is the agent protocol; project facts live here under `.agents/`. Feature definitions: `docs/features-index.md`.

## Standing corrections

- **Design before implementation**：任何代码行为变更必须**先改设计文档**（features-index / module-* / architecture / 必要时 index.html），**再**写实现与测试。用户 2026-09-22 明确要求；详见 `.agents/rules/delivery.md`。
- **设计改动必须进 `docs/design` 分支**：此前多次设计修订直接落在 `feature/*` 上，属违规；已用 design-only commit `4300de0` 补进 `docs/design`。之后设计文档变更优先提交到 `docs/design`（隔离 worktree 下用 `git commit-tree` + `git fetch . <sha>:docs/design`）。
- **`docs/design` 每次提交后必须合入 `develop`**：`4300de0` 曾只在 `docs/design` 上、未进 `develop`（用户 2026-09-23 指出）；已用 merge commit `b513fb7` 合入并 FF `main`。禁止设计分支长期悬空。
- **Git Flow：一功能点一 `feature/*` 分支**：F12/F13/F14 等曾全部堆在 `feature/yigecli-mvp`，未按 topic 分支，属违规（用户 2026-09-23 指出）。之后每个 F/变更集从 `develop` 拉 `feature/<topic>`，完成后合回 `develop`；禁止长期单分支堆功能。

## Notes

- Repo commits use GitHub noreply author (`26331797+Aermberry@users.noreply.github.com`) due to GH007 email privacy; global git config was not changed.
- Design docs belong on `docs/design`; implementation on `feature/*` with Git Flow to `develop`/`main` (see `.agents/rules/delivery.md`).
- System npm may be blocked by NVM (NVM4306); use `$MIMO_NODE $MIMO_NPM` when `npm` is untrusted.
