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
2026-09-25 | create | docs/design/wireframes/ui-shell.md + F23 design pack | UI 壳层重设计：双栏「管理/设置」+「文件放置」；主题令牌；更新 features-index/module-webui/architecture/reading-guide/html | User: UI 草图 + /project-design；validate-design.ps1 PASS
2026-09-25 | update | src/ui/static.ts + F23 design pack | 按用户《图床工具-UI方案》实现四视图壳层（晨雾蓝×落日暖、Logo 三态、DropZone、FileCard、Toggle）；接线 session/plan/sync/manifest/runs/watch/config/doctor；40/40 tests | User: 请阅读UI设计方案，并实现UI界面
2026-09-25 | update | .agents/rules/delivery.md + memory | Standing rule: auto-push after every commit; release requires user review | User instruction
2026-09-25 | create | .githooks/post-commit + pre-push + README | Auto-push after commit; pre-push blocks release/tags/main unless PICBED_RELEASE_OK=1; core.hooksPath=.githooks | User: git hook automation
2026-09-25 | update | src/ui/static.ts + ui-shell.md + ui.test.ts | UI polish: 3 themes (morning-mist/klein/cream), tokenized Logo, quota bar, theme pills, file detail modal | User: 改进UI界面 per updated UI spec
2026-09-25 | update | src/ui/static.ts + ui-shell.md + ui.test.ts | UI: KyoAni soft palette 晴空蓝×夕照金 — chroma shadows, air gradient, colored soft shadow, larger radii | User: 参照文档做改进
2026-09-25 | update | src/ui/static.ts + ui-shell.md + ui.test.ts | Polish: icon tokens (--ico-*), multi-format copy (url/md/html), workset remove | User: 继续打磨
2026-09-25 | create | tag v0.3.3 + GitHub Release | merge release/0.3.3 into main; assets picbed-0.3.3.tgz+picbed.tgz contain new UI (晴空蓝); npx latest fixed. npm publish still E404 (Trusted Publisher) | User: ok (approved release)
2026-09-25 | update | package.json + release.yml | npm pkg fix (bin paths); npm publish continue-on-error so Release assets always ship | User: pasted npm publish E404 log
2026-09-25 | update | release.yml | Root-cause npm E404: v0.3.1 never used CI publish (manual 0.3.1); OIDC needs npm>=11.5 and must clear empty NODE_AUTH_TOKEN; add workflow_dispatch republish | User: 之前发布成功过
2026-09-26 | create | .mimocode/skills/npm-oidc-release/ | Project skill: GitHub Release + npm OIDC publish pitfalls and checklist | User: 总结经验为项目内 skill
2026-09-26 | create | .mimocode/skills/ui-spec-impl/ | Project skill: UI spec to impl (4-view shell, theme tokens, logo/icon tokens) | User: today also did UI design
2026-09-26 | create | F24 desktop shell | Electron main/preload + electron-builder NSIS + picbedNative browse + release.yml desktop job + tests 45/45 | User dual-form distribution request
2026-09-26 | update | delivery.md + standing corrections | Release order MANDATORY feature→develop→main→tag; user corrected v0.4.0 out-of-order release | User: 发布包应先合并 develop/main
2026-09-26 | create | .agents/rules/git-workflow.md | Distilled netresearch/git-workflow-skill: no direct main, conventional commits, no squash, evidence for tests, no editorializing, force-with-lease, release order | User: 学习 https://github.com/netresearch/git-workflow-skill
2026-09-26 | update | UI 规范 nav 调试门 | hide 规范 unless PICBED_UI_DEV/src-tree/desktop:dev; packaged ships without src | User: 规范仅本地调试显示
2026-09-26 | update | DropZone 入口收窄 | remove 选择文件/粘贴剪贴板 buttons+handlers; F17 AC updated | User: 不需要选择文件、粘贴剪贴板
2026-09-26 | update | 拖拽自动识别 root | drop absPath (Electron getPathForFile) auto-binds; no user-facing 策略 A | User: 只需拖拽即可
2026-09-26 | update | 上传页收窄 | remove root/workset/plan-sync panels; drop → confirm → auto sync | User: 表栏不需要
2026-09-26 | update | 扫描预览+上传/重置 | drop→plan preview thumbs + btnUpload/btnReset; /api/preview + /api/session/reset | User: 预览并选择上传或重置
2026-09-26 | fix(ui) | 图片拖入无预览 | accept image files on drop; /api/session/images lists root+dropped images for preview | User: 拖图片无扫描结果
2026-09-26 | update | desktop:dev 热更新 + 图片路径解析 | tsc -w + app.relaunch; dataTransfer.files + getPathForFile/file.path; immediate previewPaths | User: 拖图仍无结果/要热更新
2026-09-26 | fix(ui) | 拖图预览 | blob URL preview from dropped Files; preload.cjs webUtils; merge blob+path previews | User: 拖图仍无预览
2026-09-27 | fix(ui) | 拖图预览根因 | fad7660 的 \' 转义在模板字符串中被吞→线上 JS SyntaxError 整页脚本死亡（前三次修复均未触及）；改为 \' 并新增内联脚本语法守卫测试；drop 时同步渲染 blob 预览不再等服务器；blob/previewPath 按 abs 去重 | User: 拖入图片无法即时显示预览
2026-09-27 | update | 工具链: fnm 可用 | node/npm 不在 Git Bash PATH；fnm (Scoop E:\CommandUtility\Scoop\shims\fnm.exe) 提供 v24.21.0/npm 11.19.0；eval "$(fnm.exe env --shell bash)" 后 tsc OK + vitest 51/51 | User: 请查看fnm
2026-09-27 | update | .agents/memory/review-findings.md | F16–F24 架构评审（只读）：orchestration 双实现漂移、static.ts 1282 行内联 SPA、HTTP 写接口无 Origin 校验 + unbounded body、commander 挂名等 6+1 项，含 file:line 证据与修复方向 | User: 请检验当前的项目架构是否合理
2026-09-27 | create | docs/design/module-app.md | 应用编排层设计包（38d83f3/f8e23c9）合入 develop：src/app 服务表、错误码→退出码/HTTP 单源表、8 项 delta、4 条不变量 | User: 请逐项来（评审 ①）
2026-09-27 | update | src/app/* + src/ui/{server,index}.ts + tests/{ui,ui-panels}.test.ts | 落地应用编排层：删除 ui/{ops,doctor,revert,runs}.ts，Web/桌面壳改经 runSync/runRevert/doctorService/runPlan/writeConfigKey；5a186e8 | User: 请逐项来（评审 ①）
2026-09-27 | update | src/cli.ts + src/app/sync.ts + tests/cli.test.ts | CLI 委托应用层：sync/revert/doctor/config 收敛到同一实现，catch-all 用 asAppError+exitCodeForCode，E_CONFIG 校验进 app；新增 7 项 CLI 测试（58/58）| User: 请逐项来（评审 ①）
2026-09-27 | update | .agents/memory/{review-findings,decisions,open-items}.md | 评审 1–2 标记 closed（含残留：TOML 值转义）；新增决策「抽取 src/app」与「逐项来」次序；②③ 转 open-items | User: 请逐项来（评审 ①）
2026-09-27 | update | src/ui/static.ts + src/ui/spa/* | 评审 ② 落地：1282 行内联 SPA 拆为 spa/{index,styles,app.js,globals.d.ts}，static.ts 变 barrel；server 增 /styles.css /app.js 路由（懒读 dist，E_STATIC 兜底）；type="module" 加载（NodeNext 强制 ESM）；4ae32a3 入 develop | User: 请逐项来（评审 ②）
2026-09-27 | update | .agents/memory/{review-findings,decisions,open-items}.md | 评审 ③ 标记 closed（含残留 pivot 记录：.js+checkJs、type=module）；② 关闭、③ HTTP 加固为下一项 | User: 请逐项来（评审 ②）
2026-09-27 | update | docs/{features-index,design/module-webui,html/index,architecture,design/wireframes/ui-shell} | F17/扫描来源收窄：拖放仅图片或文档（拒文件夹）；预览=拖入图+拖入文档引用图；sync 按工作集作用域；00857b1→docs/design→develop | User: 改为只能拖图片或者文档
2026-09-27 | update | src/app/{plan,sync}.ts + src/ui/{server,spa} + tests | 落地：drop 拒 type=dir；session/images 只列工作集图；scanIntoPreview 不再扩根；runSync includeDocs/includeImages；64/64 + tsc 绿；49a28c3→feature/drop-images-docs-only→develop d36a934 | User: 拖入后点预览冒出不明图片
2026-09-27 | update | docs/{features-index,design/module-webui,design/wireframes/ui-shell} | F17 扫描结果呈现改为照片墙（瀑布流图块+文件名浮层）；4d08837→docs/design→develop 9de1917 | User: 扫描后获取到图片后应以照片墙形式呈现
2026-09-27 | update | src/ui/spa/{index,styles,app.js} + tests/desktop.test.ts | 落地照片墙：has-photos 态隐藏空态英雄，multi-column 瀑布流 tile（自然比例/r14/hover 文件名）；65/65 + tsc 绿；feature/photo-wall | User: 扫描后获取到图片后应以照片墙形式呈现
2026-09-27 | fix(ui) | 照片墙计数4≠3 | drop 文档误写 previewPath→多计1张且加载失败被移除；server 仅图片返回 previewPath，client isImageName 过滤，headline=活 tile 数；67/67 | User: 扫描到4张但预览3张
2026-09-27 | fix(ui) | 二次拖入清空照片墙 | scanIntoPreview/drop 整表替换→wallItems 累加去重；重置/上传成功才清空；68/68 | User: 再拖入后之前预览图片不见了
2026-09-27 | fix(desktop) | desktop:dev 热更新失效 | 根因 app.relaunch 后 supervisor 误杀 tsc/自身；改为 supervisor respawn + 分层重载（app.js reload / dist UI 重启 / desktop 进程重启）；70/70 | User: Electron 本地调试无法热更新
2026-09-28 | update | docs/design/{module-webui,wireframes/ui-shell} + renderer/styles.css + tests/desktop.test.ts | 照片墙对齐 Material Tailwind Masonry 画廊：响应式 2/3/4 列、gap 16、图块 r16；photo-wall 4 测试绿 + tsc 绿；7a64492→feature/electron-vite | User: 拖拽扫描后的图片预览效果参考 material-tailwind gallery 排列
2026-09-28 | update | docs/design/{module-webui,wireframes/ui-shell} + renderer/{main.js,styles.css} + tests/desktop.test.ts | 照片墙 hover DOTween 缩放：doscale（rAF+outCubic/inOutSine，可打断）scale 1→1.08→1；CSS 移除 tile transform 过渡；photo-wall 6 测试绿 + tsc 绿；70f57f0→feature/fix-vite-hmr-window-url | User: 悬停图片自动放大、离开缩小，使用 dotween 动画
2026-09-27 | feat(desktop) | electron-vite 迁移 | renderer/ 单源；desktop:dev=electron-vite HMR + tsc -w；71/71 + build 绿 | User: 请迁移 electron-vite
2026-09-27 | verify(desktop) | electron-vite 冒烟 | UI 服务下发 renderer 含照片墙；electron-vite dev 可启动（main/preload/5173）；config 解析正确 | User: 请继续
2026-09-27 | fix(desktop) | electron-vite 启动失败 | package.json 无 main→补 ELECTRON_ENTRY=desktop/main.mjs；ESM import electron 触发 Node20 CJS bug→createRequire；RUN_AS_NODE 泄漏→re-exec；失败退避 5 次；72/72 + dev 实测 DEV_OK | User: No entry point found
2026-09-27 | update | docs design pack 整理 | module-desktop 重写为 electron-vite 权威；architecture/webui/reading-guide 去过期栈；spa-split 标历史 | User: 请把设计文档整理好
2026-09-27 | update | docs/html/index.html | 对齐照片墙 + renderer/electron-vite + v0.4.1；去 src/ui/spa 旧栈 | User: html的文档有修改没有
2026-09-27 | update | README.md | Web 流程改照片墙累加；补 desktop:dev=electron-vite；示例版本 0.4.1 | User: readme呢
2026-09-27 | update | .agents/rules/delivery.md + memory | 新增 Docs trio sync：设计稿+docs/html+README 必须同步 | User: 请记住更新文档设计稿、html文档和readme
2026-09-27 | fix(ui) | 上传/重置常显 | .row display:flex 压过 hidden；[hidden]!important + syncWallChrome 按 tile 数显隐；73/73 | User: 重置和上传按钮只有扫描出图片并预览出来时才显示
2026-09-27 | update | .agents/rules/delivery.md | 新增 Bugfix Git Flow：feature/fix-* / hotfix/* 分流，一 bug 一支 | User: 是的
2026-09-27 | fix(desktop) | Vite HMR 不生效 | fs.watch 在 dist 变更后 loadURL(uiHandle.url) 把窗口拽离 Vite；Vite 会话禁止导航、desktop/* 交 electron-vite；74/74 | User: 热更新还是没有生效
2026-09-28 | merge | feature/fix-vite-hmr-window-url → develop @ d7d96b4 | photo wall DOTween hover zoom 集成；commit-tree+fetch 落地（隔离 worktree 禁 checkout）；origin/develop 已推 | User: 为什么完成后没有自动合并到 develop
2026-09-28 | update | .agents/rules/delivery.md + memory/project-overview.md + outcomes.md | Bugfix Git Flow 修订：删除 feature/fix-* 路径，bug 一律 hotfix/<slug>；记录 standing correction | User: 根据 git flow 你应该使用 Hotfix 分支修复 bug 而不是开启 feature 分支
2026-09-28 | update | delivery.md + project-overview.md + outcomes.md | 合并后收尾规则：切回 develop + 删除已合入 topic 分支；记录 standing correction | User: 合并到 develop 后应切换到 develop 并删除已归入的分支
2026-09-28 | update | docs/design + renderer/main.js + tests/desktop.test.ts | 照片墙 hover 焦点扩散：主图 scale 1.08，邻图按距离衰减缩小(至 0.94)+外让位(至 20px)；dotween 复合变换；7 测试绿+ tsc 绿；382fbd7→feature/photo-wall-hover-focus | User: 悬停放大时邻近图片腾出位置或缩小，添加动效
2026-09-28 | update | docs/design + renderer/main.js + tests/desktop.test.ts | hover 放大 1.08→1.22；邻图推距改按悬停图宽 0.22x 计算保间距；7 测试绿+ tsc 绿；5de29c5→feature/photo-wall-hover-focus | User: 被悬停放大的图片可以再放大一点，周围图片要与被悬停放大的图片保持一定的间距
2026-09-28 | fix(ui) | 放大图遮挡邻图 | 改净空区（scale1.22 包围盒+GAP14）+ MTV 推离；offset* 量几何防 transform 干扰；z-index 仅叠放；7 测试绿+ tsc 绿；a9e489d→feature/photo-wall-hover-focus | User: 被鼠标悬停放大的图片不应该遮挡周围的图片
2026-09-28 | fix(ui) | 缩放/移位超出虚线框 | dropzone overflow:hidden 硬裁切 + clampPush 钳制位移目标进 wall 内容盒；8 测试绿+ tsc 绿；a5455f1→feature/photo-wall-hover-focus | User: 图片在缩放移位时不应该超出扫描区的虚线
2026-09-28 | fix(ui) | 放大被虚线裁切/右侧重叠与空隙 | 去 overflow:hidden；origin 向扫描区中心+自适应 maxScale；measure 暂清 transform；邻图仅 MTV 净空不漂移；8 测试绿+ tsc 绿；fdeeade→feature/photo-wall-hover-focus | User: 效果比之前差了很多，被左侧虚线遮挡，右侧重叠且间距过大
2026-09-28 | update | docs/design + renderer/main.js + tests/desktop.test.ts | 逐边放大约束：NEAR=28 贴边侧钉死不外扩；对边贴边则该轴 sx/sy=1；自由侧保持 origin+1.22+DOTween；9 测试绿+ tsc 绿；11787bc→feature/photo-wall-hover-focus | User: 贴近虚线的方向禁止延伸，坐标与尺寸保持不变
