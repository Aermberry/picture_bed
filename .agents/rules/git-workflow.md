# Git workflow rules（自 netresearch/git-workflow-skill 学习并适配本仓库）

status=active
reviewed_at=2026-09-26
source: https://github.com/netresearch/git-workflow-skill （Agent Skill for Git workflow best practices）
evidence: 用户 2026-09-26 要求「学习」该仓库；对照 picture_bed 的 Git Flow / 发版事故（v0.4.0 先 tag 后合分支）取舍。

## Critical rules（不可协商）

1. **禁止直推 `main`**：一律经 `feature/*` 或 `docs/*` → `develop` → PR/合并门 → `main`。例外仅限用户明确授权的 release 合并（须 `PICBED_RELEASE_OK=1`）。
2. **发版顺序**：`feature/*` → 合入 `develop` → 合入 `main` → **再** 打 tag `v*`。禁止从 feature/develop 直接发包后补分支（见 delivery.md）。
3. **禁止 squash**（除非用户明确要求）：保留原子提交、可 bisect、可回滚。
4. **禁止无证据的「已测试/已验证」**：声称通过必须附命令输出；做不到就写明未验证。
5. **禁止编辑技能缓存路径**（`~/.claude/skills/`、`**/.bare/**` 等）：只改仓库 worktree；先 `pwd` 确认。
6. **force-push 仅允许 `--force-with-lease`**，禁止裸 `--force`。
7. **rebase 前必须先 commit**：`add → commit → fetch → rebase → push`（脏树会中止 rebase）。
8. **禁止自我表扬/推销式表述**：只陈述改动了什么，不写「干净/稳健/彻底测试」等修饰（见下「No editorializing」）。
9. **禁止跳过 hook**（`--no-verify`）：hook 失败先查根因。
10. **禁止在 pre-commit 失败后 `--amend`**：失败即提交未发生；修好后重新 `add` 再 commit（amend 会改到上一条历史）。

## Conventional Commits

格式：`<type>[scope]: <description>`

| type | 含义 | 版本 |
|------|------|------|
| `feat` | 新功能 | MINOR |
| `fix` | 缺陷修复 | PATCH |
| `docs` / `style` / `test` / `chore` | 文档/格式/测试/杂务 | — |
| `refactor` | 重构 | — |
| `perf` | 性能 | PATCH |
| `build` / `ci` / `revert` | 构建/CI/回滚 | — |

**版本语义补充**：若改动**移除了消费者原先能得到的行为**，即使类型是 `fix:` 也至少升 MINOR，并在 release notes 写明「不再发生什么」。`BREAKING CHANGE:` 仍留给直接破坏接口的情况。

破坏性变更：

```text
feat!: remove deprecated API

BREAKING CHANGE: /api/v1 removed; migrate to /api/v2.
```

多行/含引号的 commit body 用 `-F` 或 `<<'EOF'`，避免 shell 截断。body 约 72 列硬折行；**PR 描述 / release notes 不要沿用 commit body 的硬折行**（GitHub 评论区 `breaks: true`），每段写成一行。

## Atomic commits

一条提交 = 一个可独立构建、可独立测试的逻辑变更。禁止 `wip`/`fixup` 留进历史；开 PR 前用 `git rebase -i` 整理。

## PR / 合并门（GitHub）

合并前必须：讨论线程已解决、CI 绿、基于当前 head 的 review 已完成、分支已同步。**先查门再合并**，不要盲推 `gh pr merge`。squash 不用。  
本仓库若暂不强制 PR，至少 **`main` 只能经合并提交进入**，且合并前测试绿。

## No editorializing

写变更说明时三问：

1. **删除**：去掉这句读者会丢事实吗？不会就删。
2. **主语**：是在说变更，还是在说自己/工作的质量？后者删。
3. **语气**：维护者会这么写，还是像求职信？

不把「测试全绿 / 无回归 / 已文档化」当叙事；只有**例外**（明知失败/跳过）才写状态。标签用中性词：`Tests` / `Limitations` / `Breaking change`。

## 与本仓库既有约定的映射

| 本 skill | picture_bed |
|----------|-------------|
| 禁止直推 main | `pre-push` 拦 `main`/tags，需 `PICBED_RELEASE_OK=1` |
| Conventional Commits | 已用 `type(scope): description` |
| 发版顺序 | delivery.md MANDATORY（2026-09-26 用户纠正） |
| 测试证据 | delivery.md「Tests before delivery」 |
| 原子提交 + 不 squash | 保持；feature 一主题一支 |
| 签名/DCO | 当前 GH007 noreply + 无强制签名；若将来开 branch protection 再加 `-S --signoff` |

## 明确不在本规则范围

- 发布打 tag / GitHub Release / npm publish（见 delivery.md + skill `npm-oidc-release`）。
- 诊断 BLOCKED PR 项目看板（无）。
- 照搬 netresearch 的 hooks/commands 脚本（需再评估是否引入）。
