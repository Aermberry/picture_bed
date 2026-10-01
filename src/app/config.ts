import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG_NAME,
  configTemplate,
  normalizeGithubRef,
  parseSimpleToml,
  validateHostType,
  validateStyle,
} from '../config.js';
import type { ResolvedConfig } from '../types.js';
import { AppError } from './errors.js';

export function readConfigKey(cfg: ResolvedConfig, key: string): unknown {
  const map: Record<string, unknown> = {
    'github.owner': cfg.github.owner,
    'github.repo': cfg.github.repo,
    'github.branch': cfg.github.branch,
    'github.dir': cfg.github.dir,
    'url.style': cfg.url.style,
    'upload.concurrency': cfg.upload.concurrency,
    'rewrite.backup': cfg.rewrite.backup,
  };
  return map[key] ?? null;
}

const SECTION_OF: Record<string, string> = {
  'github.owner': 'github',
  'github.repo': 'github',
  'github.branch': 'github',
  'github.dir': 'github',
  'url.style': 'url',
};

const FIELD_OF: Record<string, string> = {
  'github.owner': 'owner',
  'github.repo': 'repo',
  'github.branch': 'branch',
  'github.dir': 'dir',
  'url.style': 'style',
};

export function writeConfigKey(
  cfg: ResolvedConfig,
  key: string,
  value: string,
  dryRun: boolean,
): { key: string; value: string; file: string; dryRun: boolean } {
  if (key === 'url.style' && !validateStyle(value)) {
    throw new AppError('E_STYLE', 'url.style must be raw|jsdelivr|custom');
  }
  const section = SECTION_OF[key];
  const field = FIELD_OF[key];
  if (!section || !field) {
    throw new AppError('E_USAGE', `unsupported key: ${key}`);
  }
  const file = cfg.configPath ?? path.join(cfg.rootDir, CONFIG_NAME);
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : configTemplate();
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

function tomlStr(s: string): string {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n') + '"';
}

/** Serialize a resolved config to portable picbed.toml text. Never includes tokens. */
export function serializeConfigToml(cfg: ResolvedConfig): string {
  const lines: string[] = [
    '# picbed configuration — do not put tokens here',
    '# Use env: PICBED_GITHUB_TOKEN',
    '',
    '[host]',
    `type = ${tomlStr(cfg.host.type)}`,
    '',
    '[github]',
    `owner = ${tomlStr(cfg.github.owner)}`,
    `repo = ${tomlStr(cfg.github.repo)}`,
    `branch = ${tomlStr(cfg.github.branch)}`,
    `dir = ${tomlStr(cfg.github.dir)}`,
    '',
    '[local]',
    `root = ${tomlStr(cfg.local.root)}`,
    `public_base = ${tomlStr(cfg.local.publicBase)}`,
    `dir = ${tomlStr(cfg.local.dir)}`,
    '',
    '[url]',
    `style = ${tomlStr(cfg.url.style)}`,
  ];
  if (cfg.url.customTemplate) lines.push(`custom_template = ${tomlStr(cfg.url.customTemplate)}`);
  lines.push(
    '',
    '[scan]',
    `extensions = ${tomlStr(cfg.scan.extensions.join(','))}`,
    `ignore = ${tomlStr(cfg.scan.ignore.join(','))}`,
    '',
    '[upload]',
    `concurrency = ${cfg.upload.concurrency}`,
    `commit_message = ${tomlStr(cfg.upload.commitMessage)}`,
    '',
    '[rewrite]',
    `backup = ${cfg.rewrite.backup ? 'true' : 'false'}`,
    '',
  );
  return lines.join('\n');
}

const splitList = (v: string): string[] =>
  v.split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Validate + merge an imported picbed.toml over the current config and write it.
 * Rejects bad host.type / url.style / concurrency before touching disk.
 */
export function importConfigToml(
  base: ResolvedConfig,
  tomlText: string,
  dryRun: boolean,
): { file: string; dryRun: boolean; config: ResolvedConfig } {
  const parsed = parseSimpleToml(tomlText);

  const hostTypeRaw = parsed.host?.type ?? base.host.type;
  if (!validateHostType(hostTypeRaw)) {
    throw new AppError('E_CONFIG', `host.type must be github|local, got: ${hostTypeRaw}`);
  }
  const styleRaw = parsed.url?.style ?? base.url.style;
  if (!validateStyle(styleRaw)) {
    throw new AppError('E_STYLE', 'url.style must be raw|jsdelivr|custom');
  }
  const concurrencyRaw = parsed.upload?.concurrency ?? String(base.upload.concurrency);
  const concurrency = Number(concurrencyRaw);
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new AppError('E_CONFIG', `upload.concurrency must be a positive integer, got: ${concurrencyRaw}`);
  }

  const gh = normalizeGithubRef(
    parsed.github?.owner ?? base.github.owner,
    parsed.github?.repo ?? base.github.repo,
  );

  const merged: ResolvedConfig = {
    ...base,
    host: { type: hostTypeRaw },
    github: {
      owner: gh.owner,
      repo: gh.repo,
      branch: parsed.github?.branch ?? base.github.branch,
      dir: parsed.github?.dir ?? base.github.dir,
    },
    local: {
      root: parsed.local?.root ?? base.local.root,
      publicBase: parsed.local?.public_base ?? base.local.publicBase,
      dir: parsed.local?.dir ?? base.local.dir,
    },
    url: {
      style: styleRaw,
      customTemplate: parsed.url?.custom_template ?? base.url.customTemplate,
    },
    scan: {
      extensions: splitList(parsed.scan?.extensions ?? base.scan.extensions.join(',')),
      ignore: splitList(parsed.scan?.ignore ?? base.scan.ignore.join(',')),
    },
    upload: {
      concurrency,
      commitMessage: parsed.upload?.commit_message ?? base.upload.commitMessage,
    },
    rewrite: {
      backup: String(parsed.rewrite?.backup ?? base.rewrite.backup) !== 'false',
    },
  };

  const file = base.configPath ?? path.join(base.rootDir, CONFIG_NAME);
  if (!dryRun) fs.writeFileSync(file, serializeConfigToml(merged), 'utf8');
  return { file, dryRun, config: merged };
}
