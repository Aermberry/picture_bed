---
name: npm-oidc-release
description: 排查与修复 picbed 等仓库的 GitHub Release + npm Trusted Publishing（OIDC）发版链路。当 npm publish 报 E404/ENEEDAUTH、release 资产与本地不一致、或要配置无长期 token 的发版流程时使用。覆盖：根因分层（GitHub 包 vs npm 包）、npm CLI 版本要求、NODE_AUTH_TOKEN 与 OIDC 互斥、workflow 重跑/重发、验收命令。
---

# npm OIDC Trusted Publishing 发版

把「本地构建正常、安装包却是旧 UI / 发不出 npm」类问题，拆成**两条独立发布通道**分别验收，再修 OIDC 发版链路。  
本 skill 来自 picture_bed 实战：**长期 `NPM_TOKEN` 不是必需的**，但 CI 配置错误时会表现成「好像必须用 token」。

## 适用

- `npm publish` 在 Actions 里 **E404 / E403 / ENEEDAUTH**
- `npx <release tarball>` / `npm i pkg` 与本地 UI/代码不一致
- 新建或修复 **GitHub Release + npm** 双通道发版
- 用户问「不是说不用 token 吗」——先核对是否误判过鉴权

## 不适用

- 业务代码实现（走 project-design / 常规开发）
- 私有 registry / 非 OIDC 的纯 token 发布（另议）

---

## 1. 先分清两条通道

| 通道 | 触发 | 资产 | 典型安装 |
|------|------|------|----------|
| **GitHub Release** | tag `v*` → `gh release create` | `pkg.tgz` / `pkg-<ver>.tgz` | `npx <raw release url>/pkg.tgz` |
| **npm registry** | 同 workflow `npm publish` | `pkg@version` | `npm i pkg` / `npx pkg` |

**排障顺序**：

1. 本地 `npm pack` 解包，确认 `dist/**` 是预期代码  
2. 下载 `releases/latest` 的 tarball，确认与本地一致 → 否则是 **未发版 / tag 未合入 main**  
3. `npm view <pkg> versions` → 落后则是 **publish 步骤失败**，进 §3  

「UI 不一致」多数只是 **latest 仍是旧 tag**，不是打包脚本丢了文件。

---

## 2. 发版流水线（目标形态）

```text
develop ──(测试绿)──► main ──tag vX.Y.Z──► release.yml
                                           ├─ build + test + pack
                                           ├─ gh release create/upload
                                           └─ npm publish --provenance   # OIDC，无 NPM_TOKEN
```

### Workflow 要点（缺一不可）

```yaml
permissions:
  contents: write      # GitHub Release
  id-token: write      # OIDC 必需

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: 22
      registry-url: https://registry.npmjs.org
  # Trusted Publishing 需要 npm >= 11.5；Node 22 自带 npm 10 会失败
  - run: npm install -g npm@latest
  - run: npm ci && npm run build && npm test && npm pack
  - name: Publish to npm (OIDC)
    env:
      NODE_AUTH_TOKEN: ''   # 显式清空，避免 setup-node 写入的 authToken 挡住 OIDC
    run: |
      npm config delete '//registry.npmjs.org/:_authToken' || true
      npm publish --access public --provenance
```

### npmjs.com Trusted Publisher

- Publisher: **GitHub Actions**
- Org / Repo / Workflow 文件名 必须与仓库一致（如 `Aermberry` / `picture_bed` / `release.yml`）
- Environment name：若 workflow 未使用 environment，**留空**
- 勾选 **Allow npm publish**（不只 stage）

配置正确仍 E404 时，**优先查 npm CLI 与 authToken**，不要先改成长期 token。

---

## 3. 根因对照表

| 症状 | 常见根因 | 修法 |
|------|----------|------|
| `PUT …/<pkg> 404` 且包名已存在 | 空/无效 `NODE_AUTH_TOKEN` 被写入 npmrc，OIDC 未走通；或 npm &lt; 11.5 | 升级 npm；`npm config delete '//registry.npmjs.org/:_authToken'`；`NODE_AUTH_TOKEN: ''` |
| `ENEEDAUTH` / need login | 未使用 OIDC，也无 token | 补 `id-token: write` + Trusted Publisher + npm 11.5+ |
| 只有旧版本在 npm | 发布步骤一直失败；或旧版本曾**手工** publish | 看 Actions 日志；`workflow_dispatch` 重发 |
| GitHub `latest` 是旧 UI | 代码在 `develop`，未合 `main` / 未打 tag | 合入 + tag + push 触发 Release |
| Re-run job 跳过 publish | 前面 `gh release create` 因 release 已存在而失败 | `gh release upload --clobber` 或 `skip_github_release` + workflow_dispatch |
| `bin` 警告 script name cleaned | `package.json` 写了 `./bin/...` 等 | `npm pkg fix` 后提交 |
| 误以为「必须 NPM_TOKEN」 | 把 OIDC 失败当成「鉴权没配好」 | 见 §1 分层；验证后仍无 token 可发 |

**历史教训（picture_bed）**：`v0.3.1` 的 release workflow **没有** `npm publish` 步骤，npm 上的 0.3.1 不是该 OIDC 流程发的；不能用它证明「以前 CI 发布成功过」。

---

## 4. 重发 / 补发

- **新版本**：bump version → 合 `main` → tag → push（release 需用户审核）
- **补发已 tag 版本**：`workflow_dispatch`，输入 tag，`skip_github_release=true`（GitHub 资产已在时）
- **本地验证包内容**：

```bash
npm pack --pack-destination /tmp/pack
tar -tzf /tmp/pack/pkg-*.tgz | head
# 对照 dist/ui/static.js 等关键文件是否含预期关键字
```

---

## 5. 验收清单

- [ ] `npm pack` 解包内容 = 本地期望（含 UI 字符串/版本）
- [ ] `gh release view vX.Y.Z` 含 `*.tgz`
- [ ] `npm view <pkg> versions` 含新版本；`dist-tags.latest` 正确
- [ ] Release workflow 中 **无** 长期 `NPM_TOKEN`；有 `id-token: write`
- [ ] 发布日志出现 `Provenance statement published`（OIDC 成功标志）
- [ ] 安装命令（npx tarball / npm i）打开后功能与本地一致

---

## 6. 相关

- 项目交付规则：`.agents/rules/delivery.md`（commit 后 push；release 审核）
- picture_bed workflow：`.github/workflows/release.yml`
- 设计/实现分离：`project-design` skill（UI 与 AC 先于发版）
