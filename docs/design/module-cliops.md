# cliops 模块详细设计

> 归属功能点：F1 项目初始化与配置、F2 环境与鉴权自检、F10 Agent 机器接口、F12 watch 监听、F14 VS Code/MCP 包装、F15 Token 鉴权。
> 架构见 [`../architecture.md`](../architecture.md)；定义见 [`../features-index.md`](../features-index.md)；全局契约见 [`cross-cutting.md`](cross-cutting.md)。

## 目的

cliops 负责 **配置生命周期、健康检查、命令编排入口与机器可读契约**，使 picbed 对人可读、对 Agent 可编程。业务规则在 ingest/transfer/rewrite；本模块保证输入合法、输出稳定、失败可判定。

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

优先级：**CLI flags > ENV > ./picbed.toml > ./.picbed/config.toml > 用户级**。

## F1 项目初始化与配置

- `init`：写出 `picbed.toml` 模板（无 secret）；已存在需 `--force`。  
- `config get|set|list`：枚举校验（如 `url.style`）；`list` 对 secret 掩码 `****`。  
- 非法配置：退出码 2（用法）或 3（缺鉴权类），消息含键名。

## F14 VS Code / MCP 包装

- 入口：`picbed-mcp`（stdio，newline-delimited JSON-RPC 2.0）。
- Tools：`picbed_doctor|scan|plan|sync|upload|revert`——每个 tool **只**拼 CLI argv 并 `spawn` `picbed … --json`。
- **禁止**在包装层重写抽取/上传/回写规则；输出原样透传 CLI JSON。
- VS Code：把 `picbed-mcp` 配进 MCP / 任务即可；扩展层不承载业务。

## F12 watch 监听

- `watch <path> --debounce <ms>`：`fs.watch` 递归监听文档目录；防抖合并变更批次。
- 触发后调用既有 `sync` 子命令（spawn CLI，不复制业务规则）；支持 `--dry-run`。
- 可退出：SIGINT / SIGTERM 关闭 watcher 后进程结束；**无**常驻服务/特权。

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
- `picbed commands --json` 列出命令与选项（可发现性）。

## F15 GitHub Token 鉴权

### 意图

**不提供 OAuth 登录**（自建 OAuth App 对最终用户过重）。鉴权只使用现成 token。

### Token 解析顺序

1. `PICBED_GITHUB_TOKEN`
2. `GITHUB_TOKEN`
3. `gh auth token`（复用 GitHub CLI 登录态；`gh` 不存在或失败则跳过）

### 失败语义

| 情况 | 退出码 |
|------|--------|
| 无任何 token | 3 |
| token 无权限 / API 失败 | 5（或 doctor 汇总 3） |
| `login` / `logout` | 2（已移除，给出 hint） |

## 功能点映射

| F | 本模块章节 |
|---|------------|
| [F1](../features-index.md#f1-项目初始化与配置) | §F1 |
| [F2](../features-index.md#f2-环境与鉴权自检) | §F2 |
| [F10](../features-index.md#f10-agent-机器接口) | §F10 |
| [F15](../features-index.md#f15-github-点击登录) | §F15 |
