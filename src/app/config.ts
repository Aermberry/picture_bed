import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_NAME, configTemplate, validateStyle } from '../config.js';
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
