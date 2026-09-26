import { getToken, maskToken } from '../config.js';
import { probeGithubAccess } from '../host/index.js';
import type { ResolvedConfig } from '../types.js';

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheck[];
  failures: string[];
}

export type DoctorProbe = (
  cfg: ResolvedConfig,
  token: string,
) => Promise<{ api: { ok: boolean; detail: string }; contents: { ok: boolean; detail: string } }>;

export const githubProbe: DoctorProbe = (cfg, token) => probeGithubAccess(cfg.github, token);

export async function doctorService(opts: {
  cfg: ResolvedConfig;
  getToken: () => string | undefined;
  probeApi?: DoctorProbe;
}): Promise<DoctorReport> {
  const { cfg, getToken, probeApi } = opts;
  const checks: DoctorCheck[] = [];

  if (cfg.host.type !== 'github') {
    checks.push({ name: 'host.type', ok: true, detail: 'local (no token required)' });
    return { ok: true, checks, failures: [] };
  }

  const missing = (
    [
      ['github.owner', cfg.github.owner],
      ['github.repo', cfg.github.repo],
      ['github.branch', cfg.github.branch],
    ] as const
  )
    .filter(([, val]) => !val)
    .map(([name]) => name);
  checks.push({
    name: 'github.config',
    ok: missing.length === 0,
    detail: missing.length ? `missing: ${missing.join(', ')}` : 'set',
  });

  const token = getToken();
  checks.push({
    name: 'token',
    ok: Boolean(token),
    detail: token
      ? `present (${maskToken(token)})`
      : 'missing — set PICBED_GITHUB_TOKEN (PAT) or install GitHub CLI `gh` and run `gh auth login`',
  });

  if (!token || missing.length || !probeApi) {
    const reason = !token ? 'missing token' : missing.length ? 'missing config' : 'no probe';
    checks.push({ name: 'github.api', ok: false, detail: `skipped (${reason})` });
    checks.push({ name: 'github.contents', ok: false, detail: `skipped (${reason})` });
  } else {
    const probed = await probeApi(cfg, token);
    checks.push({ name: 'github.api', ...probed.api });
    checks.push({ name: 'github.contents', ...probed.contents });
  }

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
