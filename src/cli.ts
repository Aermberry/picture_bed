import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import {
  asAppError,
  doctorService,
  exitCodeForCode,
  githubProbe,
  publicConfig,
  publicPlanItem,
  readConfigKey,
  runPlan,
  runRevert,
  runSync,
  TOKEN_HINT,
  writeConfigKey,
} from './app/index.js';
import { CONFIG_NAME, configTemplate, getToken, loadConfig } from './config.js';
import { createHostAdapter, hostRequiresToken, uploadAsset } from './host/index.js';
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


export async function run(argv: string[]): Promise<ExitCode> {
  const program = new Command();
  program
    .name('picbed')
    .description('Extract document images, upload to GitHub image host, rewrite links')
    .option('--json', 'machine-readable output')
    .option('--quiet', 'suppress human logs')
    .option('--verbose', 'verbose logs to stderr')
    .option('--config <file>', 'config path')
    .option('--cwd <dir>', 'working directory', process.cwd())
    .option('--yes', 'skip confirmation for writes')
    .option('--dry-run', 'do not write or upload');

  program.command('init').description('write picbed.toml template')
    .option('--force', 'overwrite existing config');
  program
    .command('login')
    .description('removed — use PAT or GitHub CLI (`gh`)')
    .action(() => {
      /* handled below */
    });
  program
    .command('logout')
    .description('removed — use PAT or GitHub CLI (`gh`)')
    .action(() => {
      /* handled below */
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
    .command('watch <path>')
    .description('watch docs and run sync on change (F12)')
    .option('--debounce <ms>', 'debounce window in ms', '300');
  program
    .command('ui')
    .description('start local Web console (F16–F18)')
    .option('--host <host>', 'bind host (default 127.0.0.1)')
    .option('--port <port>', 'bind port (default 4780)')
    .option('--open', 'print URL prominently (browser open is optional)');
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
          'watch',
          'ui',
          'config',
          'commands',
        ],
        flags: ['--json', '--quiet', '--verbose', '--config', '--cwd', '--yes', '--dry-run'],
        hosts: ['github', 'local'],
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

    if (command === 'login' || command === 'logout') {
      return fail(json, command, EXIT.USAGE, {
        code: 'E_AUTH',
        message: `${command} was removed (no OAuth App flow)`,
        hint: TOKEN_HINT,
      });
    }

    const cfg = loadCfg(cwd, opts.config);

    if (command === 'config') {
      const action = p1 ?? 'list';
      if (action === 'list') {
        const data = publicConfig(cfg);
        emit(json, { schemaVersion: 1, ok: true, command, data }, () => {
          console.log(JSON.stringify(data, null, 2));
        });
        return EXIT.OK;
      }
      if (action === 'get') {
        const key = p2 ?? '';
        const data = readConfigKey(cfg, key);
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
        let out: { key: string; value: string; file: string; dryRun: boolean };
        try {
          out = writeConfigKey(cfg, key, value, dryRun);
        } catch (err) {
          const e = asAppError(err);
          return fail(json, command, e.exitCode, {
            code: e.code,
            message: e.message,
            path: e.path,
            hint: e.hint,
          });
        }
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
      const view = await doctorService({ cfg, getToken, probeApi: githubProbe });
      emit(json, {
        schemaVersion: 1,
        ok: view.ok,
        command,
        data: view,
        error: view.ok ? null : { code: 'E_DOCTOR', message: 'doctor failed: ' + view.failures.join(',') },
      }, () => {
        for (const c of view.checks) {
          console.log(`${c.ok ? 'OK ' : 'FAIL'} ${c.name}: ${c.detail}`);
        }
      });
      return view.ok ? EXIT.OK : EXIT.CONFIG;
    }

    if (command === 'ui') {
      const hostArg = argv.find((a) => a.startsWith('--host='))?.split('=')[1]
        ?? (argv.indexOf('--host') >= 0 ? argv[argv.indexOf('--host') + 1] : undefined)
        ?? '127.0.0.1';
      const portArg = argv.find((a) => a.startsWith('--port='))?.split('=')[1]
        ?? (argv.indexOf('--port') >= 0 ? argv[argv.indexOf('--port') + 1] : undefined)
        ?? '4780';
      const host = String(hostArg);
      const port = Number(portArg);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        return fail(json, command, EXIT.USAGE, {
          code: 'E_USAGE',
          message: `invalid --port: ${portArg}`,
        });
      }
      if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
        if (!opts.quiet) {
          console.error(`warn: binding ${host} exposes the console beyond loopback`);
        }
      }
      const { createUiServer } = await import('./ui/index.js');
      const ui = createUiServer({ cwd, configPath: opts.config });
      let handle: Awaited<ReturnType<typeof ui.listen>>;
      try {
        handle = await ui.listen(port, host === 'localhost' ? '127.0.0.1' : host);
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        return fail(json, command, EXIT.USAGE, {
          code: e.code ?? 'E_PORT',
          message: e.code === 'EADDRINUSE' ? `port ${port} is already in use` : String(e.message || err),
        });
      }
      emit(
        json,
        {
          schemaVersion: 1,
          ok: true,
          command,
          data: { url: handle.url, host: handle.host, port: handle.port, rootDir: cwd },
        },
        () => {
          console.log(`picbed ui → ${handle.url}`);
          console.log('drag docs or a folder to set the scan directory. Ctrl+C to stop.');
        },
      );
      const stop = async () => {
        await handle.close();
        process.exit(EXIT.OK);
      };
      process.on('SIGINT', () => void stop());
      process.on('SIGTERM', () => void stop());
      await new Promise(() => {
        /* run until signal */
      });
      return EXIT.OK;
    }

    if (command === 'watch') {
      const target = p1;
      if (!target) {
        return fail(json, command, EXIT.USAGE, {
          code: 'E_USAGE',
          message: 'missing <path>',
        });
      }
      const root = path.resolve(cwd, target);
      const debounceArg = argv.find((a) => a.startsWith('--debounce='));
      const debounceIdx = argv.indexOf('--debounce');
      const debounceRaw =
        debounceArg?.split('=')[1] ??
        (debounceIdx >= 0 ? argv[debounceIdx + 1] : undefined) ??
        '300';
      const debounceMs = Number(debounceRaw);
      if (!Number.isFinite(debounceMs) || debounceMs < 0) {
        return fail(json, command, EXIT.USAGE, {
          code: 'E_USAGE',
          message: `invalid --debounce: ${debounceRaw}`,
        });
      }
      if (!yes && !dryRun) {
        return fail(json, command, EXIT.CONFIRM, {
          code: 'E_CONFIRM',
          message: 'watch may write documents and upload; pass --yes (or --dry-run)',
        });
      }
      const { startWatch } = await import('./watch.js');
      const { fileURLToPath } = await import('node:url');
      const bin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bin/picbed.js');
      const { spawn } = await import('node:child_process');
      let lastCode: ExitCode = EXIT.OK;
      const runOnce = (changed: string[]) =>
        new Promise<void>((resolve) => {
          const childArgs = [bin, 'sync', target];
          if (yes) childArgs.push('--yes');
          if (dryRun) childArgs.push('--dry-run');
          if (json) childArgs.push('--json');
          if (opts.config) childArgs.push('--config', opts.config);
          childArgs.push('--cwd', cwd);
          const child = spawn(process.execPath, childArgs, { stdio: ['ignore', 'inherit', 'inherit'] });
          if (!json && !opts.quiet) {
            console.error(`watch: change -> sync (${changed.length} path(s))`);
          }
          child.on('exit', (code) => {
            lastCode = (code ?? EXIT.GENERAL) as ExitCode;
            resolve();
          });
        });

      const w = startWatch({
        root,
        debounceMs,
        onTrigger: (changed) => runOnce(changed),
      });

      const stop = () => {
        w.close();
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);

      emit(
        json,
        {
          schemaVersion: 1,
          ok: true,
          command,
          data: { root, debounceMs, dryRun, watching: true },
        },
        () => {
          console.log(`watching ${root} (debounce ${debounceMs}ms, Ctrl+C to stop)`);
        },
      );
      await w.closed;
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      return lastCode;
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
        if (!dryRun && !yes) {
          return fail(json, command, EXIT.CONFIRM, {
            code: 'E_CONFIRM',
            message: 'revert writes files; pass --yes or --dry-run',
          });
        }
        const result = runRevert({ root, cfg, cwd, dryRun, command });
        if (!result.ok && result.errorCode === 'E_MANIFEST_CORRUPT') {
          return fail(json, command, exitCodeForCode(result.errorCode), {
            code: result.errorCode,
            message: result.errors.join('; '),
          });
        }
        const data = { rewritten: result.rewritten, planned: result.planned, dryRun: result.dryRun };
        emit(
          json,
          {
            schemaVersion: 1,
            ok: result.ok,
            command,
            data,
            error: result.ok ? null : { code: result.errorCode ?? 'E_PARTIAL', message: result.errors.join('; ') },
          },
          () => {
            const lines = dryRun ? result.planned : result.rewritten;
            console.log(lines.join('\n') || '(no changes)');
            for (const e of result.errors) console.error(e);
          },
        );
        return result.ok ? EXIT.OK : EXIT.PARTIAL;
      }

      const { collected, plan, summary } = await runPlan(root, cfg, cwd);

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

      if (command === 'plan' || dryRun) {
        const data = { plan: plan.map(publicPlanItem), summary };
        emit(json, { schemaVersion: 1, ok: true, command, data, warnings: collected.warnings }, () => {
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

      let result;
      try {
        result = await runSync({ root, cfg, cwd, getToken, command });
      } catch (err) {
        const e = asAppError(err);
        return fail(json, command, e.exitCode, { code: e.code, message: e.message, path: e.path, hint: e.hint }, collected.warnings);
      }

      const data = {
        uploaded: result.uploaded,
        rewrittenDocs: result.rewrittenDocs,
        summary: result.summary,
        errors: result.errors,
      };
      emit(
        json,
        {
          schemaVersion: 1,
          ok: result.ok,
          command,
          data,
          warnings: result.warnings,
          error: result.ok ? null : { code: result.errorCode ?? 'E_PARTIAL', message: result.errors.join('; ') },
        },
        () => {
          console.log(`uploaded=${result.uploaded}`);
          console.log(result.rewrittenDocs.join('\n'));
          for (const e of result.errors) console.error(e);
        },
      );
      return result.ok ? EXIT.OK : result.partial ? EXIT.PARTIAL : EXIT.REMOTE;
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
      if (hostRequiresToken(cfg) && !token) {
        return fail(json, command, EXIT.CONFIG, {
          code: 'E_TOKEN',
          message: 'missing GitHub token (PICBED_GITHUB_TOKEN / GITHUB_TOKEN / GitHub CLI `gh`)',
          hint: TOKEN_HINT,
        });
      }
      const bytes = fs.readFileSync(abs);
      const crypto = await import('node:crypto');
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      const host = createHostAdapter(cfg, token);
      const remote = await uploadAsset(host, {
        asset: { localPath: abs, sha256 },
        bytes,
        cfg,
      });
      const urls = host.composeUrls(remote.repoPath);
      emit(json, { schemaVersion: 1, ok: true, command, data: { ...remote, ...urls, remotePath: remote.repoPath, hostType: host.type } }, () => {
        console.log(remote.publicUrl);
      });
      return EXIT.OK;
    }

    return fail(json, command, EXIT.USAGE, {
      code: 'E_USAGE',
      message: `unknown command: ${command}`,
      hint: 'picbed commands',
    });
  } catch (err) {
    const e = asAppError(err);
    return fail(json, command, exitCodeForCode(e.code), {
      code: e.code,
      message: e.message,
      path: e.path,
      hint: e.hint,
    });
  }
}
