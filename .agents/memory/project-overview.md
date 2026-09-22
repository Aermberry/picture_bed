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

Commands: `init` · `login`/`logout` · `doctor` · `scan` · `plan` · `sync` · `upload` · `revert` · `config` · `commands`.

## Feature progress (authoritative: `docs/features-index.md`)

- Done: F1–F15 (incl. F12 watch, F13 multi-host, F14 MCP)
- Optional open: CI

## Source of truth

Current project artifacts win over this memory. `AGENTS.md` (AgentGo v1.15.1) is the agent protocol; project facts live here under `.agents/`. Feature definitions: `docs/features-index.md`.

## Standing corrections

- (none yet)

## Notes

- Repo commits use GitHub noreply author (`26331797+Aermberry@users.noreply.github.com`) due to GH007 email privacy; global git config was not changed.
- Design docs belong on `docs/design`; implementation on `feature/*` with Git Flow to `develop`/`main` (see `.agents/rules/delivery.md`).
- System npm may be blocked by NVM (NVM4306); use `$MIMO_NODE $MIMO_NPM` when `npm` is untrusted.
