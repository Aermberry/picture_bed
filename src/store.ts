import { execFileSync, spawn } from 'node:child_process';
import { readUserToken } from './user-token.js';

/**
 * Token sources (no OAuth App):
 * 1. PICBED_GITHUB_TOKEN
 * 2. GITHUB_TOKEN
 * 3. 本机用户 PAT（~/.picbed/credentials.json，设置页粘贴保存）
 * 4. GitHub CLI (`gh`) — official "GitHub CLI" app; `gh auth token` reuses its login
 */
export function resolveToken(
  env: NodeJS.ProcessEnv = process.env,
  execGhToken: () => string | undefined = defaultGhToken,
  readStoredToken: () => string | undefined = readUserToken,
): { token: string; source: 'env' | 'user' | 'gh' } | undefined {
  const envToken = env.PICBED_GITHUB_TOKEN || env.GITHUB_TOKEN;
  if (envToken) return { token: envToken, source: 'env' };
  const stored = readStoredToken();
  if (stored) return { token: stored, source: 'user' };
  const gh = execGhToken();
  if (gh) return { token: gh, source: 'gh' };
  return undefined;
}

export function defaultGhToken(): string | undefined {
  return probeGhToken().token;
}

const NOT_LOGGED_IN = 'gh 已安装但未登录：请在终端运行 `gh auth login` 后重试';
const NOT_INSTALLED =
  '未检测到 GitHub CLI（gh）。请安装：https://cli.github.com/ 后运行 `gh auth login`；或设置环境变量 PICBED_GITHUB_TOKEN / GITHUB_TOKEN';

/**
 * gh 登录态探测：区分「未安装 / 未登录 / 其它错误」，便于 UI 给出可执行建议。
 */
export function probeGhToken(): {
  token?: string;
  reason?: 'not-installed' | 'not-logged-in' | 'failed';
  message?: string;
} {
  // Windows: gh ships as gh.exe (MSI/winget) or a gh.cmd shim (Scoop/choco).
  // Node >=20.12 refuses to spawn .cmd/.bat without shell:true (EINVAL, CVE-2024-27980),
  // so .cmd candidates must opt into the shell.
  const candidates =
    process.platform === 'win32'
      ? [
          { bin: 'gh.exe', shell: false },
          { bin: 'gh', shell: false },
          { bin: 'gh.cmd', shell: true },
        ]
      : [{ bin: 'gh', shell: false }];

  let sawExecutable = false;
  for (const { bin, shell } of candidates) {
    let out: string;
    try {
      out = execFileSync(bin, ['auth', 'token'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
        windowsHide: true,
        shell,
      });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const notFound =
        e.code === 'ENOENT' ||
        /not found|not recognized|ENOENT/i.test(String(e.message || ''));
      if (!notFound) sawExecutable = true; // gh ran but exited non-zero (e.g. not logged in)
      continue;
    }
    const token = out.trim();
    if (token) return { token };
    return { reason: 'not-logged-in', message: NOT_LOGGED_IN };
  }

  if (!sawExecutable) {
    return { reason: 'not-installed', message: NOT_INSTALLED };
  }
  return { reason: 'not-logged-in', message: NOT_LOGGED_IN };
}

/**
 * 查找 gh 可执行文件（Windows: gh.exe / gh / gh.cmd）。
 * 返回 { bin, shell } 或 undefined。
 */
function findGhBinary(): { bin: string; shell: boolean } | undefined {
  const candidates =
    process.platform === 'win32'
      ? [
          { bin: 'gh.exe', shell: false },
          { bin: 'gh', shell: false },
          { bin: 'gh.cmd', shell: true },
        ]
      : [{ bin: 'gh', shell: false }];
  for (const { bin, shell } of candidates) {
    try {
      execFileSync(bin, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000,
        windowsHide: true,
        shell,
      });
      return { bin, shell };
    } catch {
      // continue to next candidate
    }
  }
  return undefined;
}

/**
 * 启动 gh auth login --web（非交互 stdin）。
 *
 * gh auth login 的交互菜单在不同版本中略有不同，但 `--web` + `--hostname` + `--git-protocol`
 * 可以跳过大部分选项。剩余的确认提示通过 stdin 传 \n 选默认。
 *
 * 调用方通过回调接收 stdout/stderr 的实时输出（用于前端显示进度）。
 */
export function spawnGhLogin(
  onData: (chunk: string) => void,
): { process: ReturnType<typeof spawn>; promise: Promise<void> } {
  const gh = findGhBinary();
  if (!gh) {
    throw new Error(NOT_INSTALLED);
  }

  const child = spawn(gh.bin, ['auth', 'login', '--web', '--hostname', 'github.com', '--git-protocol', 'https'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: gh.shell,
    windowsHide: true,
  });

  // 自动回答可能的交互提示（选默认项 = 按回车）
  const autoAnswer = () => {
    try {
      child.stdin.write('\n');
    } catch {
      // stdin 可能已关闭
    }
  };
  // 多次写以覆盖多步交互
  setTimeout(autoAnswer, 300);
  setTimeout(autoAnswer, 1000);
  setTimeout(autoAnswer, 2000);
  setTimeout(autoAnswer, 3000);

  const promise = new Promise<void>((resolve, reject) => {
    let settled = false;
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdoutChunks.push(text);
      onData(text);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderrChunks.push(text);
      onData(text);
    });
    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve();
      } else {
        const combined = [...stdoutChunks, ...stderrChunks].join('').trim();
        reject(new Error(combined || `gh auth login exited with code ${code}`));
      }
    });
  });

  return { process: child, promise };
}

