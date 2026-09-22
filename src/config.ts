import fs from 'node:fs';
import path from 'node:path';
import { resolveToken } from './store.js';
import type { ResolvedConfig, UrlConfig } from './types.js';

export const CONFIG_NAME = 'yigecli.toml';

const DEFAULTS: Omit<ResolvedConfig, 'rootDir' | 'configPath'> = {
  github: {
    owner: '',
    repo: '',
    branch: 'main',
    dir: 'img',
  },
  url: { style: 'jsdelivr' },
  scan: {
    extensions: ['md', 'html', 'htm'],
    ignore: ['**/node_modules/**', '**/.git/**', '**/.yigecli/**'],
  },
  upload: {
    concurrency: 3,
    commitMessage: 'chore(yigecli): upload images',
  },
  rewrite: { backup: true },
};

/** Minimal TOML subset parser for our flat tables. */
export function parseSimpleToml(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  let section = '';
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sec = /^\[([^\]]+)\]$/.exec(line);
    if (sec) {
      section = sec[1];
      if (!out[section]) out[section] = {};
      continue;
    }
    const kv = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
    if (!kv || !section) continue;
    let value = kv[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
        .join(',');
    }
    out[section][kv[1]] = value;
  }
  return out;
}

export function findConfigPath(startDir: string): string | undefined {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, CONFIG_NAME);
    if (fs.existsSync(candidate)) return candidate;
    const nested = path.join(dir, '.yigecli', 'config.toml');
    if (fs.existsSync(nested)) return nested;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export function loadConfig(opts: {
  cwd: string;
  configPath?: string;
  overrides?: Partial<ResolvedConfig>;
}): ResolvedConfig {
  const rootDir = path.resolve(opts.cwd);
  const cfgPath = opts.configPath
    ? path.resolve(opts.configPath)
    : findConfigPath(rootDir);

  let fileData: Record<string, Record<string, string>> = {};
  if (cfgPath && fs.existsSync(cfgPath)) {
    fileData = parseSimpleToml(fs.readFileSync(cfgPath, 'utf8'));
  }

  const envOwner = process.env.YIGE_GITHUB_OWNER;
  const envRepo = process.env.YIGE_GITHUB_REPO;
  const envBranch = process.env.YIGE_GITHUB_BRANCH;
  const envDir = process.env.YIGE_GITHUB_DIR;
  const envStyle = process.env.YIGE_URL_STYLE as UrlConfig['style'] | undefined;

  const styleRaw = envStyle ?? fileData.url?.style ?? DEFAULTS.url.style;
  const style: UrlConfig['style'] =
    styleRaw === 'raw' || styleRaw === 'custom' ? styleRaw : 'jsdelivr';

  const cfg: ResolvedConfig = {
    github: {
      owner: envOwner ?? fileData.github?.owner ?? DEFAULTS.github.owner,
      repo: envRepo ?? fileData.github?.repo ?? DEFAULTS.github.repo,
      branch: envBranch ?? fileData.github?.branch ?? DEFAULTS.github.branch,
      dir: envDir ?? fileData.github?.dir ?? DEFAULTS.github.dir,
    },
    url: {
      style,
      customTemplate: fileData.url?.custom_template ?? fileData.url?.customTemplate,
    },
    scan: {
      extensions: (fileData.scan?.extensions ?? DEFAULTS.scan.extensions.join(','))
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      ignore: (fileData.scan?.ignore ?? DEFAULTS.scan.ignore.join(','))
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
    upload: {
      concurrency: Number(fileData.upload?.concurrency ?? DEFAULTS.upload.concurrency),
      commitMessage:
        fileData.upload?.commit_message ?? DEFAULTS.upload.commitMessage,
    },
    rewrite: {
      backup: String(fileData.rewrite?.backup ?? 'true') !== 'false',
    },
    configPath: cfgPath,
    rootDir,
    ...opts.overrides,
  };
  return cfg;
}

export function getToken(): string | undefined {
  // Lazy import avoided: resolveToken is pure relative to env + user store
  return resolveToken()?.token;
}

export function getOAuthEnv(): { clientId: string; clientSecret: string } {
  return {
    clientId: process.env.YIGE_GITHUB_CLIENT_ID || '',
    clientSecret: process.env.YIGE_GITHUB_CLIENT_SECRET || '',
  };
}

export function configTemplate(overrides?: Partial<{ owner: string; repo: string }>): string {
  const owner = overrides?.owner ?? 'your-github-user';
  const repo = overrides?.repo ?? 'pic-bed';
  return `# yigecli configuration — do not put tokens here
# Use env: YIGE_GITHUB_TOKEN

[github]
owner = "${owner}"
repo = "${repo}"
branch = "main"
dir = "img"

[url]
style = "jsdelivr"   # raw | jsdelivr | custom
# custom_template = "https://cdn.example.com/{path}"

[scan]
extensions = "md,html,htm"
ignore = "**/node_modules/**,**/.git/**,**/.yigecli/**"

[upload]
concurrency = 3
commit_message = "chore(yigecli): upload images"

[rewrite]
backup = true
`;
}

export function maskToken(token: string | undefined): string {
  if (!token) return '';
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '****';
}

export function validateStyle(style: string): style is UrlConfig['style'] {
  return style === 'raw' || style === 'jsdelivr' || style === 'custom';
}
