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
- Done: F16–F22 本地 Web 控制台（`picbed ui`，含拖拽、revert、config/doctor、runs、watch）
- Done: F23 控制台壳层与视觉重设计（四视图「上传/管理/设置/规范」· 晨雾蓝×落日暖）
- Done: F24 桌面应用壳与安装包（Electron 双形态：npm + `picbed-setup.exe`）
- Design only: （无）
- Released: GitHub Release `v0.3.1`（资产 `picbed.tgz` / `picbed-0.3.1.tgz` 跟随 `/releases/latest`）；`v0.3.0` tag 存在但 Release 失败（CI token-mask 测试），以 **v0.3.1** 为准

## Source of truth

Current project artifacts win over this memory. `AGENTS.md` (AgentGo v1.15.1) is the agent protocol; project facts live here under `.agents/`. Feature definitions: `docs/features-index.md`.

## Standing corrections

- **Design before implementation**：任何代码行为变更必须**先改设计文档**（features-index / module-* / architecture / 必要时 `docs/html/index.html`），**再**写实现与测试。用户 2026-09-22 明确要求；详见 `.agents/rules/delivery.md`。
- **设计改动必须进 `docs/design` 分支**：此前多次设计修订直接落在 `feature/*` 上，属违规；已用 design-only commit `4300de0` 补进 `docs/design`。之后设计文档变更优先提交到 `docs/design`（隔离 worktree 下用 `git commit-tree` + `git fetch . <sha>:docs/design`）。
- **`docs/design` 每次提交后必须合入 `develop`**：`4300de0` 曾只在 `docs/design` 上、未进 `develop`（用户 2026-09-23 指出）；已用 merge commit `b513fb7` 合入并 FF `main`。禁止设计分支长期悬空。
- **Git Flow：实现一 `feature/<topic>`，纯文档一 `docs/<topic>`**：F12–F14 曾堆在单支；`docs/html` 迁移误用 `feature/design-html-path`（应用 `docs/html-layout`）。禁止长期单支堆功能，禁止文档主题进 `feature/`。
- **Commit 后必须自动 push**：每次 git commit / commit-tree 落地后立即推送对应分支到 origin，无需再问；**仅 release（tag / GitHub Release / npm publish）需用户审核**（2026-09-25）。

## Notes

- Repo commits use GitHub noreply author (`26331797+Aermberry@users.noreply.github.com`) due to GH007 email privacy; do **not** change global git config for this. Ambient config may say `user.name=CC` — always force the Aermberry noreply identity via env or `-c` on commits.
- Design docs belong on `docs/design`; implementation on `feature/*` with Git Flow to `develop`/`main` (see `.agents/rules/delivery.md`).
- System npm may be blocked by NVM (NVM4306); use `$MIMO_NODE $MIMO_NPM` when `npm` is untrusted.
