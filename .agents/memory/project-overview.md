# Project Overview

| Field | Value |
|-------|-------|
| date | 2026-09-22 |
| name | picture_bed · yigecli |
| type | greenfield software (local CLI image-host tool) |
| status | P0/P1 MVP implemented on `feature/yigecli-mvp`; design freeze on `docs/design`/`develop`/`main` |
| language/stack | TypeScript ESM, Node.js ≥ 20, commander, vitest, tsc |
| entry points | `bin/yigecli.js` → `src/cli.ts` (dist/) |
| validation | `npm test` (vitest), `npm run lint` (`tsc --noEmit`), `npm run build` |
| git | local `main` → `origin` `https://github.com/Aermberry/picture_bed` (PUBLIC) |
| branches | `feature/yigecli-mvp` (impl HEAD `88e7c32`), `develop`/`docs/design`/`main` at design freeze `efa3fb7` |
| primary artifacts | `src/**`, `tests/**`, `docs/**` (F/P/module/AC), `README.md`, `bin/yigecli.js`, `package.json` |

## Product

Local CLI **yigecli**: scan Markdown/HTML embedded images → upload to PicX-style **GitHub image host** → rewrite stable links. Agent-facing (`--json`, schemaVersion 1, exit-code contract).

Commands: `init` · `login`/`logout` · `doctor` · `scan` · `plan` · `sync` · `upload` · `revert` · `config` · `commands`.

## Feature progress (authoritative: `docs/features-index.md`)

- Done (P0/P1): F1–F11, F15
- Backlog (P3): F12 watch, F13 multi-host, F14 VS Code/MCP wrapper

## Source of truth

Current project artifacts win over this memory. `AGENTS.md` (AgentGo v1.15.1) is the agent protocol; project facts live here under `.agents/`. Feature definitions: `docs/features-index.md`.

## Standing corrections

- (none yet)

## Notes

- Repo commits use GitHub noreply author (`26331797+Aermberry@users.noreply.github.com`) due to GH007 email privacy; global git config was not changed.
- Design docs belong on `docs/design`; implementation on `feature/*` with Git Flow to `develop`/`main` (see `.agents/rules/delivery.md`).
- System npm may be blocked by NVM (NVM4306); use `$MIMO_NODE $MIMO_NPM` when `npm` is untrusted.
