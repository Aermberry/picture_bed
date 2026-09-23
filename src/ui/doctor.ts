import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_NAME, configTemplate, getToken, maskToken, validateStyle } from '../config.js';
import type { ResolvedConfig } from '../types.js';

export function doctorView(cfg: ResolvedConfig): {
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
  failures: string[];
} {
  const checks: { name: string; ok: boolean; detail: string }[] = [];
  if (cfg.host.type === 'github') {
    const required = [
      ['github.owner', cfg.github.owner],
      ['github.repo', cfg.github.repo],
      ['github.branch', cfg.github.branch],
    ] as const;
    for (const [name, val] of required) {
      checks.push({ name, ok: Boolean(val), detail: val ? 'set' : 'missing' });
    }
  } else {
    checks.push({ name: 'host.type', ok: true, detail: 'local (no token required)' });
  }

  const token = getToken();
  const needToken = cfg.host.type === 'github';
  checks.push({
    name: 'token',
    ok: needToken ? Boolean(token) : true,
    detail: !needToken
      ? 'not required for local host'
      : token
        ? `present (${maskToken(token)})`
        : 'missing — set PICBED_GITHUB_TOKEN (PAT) or install GitHub CLI `gh` and run `gh auth login`',
  });

  const failures = checks.filter((c) => !c.ok).map((c) => c.name);
  return { ok: failures.length === 0, checks, failures };
}

export function publicConfig(cfg: ResolvedConfig, extra?: Record<string, unknown>) {
  return {
    host: cfg.host,
    github: cfg.github,
    local: {
      root: cfg.local.root,
      publicBase: cfg.local.publicBase,
      dir: cfg.local.dir,
    },
    url: cfg.url,
    scan: cfg.scan,
    upload: cfg.upload,
    rewrite: cfg.rewrite,
    token: maskToken(getToken()),
    configPath: cfg.configPath,
    ...extra,
  };
}

export function applyConfigSet(
  cfg: ResolvedConfig,
  key: string,
  value: string,
  dryRun: boolean,
): { key: string; value: string; file: string; dryRun: boolean } {
  if (key === 'url.style' && !validateStyle(value)) {
    throw Object.assign(new Error('url.style must be raw|jsdelivr|custom'), { code: 'E_STYLE' });
  }
  const file = cfg.configPath ?? path.join(cfg.rootDir, CONFIG_NAME);
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : configTemplate();
  const sectionOf: Record<string, string> = {
    'github.owner': 'github',
    'github.repo': 'github',
    'github.branch': 'github',
    'github.dir': 'github',
    'url.style': 'url',
  };
  const fieldOf: Record<string, string> = {
    'github.owner': 'owner',
    'github.repo': 'repo',
    'github.branch': 'branch',
    'github.dir': 'dir',
    'url.style': 'style',
  };
  const section = sectionOf[key];
  const field = fieldOf[key];
  if (!section || !field) {
    throw Object.assign(new Error(`unsupported key: ${key}`), { code: 'E_USAGE' });
  }
  const sectionRe = new RegExp(`(\\[${section}\\][\\s\\S]*?)(\\n\\[|$)`);
  if (sectionRe.test(text)) {
    text = text.replace(sectionRe, (_m, body: string, end: string) => {
      const lineRe = new RegExp(`^${field}\\s*=.*$`, 'm');
      if (lineRe.test(body)) {
        return body.replace(lineRe, `${field} = "${value}"`) + end;
      }
      return body + `${field} = "${value}"\n` + end;
    });
  }
  if (!dryRun) fs.writeFileSync(file, text, 'utf8');
  return { key, value, file, dryRun };
}
