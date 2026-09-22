import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startWatch } from '../src/watch.js';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'yigecli-watch-'));
}

describe('F12 watch scheduler', () => {
  it('debounces triggers and batches changed paths', async () => {
    const root = tmp();
    const onTrigger = vi.fn();
    const w = startWatch({ root, debounceMs: 20, onTrigger });
    w.notify('a.md');
    w.notify('b.md');
    w.notify('a.md');
    await new Promise((r) => setTimeout(r, 50));
    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(onTrigger.mock.calls[0][0].sort()).toEqual(['a.md', 'b.md']);
    w.close();
  });

  it('ignores node_modules/.git/.yigecli', async () => {
    const root = tmp();
    const onTrigger = vi.fn();
    const w = startWatch({ root, debounceMs: 10, onTrigger });
    w.notify('node_modules/x.png');
    w.notify('.git/config');
    w.notify('.yigecli/manifest.json');
    w.notify('docs/ok.md');
    await new Promise((r) => setTimeout(r, 40));
    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(onTrigger.mock.calls[0][0]).toEqual(['docs/ok.md']);
    w.close();
  });

  it('can exit cleanly', async () => {
    const root = tmp();
    const w = startWatch({ root, debounceMs: 5, onTrigger: () => undefined });
    w.close();
    await w.closed;
    expect(true).toBe(true);
  });
});
