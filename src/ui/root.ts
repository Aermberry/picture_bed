import fs from 'node:fs';
import path from 'node:path';

/** Bind scan root and map drag-drop relative clues to real FS paths (policy A). */
export class RootBinder {
  constructor(public root: string | null = null) {}

  bind(rootInput: string, cwd: string): string {
    const abs = path.resolve(cwd, rootInput);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      throw Object.assign(new Error(`root is not a directory: ${abs}`), {
        code: 'E_ROOT',
        path: abs,
      });
    }
    this.root = abs;
    return abs;
  }

  requireRoot(): string {
    if (!this.root) {
      throw Object.assign(new Error('bind a scan root first (drag a folder or set root)'), {
        code: 'E_NO_ROOT',
        hint: 'Policy A: root must be bound before scan/plan/sync',
      });
    }
    return this.root;
  }

  /** Resolve a relative clue under bound root. Returns null + reason if unresolvable. */
  resolveUnderRoot(relOrName: string): { ok: true; path: string } | { ok: false; reason: string; code: string } {
    let root: string;
    try {
      root = this.requireRoot();
    } catch (err) {
      const e = err as Error & { code?: string };
      return { ok: false, reason: e.message, code: e.code ?? 'E_NO_ROOT' };
    }
    const cleaned = relOrName.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleaned || cleaned.includes('\0')) {
      return { ok: false, reason: 'empty or invalid path clue', code: 'E_PATH' };
    }
    if (path.isAbsolute(relOrName) || /^[a-zA-Z]:/.test(relOrName)) {
      return { ok: false, reason: 'absolute paths are not accepted from drag-drop', code: 'E_PATH_ABS' };
    }
    const abs = path.resolve(root, cleaned);
    const rel = path.relative(root, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return { ok: false, reason: 'path escapes scan root', code: 'E_PATH_ESCAPE' };
    }
    return { ok: true, path: abs };
  }
}

export function ensureDocExt(p: string, extensions: string[]): boolean {
  const ext = path.extname(p).replace(/^\./, '').toLowerCase();
  return extensions.includes(ext);
}
