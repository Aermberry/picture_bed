import fs from 'node:fs';
import path from 'node:path';

export interface WatchOptions {
  root: string;
  ignore?: (relPath: string) => boolean;
  debounceMs?: number;
  onTrigger: (changed: string[]) => void | Promise<void>;
}

export interface Watcher {
  close(): void;
  /** Resolves when the watcher has stopped (close or signal). */
  closed: Promise<void>;
  /** Test hook: simulate a filesystem event. */
  notify(relOrAbs: string): void;
}

function defaultIgnore(rel: string): boolean {
  const parts = rel.split(/[\\/]/);
  return parts.some((p) => p === 'node_modules' || p === '.git' || p === '.picbed');
}

/**
 * F12: directory-change watcher with debounced batch triggers.
 * No elevated privileges — user-space fs.watch only.
 */
export function startWatch(opts: WatchOptions): Watcher {
  const root = path.resolve(opts.root);
  const debounceMs = opts.debounceMs ?? 300;
  const ignore = opts.ignore ?? defaultIgnore;
  const pending = new Set<string>();
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> | undefined;
  let closedResolve!: () => void;
  const closed = new Promise<void>((resolve) => {
    closedResolve = resolve;
  });

  const flush = async () => {
    if (!pending.size) return;
    const batch = [...pending];
    pending.clear();
    running = Promise.resolve(opts.onTrigger(batch))
      .catch(() => undefined)
      .then(() => {
        running = undefined;
      });
    await running;
  };

  const notify = (relOrAbs: string) => {
    const abs = path.resolve(root, relOrAbs);
    let rel = path.relative(root, abs);
    if (rel.startsWith('..')) rel = abs;
    if (ignore(rel)) return;
    pending.add(rel.split(path.sep).join('/'));
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void flush();
    }, debounceMs);
  };

  const watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    notify(filename.toString());
  });

  const close = () => {
    if (timer) clearTimeout(timer);
    try {
      watcher.close();
    } catch {
      /* already closed */
    }
    closedResolve();
  };

  return { close, closed, notify };
}
