# Review Findings

## 2026-09-27 architecture review (read-only, F16–F24)

Scope: `src/` layering, duplication/drift, UI-server security, docs-vs-code. Evidence: full reads of cli.ts, ui/*.ts, mcp/server.ts, types.ts, docs/architecture.md; package.json; CI.

1. **Orchestration duplicated with live drift** — `src/cli.ts:605-690` vs `src/ui/ops.ts:93-226`: UI path records RunRecord (`ops.ts:198-214`), pushes `skip-cache` rewrite items (`ops.ts:129`), throws `{code:'E_TOKEN', exitCode:3}` (`ops.ts:107`) vs CLI `fail()` (`cli.ts:591-596`). `doctor` gating differs: `ui/doctor.ts:12,22,26` handles `host.type==='local'`; `cli.ts:311-365` always demands a token. Consequence: MCP (spawns CLI) and CLI users get no run history. Direction: extract the application layer promised by `docs/architecture.md` §2.3 (SyncOrchestrator/PlanBuilder/DoctorService); one implementation, two callers.
2. **`applyConfigSet` duplicated + drift** — `cli.ts:817-856` vs `ui/doctor.ts:60-102`; UI validates `url.style` (`doctor.ts:66-67`), CLI does not. Regex TOML rewrite breaks on values containing quotes/newlines. Direction: single implementation, ideally a real TOML lib.
3. **1282-line inline SPA template literal** — `src/ui/static.ts` holds the entire SPA inside a TS template literal; the 2026-09-27 prod incident (consumed `\'` → whole served script SyntaxError → zero listeners) is structural. `docs/architecture.md` §7.1 froze "Vite + native SPA" but `vite` is absent from package.json. Direction: move SPA out of the TS string (min: standalone `app.js` served statically); string-assert tests (`tests/desktop.test.ts`) can't catch real DOM behavior.
4. **Local HTTP write API lacks origin checks** — `src/ui/server.ts`: no `Origin`/`Host` validation anywhere; ConfirmGate is only `body.confirm !== true` (506, 548, 589, 640). A malicious page can POST `text/plain {"confirm":true}` to the loopback port (simple request, no preflight) to trigger sync/revert writes. `readBody` (`108-115`) is unbounded → memory DoS. Direction: Origin allowlist + required custom header + body size cap + Content-Type check.
5. **commander declared but bypassed** — `cli.ts:188-195`: `program.args` dead; hand-rolled `argv.slice(2).filter(!startsWith('-'))`; subcommand options re-parsed (`367-381`, `433-445`). Dash-leading positionals break. Direction: either use commander actions fully or drop it.
6. Minor: `IMAGE_EXTS` (`server.ts:45`) vs inline `imageExt` (`212`); `httpStatusFor` (`99-106`) defaults unknown codes to 500 (misleading for new codes); UI tests are string-match only (fold into #3).

**Resolution status (2026-09-27, item ① — shared app layer)**: findings **1–2 closed**. Design pack `docs/design/module-app.md` (`38d83f3`/`f8e23c9`, merged to `develop`) + implementation `refactor(app): extract shared orchestration layer and route web console through it` (`5a186e8`) + CLI delegation: `src/app/{errors,collect,plan,sync,revert,doctor,config,runs}.ts` is the single orchestration; `src/ui/{ops,doctor,revert,runs}.ts` deleted; CLI and Web/desktop both call `runSync`/`runRevert`/`doctorService`/`runPlan`/`writeConfigKey`; CLI sync/revert now write RunRecords, CLI doctor is host-aware, `url.style` validated in one place, exit codes derived by `exitCodeForCode`. Evidence: `npm run lint` clean; `npm test` 58/58 (incl. new `tests/cli.test.ts` covering confirm gates, dry-run, run record, E_MANIFEST_CORRUPT→4, E_CONFIG→3, E_STYLE→2). Residual from finding 2: the TOML regex writer still does not escape `"`/newlines in values (all supported keys are quote-free today). Findings 3–6 remain open (items ②/③ track 3 and 4).

Positives: domain modules have no UI imports (scan→plan→upload→rewrite→manifest); MCP is a thin CLI `--json` wrapper; token never persisted, masked in output; RootBinder path-escape guards (`root.ts`); Electron contextIsolation + no nodeIntegration + `webUtils.getPathForFile` preload; CI node 20/22 matrix, release via OIDC trusted publishing; uniform EXIT + JSON envelope contract.

## 2026-09-22 status after MVP (memory sync)

Bootstrap gaps 1–4 below are **resolved** by later commits (`cc628a8`–`88e7c32`): TypeScript stack, vitest+tsc validation (15/15 pass), full README, and stack ignore rules. Residual: no CI; merge to develop/main still open. This section supersedes the bootstrap gap list for current state.

## 2026-09-22 bootstrap review (read-only)

Scope: top-level structure, primary artifacts, config, docs, validation.

### Confirmed issues / gaps

1. **No application code or stack** — project is README + `.gitignore` only. Entry points, dependencies, and validation commands are undefined. Risk: premature architecture invention. Direction: ask user for stack/product scope before implementing.
2. **No validation** — no tests, lint, typecheck, or CI. Risk: future changes cannot be evidence-backed. Direction: add toolchain + checks when stack is known.
3. **README is a stub** — no purpose, usage, or setup. Direction: expand when product scope is fixed.
4. **`.gitignore` is generic** — may miss stack-specific paths (or ignore media that a picture bed should track). Direction: adjust when stack and media policy are known. Do not silently ignore image libraries.

### Assumptions

- Folder name `picture_bed` implies image-hosting tooling (not confirmed in any document).

### Residual risks

- None blocking bootstrap; greenfield empty tree is expected.

### Style

- N/A (no code yet).
