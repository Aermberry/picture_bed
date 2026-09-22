import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import {
  CONFIG_NAME,
  configTemplate,
  getToken,
  loadConfig,
  maskToken,
  validateStyle,
} from './config.js';
import { extractRefs } from './extract.js';
import {
  GitHubHostAdapter,
  composeUrls,
  remotePath,
  uploadAsset,
} from './host/github.js';
import {
  findCachedUrl,
  loadManifest,
  saveManifest,
} from './manifest.js';
import { buildPlan } from './plan.js';
import { resolveAssets } from './resolve.js';
import { applyRewrites, mergeManifest, revertDoc, writeDocAtomic } from './rewrite.js';
import { scanDocs } from './scan.js';
import { EXIT, type ExitCode, type JsonEnvelope, type ResolvedConfig } from './types.js';

function emit<T>(
  json: boolean,
  envelope: JsonEnvelope<T>,
  human: () => void,
): void {
  if (json) {
    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
    return;
  }
  human();
}

function fail(
  json: boolean,
  command: string,
  code: ExitCode,
  error: { code: string; message: string; path?: string; hint?: string },
  warnings: string[] = [],
): ExitCode {
  emit(
    json,
    {
      schemaVersion: 1,
      ok: false,
      command,
      warnings,
      error,
    },
    () => {
      console.error(`error[${error.code}]: ${error.message}`);
      if (error.path) console.error(`  path: ${error.path}`);
      if (error.hint) console.error(`  hint: ${error.hint}`);
      for (const w of warnings) console.error(`warn: ${w}`);
    },
  );
  return code;
}

function loadCfg(cwd: string, config?: string): ResolvedConfig {
  return loadConfig({ cwd, configPath: config });
}

async function collect(root: string, cfg: ResolvedConfig) {
  const docs = scanDocs(root, cfg.scan);
  const warnings: string[] = [];
  const allRefs = [];
  const blocked = [];
  const remoteSkips = [];
  const byDoc = new Map<string, string>();

  for (const doc of docs) {
    let text: string;
    try {
      text = fs.readFileSync(doc.path, 'utf8');
    } catch (err) {
      warnings.push(`unreadable doc: ${doc.path}`);
      continue;
    }
    byDoc.set(doc.path, text);
    const refs = extractRefs(doc, text);
    allRefs.push(...refs);
  }

  const resolved = resolveAssets(allRefs, { scanRoot: root });
  blocked.push(...resolved.blocked);
  remoteSkips.push(...resolved.remoteSkips);
  return { docs, byDoc, assets: resolved.assets, blocked, remoteSkips, warnings };
}

export async function run(argv: string[]): Promise<ExitCode> {
  const program = new Command();
  program
    .name('yigecli')
    .description('Extract document images, upload to GitHub image host, rewrite links')
    .option('--json', 'machine-readable output')
    .option('--quiet', 'suppress human logs')
    .option('--verbose', 'verbose logs to stderr')
    .option('--config <file>', 'config path')
    .option('--cwd <dir>', 'working directory', process.cwd())
    .option('--yes', 'skip confirmation for writes')
    .option('--dry-run', 'do not write or upload');

  program
    .command('init')
    .description('write yigecli.toml template')
    .option('--force', 'overwrite existing config')
    .action(() => {
      /* handled below via parse */
    });

  program.command('doctor').description('check config and GitHub auth');
  program
    .command('scan <path>')
    .description('scan docs and extract image refs');
  program
    .command('plan <path>')
    .description('build sync plan without uploading');
  program
    .command('sync <path>')
    .description('upload images and rewrite document links');
  program
    .command('upload <file>')
    .description('upload a single image file');
  program
    .command('revert <path>')
    .description('revert public URLs back to original local refs');
  program
    .command('config')
    .description('get|set|list configuration')
    .argument('[action]', 'get|set|list')
    .argument('[key]', 'config key')
    .argument('[value]', 'config value');

  program.command('commands').description('list commands');

  await program.parseAsync(argv);

  const opts = program.opts<{
    json?: boolean;
    quiet?: boolean;
    verbose?: boolean;
    config?: string;
    cwd: string;
    yes?: boolean;
    dryRun?: boolean;
  }>();
  const json = Boolean(opts.json);
  const args = program.args;
  // commander puts subcommand name in args when using parseAsync with action-less commands
  // Prefer operands from raw argv for robustness
  const raw = argv.slice(2).filter((a) => !a.startsWith('-'));
  const command = raw[0] ?? 'help';
  const p1 = raw[1];
  const p2 = raw[2];
  const p3 = raw[3];
  const cwd = path.resolve(opts.cwd);
  const dryRun = Boolean(opts.dryRun);
  const yes = Boolean(opts.yes);

  try {
    if (command === 'help' || command === '--help' || command === '-h') {
      program.outputHelp();
      return EXIT.OK;
    }

    if (command === 'commands') {
      const data = {
        commands: [
          'init',
          'doctor',
          'scan',
          'plan',
          'sync',
          'upload',
          'revert',
          'config',
          'commands',
        ],
        flags: ['--json', '--quiet', '--verbose', '--config', '--cwd', '--yes', '--dry-run'],
      };
      emit(json, { schemaVersion: 1, ok: true, command, data }, () => {
        console.log(data.commands.join('\n'));
      });
      return EXIT.OK;
    }

    if (command === 'init') {
      const force = argv.includes('--force');
      const target = path.join(cwd, CONFIG_NAME);
      if (fs.existsSync(target) && !force) {
        return fail(json, command, EXIT.USAGE, {
          code: 'E_EXISTS',
          message: `${CONFIG_NAME} already exists`,
          path: target,
          hint: 'use --force to overwrite',
        });
      }
      if (!dryRun) fs.writeFileSync(target, configTemplate(), 'utf8');
      emit(json, { schemaVersion: 1, ok: true, command, data: { path: target, dryRun } }, () => {
        console.log(`wrote ${target}`);
      });
      return EXIT.OK;
    }

    const cfg = loadCfg(cwd, opts.config);

    if (command === 'config') {
      const action = p1 ?? 'list';
      if (action === 'list') {
        const token = getToken();
        const data = {
          github: cfg.github,
          url: cfg.url,
          scan: cfg.scan,
          upload: cfg.upload,
          rewrite: cfg.rewrite,
          token: maskToken(token),
          configPath: cfg.configPath,
        };
        emit(json, { schemaVersion: 1, ok: true, command, data }, () => {
          console.log(JSON.stringify(data, null, 2));
        });
        return EXIT.OK;
      }
      if (action === 'get') {
        const key = p2 ?? '';
        const data = resolveConfigKey(cfg, key);
        emit(json, { schemaVersion: 1, ok: true, command, data }, () => {
          console.log(String(data));
        });
        return EXIT.OK;
      }
      if (action === 'set') {
        if (!yes && !dryRun) {
          return fail(json, command, EXIT.CONFIRM, {
            code: 'E_CONFIRM',
            message: 'config set writes files; pass --yes',
          });
        }
        const key = p2 ?? '';
        const value = p3 ?? '';
        if (key === 'url.style' && !validateStyle(value)) {
          return fail(json, command, EXIT.USAGE, {
            code: 'E_STYLE',
            message: 'url.style must be raw|jsdelivr|custom',
          });
        }
        const out = applyConfigSet(cfg, key, value, dryRun);
        emit(json, { schemaVersion: 1, ok: true, command, data: out }, () => {
          console.log(`set ${key}=${value}`);
        });
        return EXIT.OK;
      }
      return fail(json, command, EXIT.USAGE, {
        code: 'E_USAGE',
        message: 'config action must be get|set|list',
      });
    }

    if (command === 'doctor') {
      const checks: { name: string; ok: boolean; detail: string }[] = [];
      const required = [
        ['github.owner', cfg.github.owner],
        ['github.repo', cfg.github.repo],
        ['github.branch', cfg.github.branch],
      ] as const;
      for (const [name, val] of required) {
        checks.push({
          name,
          ok: Boolean(val),
          detail: val ? 'set' : 'missing',
        });
      }
      const token = getToken();
      checks.push({
        name: 'token',
        ok: Boolean(token),
        detail: token ? `present (${maskToken(token)})` : 'missing YIGE_GITHUB_TOKEN',
      });

      let apiOk = false;
      let apiDetail = 'skipped';
      if (token && cfg.github.owner && cfg.github.repo) {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${cfg.github.owner}/${cfg.github.repo}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'yigecli',
              },
            },
          );
          apiOk = res.ok;
          apiDetail = `HTTP ${res.status}`;
        } catch (err) {
          apiDetail = String(err);
        }
      }
      checks.push({ name: 'github.api', ok: apiOk, detail: apiDetail });

      const failures = checks.filter((c) => !c.ok).map((c) => c.name);
      const ok = failures.length === 0;
      const data = { ok, checks, failures };
      emit(json, { schemaVersion: 1, ok, command, data, error: ok ? null : { code: 'E_DOCTOR', message: 'doctor failed: ' + failures.join(',') } }, () => {
        for (const c of checks) {
          console.log(`${c.ok ? 'OK ' : 'FAIL'} ${c.name}: ${c.detail}`);
        }
      });
      return ok ? EXIT.OK : EXIT.CONFIG;
    }

    if (command === 'scan' || command === 'plan' || command === 'sync' || command === 'revert') {
      const target = p1;
      if (!target) {
        return fail(json, command, EXIT.USAGE, {
          code: 'E_USAGE',
          message: 'missing <path>',
        });
      }
      const root = path.resolve(cwd, target);

      if (command === 'revert') {
        const manifest = loadManifest(cwd);
        const docs = scanDocs(root, cfg.scan);
        const rewritten: string[] = [];
        for (const doc of docs) {
          const text = fs.readFileSync(doc.path, 'utf8');
          const entries = manifest.entries.filter((e) => path.resolve(cwd, e.doc) === doc.path);
          if (!entries.length) continue;
          const next = revertDoc(text, entries);
          if (next === text) continue;
          if (!dryRun) {
            if (!yes) {
              return fail(json, command, EXIT.CONFIRM, {
                code: 'E_CONFIRM',
                message: 'revert writes files; pass --yes or --dry-run',
              });
            }
            writeDocAtomic(doc.path, next);
          }
          rewritten.push(path.relative(cwd, doc.path).split(path.sep).join('/'));
        }
        emit(json, { schemaVersion: 1, ok: true, command, data: { rewritten, dryRun } }, () => {
          console.log(rewritten.join('\n') || '(no changes)');
        });
        return EXIT.OK;
      }

      const collected = await collect(root, cfg);
      const manifest = loadManifest(cwd);
      const plan = buildPlan({
        assets: collected.assets,
        blocked: collected.blocked,
        remoteSkips: collected.remoteSkips,
        manifest,
      });

      if (command === 'scan') {
        const data = {
          docs: collected.docs.map((d) => path.relative(cwd, d.path)),
          refCount: plan.length,
          assets: collected.assets.map((a) => ({
            localPath: a.localPath,
            sha256: a.sha256,
            bytes: a.bytes,
            refs: a.refs.length,
          })),
          blocked: collected.blocked.map((b) => ({
            raw: b.ref.raw,
            code: b.code,
            reason: b.reason,
          })),
        };
        emit(json, { schemaVersion: 1, ok: true, command, data, warnings: collected.warnings }, () => {
          console.log(JSON.stringify(data, null, 2));
        });
        return collected.blocked.length && !collected.assets.length ? EXIT.LOCAL : EXIT.OK;
      }

      const summary = summarize(plan);
      if (command === 'plan' || dryRun) {
        const data = { plan: plan.map(publicPlanItem), summary };
        emit(json, { schemaVersion: 1, ok: true, command: command === 'sync' ? 'sync' : command, data, warnings: collected.warnings }, () => {
          console.log(JSON.stringify(data, null, 2));
        });
        return EXIT.OK;
      }

      // sync (write)
      if (!yes) {
        return fail(json, command, EXIT.CONFIRM, {
          code: 'E_CONFIRM',
          message: 'sync writes documents and uploads; pass --yes or use --dry-run',
        }, collected.warnings);
      }

      const token = getToken();
      if (!token) {
        return fail(json, command, EXIT.CONFIG, {
          code: 'E_TOKEN',
          message: 'missing YIGE_GITHUB_TOKEN',
        }, collected.warnings);
      }
      if (!cfg.github.owner || !cfg.github.repo) {
        return fail(json, command, EXIT.CONFIG, {
          code: 'E_CONFIG',
          message: 'github.owner/repo required',
        }, collected.warnings);
      }

      const host = new GitHubHostAdapter(cfg.github, token);
      const errors: string[] = [];
      const warnings = [...collected.warnings];
      let uploaded = 0;
      const urlBySha = new Map<string, string>();

      // upload unique assets
      const unique = new Map<string, (typeof collected.assets)[number]>();
      for (const item of plan) {
        if (item.action !== 'upload' || !item.asset) continue;
        unique.set(item.asset.sha256, item.asset);
      }
      for (const asset of unique.values()) {
        try {
          const cached = findCachedUrl(manifest, asset.sha256);
          if (cached) {
            urlBySha.set(asset.sha256, cached);
            continue;
          }
          const bytes = fs.readFileSync(asset.localPath);
          const remote = await uploadAsset(host, {
            asset,
            bytes,
            cfg,
          });
          urlBySha.set(asset.sha256, remote.publicUrl);
          uploaded += 1;
          mergeManifest(manifest, [
            {
              doc: '',
              raw: '',
              localPath: asset.localPath,
              sha256: asset.sha256,
              publicUrl: remote.publicUrl,
              updatedAt: new Date().toISOString(),
            },
          ]);
        } catch (err) {
          errors.push(`${asset.localPath}: ${String(err)}`);
        }
      }

      // rewrite docs
      const rewrittenDocs: string[] = [];
      const byDoc = new Map<string, ReturnType<typeof publicPlanItem>[]>();
      for (const docPath of collected.byDoc.keys()) {
        const text = collected.byDoc.get(docPath) ?? '';
        const items = plan
          .filter((it) => it.ref && it.ref.docPath === docPath)
          .map((it) => {
            const url =
              it.action === 'upload' || it.action === 'skip-cache'
                ? urlBySha.get(it.asset?.sha256 ?? '')
                : it.remote?.publicUrl;
            return { it, url };
          })
          .filter((x): x is { it: (typeof plan)[number]; url: string } => Boolean(x.url));

        if (!items.length) continue;
        try {
          const result = applyRewrites({
            docPath,
            content: text,
            items: items.map((x) => ({
              ref: x.it.ref!,
              publicUrl: x.url,
              localPath: x.it.asset?.localPath ?? '',
              sha256: x.it.asset?.sha256 ?? '',
            })),
            rootDir: cwd,
            backup: cfg.rewrite.backup,
            dryRun: false,
          });
          mergeManifest(manifest, result.entries);
          rewrittenDocs.push(path.relative(cwd, docPath).split(path.sep).join('/'));
        } catch (err) {
          errors.push(`${docPath}: ${String(err)}`);
        }
        void byDoc;
      }

      try {
        saveManifest(cwd, manifest);
      } catch (err) {
        warnings.push(`manifest save failed: ${String(err)}`);
      }

      const ok = errors.length === 0;
      const data = {
        uploaded,
        rewrittenDocs,
        summary,
        errors,
      };
      emit(
        json,
        {
          schemaVersion: 1,
          ok,
          command,
          data,
          warnings,
          error: ok ? null : { code: 'E_PARTIAL', message: errors.join('; ') },
        },
        () => {
          console.log(`uploaded=${uploaded}`);
          console.log(rewrittenDocs.join('\n'));
          for (const e of errors) console.error(e);
        },
      );
      if (!ok && uploaded + rewrittenDocs.length) return EXIT.PARTIAL;
      return ok ? EXIT.OK : EXIT.REMOTE;
    }

    if (command === 'upload') {
      const file = p1;
      if (!file) {
        return fail(json, command, EXIT.USAGE, {
          code: 'E_USAGE',
          message: 'missing <file>',
        });
      }
      const abs = path.resolve(cwd, file);
      if (!fs.existsSync(abs)) {
        return fail(json, command, EXIT.LOCAL, {
          code: 'E_ASSET_MISSING',
          message: 'file not found',
          path: abs,
        });
      }
      const token = getToken();
      if (!token) {
        return fail(json, command, EXIT.CONFIG, {
          code: 'E_TOKEN',
          message: 'missing YIGE_GITHUB_TOKEN',
        });
      }
      const bytes = fs.readFileSync(abs);
      const crypto = await import('node:crypto');
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      const host = new GitHubHostAdapter(cfg.github, token);
      const remote = await uploadAsset(host, {
        asset: { localPath: abs, sha256 },
        bytes,
        cfg,
      });
      const urls = composeUrls(cfg, remote.repoPath);
      emit(json, { schemaVersion: 1, ok: true, command, data: { ...remote, ...urls, remotePath: remotePath(cfg.github.dir, sha256, abs) } }, () => {
        console.log(remote.publicUrl);
      });
      return EXIT.OK;
    }

    return fail(json, command, EXIT.USAGE, {
      code: 'E_USAGE',
      message: `unknown command: ${command}`,
      hint: 'yigecli commands',
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    return fail(json, command, EXIT.GENERAL, {
      code: e.code ?? 'E_GENERAL',
      message: e.message,
    });
  }
}

function summarize(plan: { action: string }[]): Record<string, number> {
  const s: Record<string, number> = {
    upload: 0,
    'skip-cache': 0,
    'skip-remote': 0,
    'rewrite-only': 0,
    blocked: 0,
  };
  for (const p of plan) {
    s[p.action] = (s[p.action] ?? 0) + 1;
  }
  return s;
}

function publicPlanItem(it: {
  action: string;
  reason?: string;
  ref?: { raw: string; docPath: string };
  asset?: { sha256: string; localPath: string };
  remote?: { publicUrl: string };
}) {
  return {
    action: it.action,
    reason: it.reason,
    raw: it.ref?.raw,
    doc: it.ref?.docPath,
    sha256: it.asset?.sha256,
    publicUrl: it.remote?.publicUrl,
  };
}

function resolveConfigKey(cfg: ResolvedConfig, key: string): unknown {
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

function applyConfigSet(
  cfg: ResolvedConfig,
  key: string,
  value: string,
  dryRun: boolean,
): Record<string, unknown> {
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
