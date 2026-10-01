import fs from 'node:fs';
import path from 'node:path';
import { resolveToken } from './infra/gh-cli.js';
import type { ResolvedConfig, UrlConfig } from './types.js';

export const CONFIG_NAME = 'picbed.toml';

const DEFAULTS: Omit<ResolvedConfig, 'rootDir' | 'configPath'> = {
  host: { type: 'github' },
  github: {
    owner: '',
    repo: '',
    branch: 'main',
    dir: 'img',
  },
  local: {
    root: '.picbed/host-root',
    publicBase: 'https://cdn.example.com',
    dir: 'img',
  },
  url: { style: 'jsdelivr' },
  scan: {
    extensions: ['md', 'html', 'htm'],
    ignore: ['**/node_modules/**', '**/.git/**', '**/.picbed/**'],
  },
  upload: {
    concurrency: 3,
    commitMessage: 'chore(picbed): upload images',
  },
  rewrite: { backup: true },
};

const TOML_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  b: '\b',
  f: '\f',
  '"': '"',
  '\\': '\\',
  '/': '/',
};

/** Unescape a TOML basic string body (quotes already stripped). */
function unescapeTomlBasicString(s: string): string {
  return s.replace(/\\(u[0-9a-fA-F]{4}|.)/gs, (_m, g: string) => {
    if (g.startsWith('u')) return String.fromCharCode(parseInt(g.slice(1), 16));
    return TOML_ESCAPES[g] ?? g;
  });
}

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
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = unescapeTomlBasicString(value.slice(1, -1));
    } else if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
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

/**
 * Normalize a GitHub owner/repo reference to bare slugs.
 * Users often paste a full URL (`https://github.com/o/r`, `git@github.com:o/r.git`)
 * or an `o/r` slug into the repo field; the rest of the code interpolates
 * `repos/${owner}/${repo}`, so a URL there yields a malformed API path (GitHub 404).
 */
export function normalizeGithubRef(
  rawOwner: string,
  rawRepo: string,
): { owner: string; repo: string } {
  const stripProto = (s: string) =>
    s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^git@/i, '');

  let owner = (rawOwner || '').trim();
  let repo = (rawRepo || '').trim().replace(/[\/\\]+$/, '');

  const isUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(repo) || /^git@/i.test(repo);
  if (isUrl || repo.includes('/')) {
    // Split on "/", "\" and the scp-style ":"; drop a leading host segment (has a dot).
    const parts = stripProto(repo)
      .replace(/\.git$/i, '')
      .split(/[\\/:]/)
      .filter(Boolean);
    if (parts.length && parts[0].includes('.')) parts.shift();
    if (parts.length >= 2) {
      owner = parts[parts.length - 2];
      repo = parts[parts.length - 1];
    } else if (parts.length === 1) {
      repo = parts[0];
    }
  } else {
    repo = repo.replace(/\.git$/i, '');
  }

  // owner must be a bare slug too (defensive against a URL/slash in the owner field).
  const ownerParts = stripProto(owner)
    .replace(/\.git$/i, '')
    .split(/[\\/:]/)
    .filter(Boolean);
  if (ownerParts.length && ownerParts[0].includes('.')) ownerParts.shift();
  owner = ownerParts[ownerParts.length - 1] ?? '';

  return { owner, repo };
}

export function findConfigPath(startDir: string): string | undefined {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, CONFIG_NAME);
    if (fs.existsSync(candidate)) return candidate;
    const nested = path.join(dir, '.picbed', 'config.toml');
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

  const envOwner = process.env.PICBED_GITHUB_OWNER;
  const envRepo = process.env.PICBED_GITHUB_REPO;
  const envBranch = process.env.PICBED_GITHUB_BRANCH;
  const envDir = process.env.PICBED_GITHUB_DIR;
  const envStyle = process.env.PICBED_URL_STYLE as UrlConfig['style'] | undefined;

  const styleRaw = envStyle ?? fileData.url?.style ?? DEFAULTS.url.style;
  const style: UrlConfig['style'] =
    styleRaw === 'raw' || styleRaw === 'custom' ? styleRaw : 'jsdelivr';

  const hostTypeRaw =
    process.env.PICBED_HOST_TYPE ?? fileData.host?.type ?? DEFAULTS.host.type;
  const hostType = hostTypeRaw === 'local' ? ('local' as const) : ('github' as const);

  const ghRef = normalizeGithubRef(
    envOwner ?? fileData.github?.owner ?? DEFAULTS.github.owner,
    envRepo ?? fileData.github?.repo ?? DEFAULTS.github.repo,
  );

  const cfg: ResolvedConfig = {
    host: { type: hostType },
    github: {
      owner: ghRef.owner,
      repo: ghRef.repo,
      branch: envBranch ?? fileData.github?.branch ?? DEFAULTS.github.branch,
      dir: envDir ?? fileData.github?.dir ?? DEFAULTS.github.dir,
    },
    local: {
      root: process.env.PICBED_LOCAL_ROOT ?? fileData.local?.root ?? DEFAULTS.local.root,
      publicBase:
        process.env.PICBED_LOCAL_PUBLIC_BASE ??
        fileData.local?.public_base ??
        DEFAULTS.local.publicBase,
      dir: fileData.local?.dir ?? DEFAULTS.local.dir,
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
  return resolveToken()?.token;
}

export function configTemplate(overrides?: Partial<{ owner: string; repo: string }>): string {
  const owner = overrides?.owner ?? 'your-github-user';
  const repo = overrides?.repo ?? 'pic-bed';
  return `# picbed configuration — do not put tokens here
# Use env: PICBED_GITHUB_TOKEN

[host]
type = "github"   # github | local

[github]
owner = "${owner}"
repo = "${repo}"
branch = "main"
dir = "img"

[local]
root = ".picbed/host-root"
public_base = "https://cdn.example.com"
dir = "img"

[url]
style = "jsdelivr"   # raw | jsdelivr | custom
# custom_template = "https://cdn.example.com/{path}"

[scan]
extensions = "md,html,htm"
ignore = "**/node_modules/**,**/.git/**,**/.picbed/**"

[upload]
concurrency = 3
commit_message = "chore(picbed): upload images"

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

export function validateHostType(type: string): type is 'github' | 'local' {
  return type === 'github' || type === 'local';
}
