# cliops 模块详细设计

> 归属功能点：F1 项目初始化与配置、F2 环境与鉴权自检、F10 Agent 机器接口。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；全局契约见 [`cross-cutting.md`](cross-cutting.md)。

## 目的

cliops 负责 **配置生命周期、健康检查、命令编排入口与机器可读契约**，使 yigecli 对人可读、对 Agent 可编程。业务规则在 ingest/transfer/rewrite；本模块保证输入合法、输出稳定、失败可判定。

边界原则：
- Token **只**从 ENV / 用户级配置读取；输出一律掩码。  
- 非 TTY **禁止**交互阻塞；写文件类命令无 `--yes` 时退出码 7。  
- `--json` 时 stdout 仅 JSON，诊断走 stderr。

## 模块文件夹结构（栈无关）

```
cliops/
├─ domain/
│  ├─ cqe/           # InitConfigCommand、DoctorQuery、GlobalFlags
│  ├─ entity/        # ResolvedConfig、DoctorReport、JsonEnvelope
│  ├─ service/       # ConfigLoader、DoctorService、OutputFormatter、Orchestrators(编排调用)
│  └─ facade/        # CliFacade
├─ exceptions/       # ConfigInvalidError、UsageError、AuthError
└─ cli/              # argv 解析、子命令注册、进程退出码映射
```

## 配置模型（ResolvedConfig）

```
host:   { type: github|local }
github: { owner, repo, branch, dir }
local:  { root, publicBase, dir }
url:    { style: raw|jsdelivr|custom, customTemplate? }
scan:   { extensions[], ignore[] }
upload: { concurrency, commitMessage }
rewrite:{ backup: boolean }
# token 不在 ResolvedConfig 的可序列化输出中；仅内存注入 HostAdapter
```

优先级：**CLI flags > ENV > ./yigecli.toml > ./.yigecli/config.toml > 用户级**。

## F1 项目初始化与配置

- `init`：写出 `yigecli.toml` 模板（无 secret）；已存在需 `--force`。  
- `config get|set|list`：枚举校验（如 `url.style`）；`list` 对 secret 掩码 `****`。  
- 非法配置：退出码 2（用法）或 3（缺鉴权类），消息含键名。

## F2 环境与鉴权自检

Doctor 检查项：
1. 必需配置键存在且类型正确  
2. token 存在（不回显）  
3. GitHub API 可达  
4. 对 `owner/repo` 具备 Contents 读写（最小探测）  

输出 `DoctorReport { ok, checks[] , failures[] }`；任一 hard 失败 → 退出码 3。

## F10 Agent 机器接口

- 每个子命令支持 `--json`，信封：`{ schemaVersion, ok, command, data?, error?, warnings? }`。  
- 退出码表见 [`cross-cutting.md`](cross-cutting.md)。  
- 幂等提示写入 data，供 Agent 断点续跑。  
- `yigecli commands --json` 列出命令与选项（可发现性）。

## F15 GitHub 点击登录

### 意图

`yigecli login` 用 OAuth 完成「浏览器点击授权」，避免手贴 PAT。默认 **Authorization Code + 127.0.0.1 回调**；远程/无浏览器环境用 `--device`（Device Flow）。

### 依赖配置（用户自备 OAuth App）

- `github.client_id` / `YIGE_GITHUB_CLIENT_ID`
- `github.client_secret` / `YIGE_GITHUB_CLIENT_SECRET`（仅本地用户配置/ENV，禁止入库）
- 回调 URL：`http://127.0.0.1:<port>/callback`（默认端口可配，建议固定 53682 并写入 OAuth App）
- scope：默认 `repo`（图床私有仓库）；可降为 `public_repo`

### 本机回调流

1. 生成 `state`（随机），监听 `127.0.0.1:port`
2. 打开 `https://github.com/login/oauth/authorize?client_id&redirect_uri&scope&state`
3. 回调校验 `state`，取 `code`
4. `POST https://github.com/login/oauth/access_token` 换 token
5. 写入用户级凭据；关闭临时服务器

### Device Flow 回退

1. `POST /login/device/code` → `user_code` / `verification_uri` / `device_code`
2. 展示码并打开验证页
3. 轮询 `/login/oauth/access_token`（`urn:ietf:params:oauth:grant-type:device_code`）
4. 成功后与回调流相同落盘

### 凭据优先级

`YIGE_GITHUB_TOKEN` / `GITHUB_TOKEN` **>** 用户凭据文件中的 OAuth token。

### 失败语义

| 情况 | 退出码 |
|------|--------|
| 缺 client_id/secret | 3 |
| state 不匹配 / 用户拒绝 | 3 |
| 轮询超时 | 3 |
| 仅写凭据成功 | 0 |

## 功能点映射

| F | 本模块章节 |
|---|------------|
| [F1](../features-index.md#f1-项目初始化与配置) | §F1 |
| [F2](../features-index.md#f2-环境与鉴权自检) | §F2 |
| [F10](../features-index.md#f10-agent-机器接口) | §F10 |
| [F15](../features-index.md#f15-github-点击登录) | §F15 |
