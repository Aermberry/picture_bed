import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractRefs } from '../src/extract.js';
import { buildPlan } from '../src/plan.js';
import { resolveAssets } from '../src/resolve.js';
import { applyRewrites, revertDoc } from '../src/rewrite.js';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'picbed-'));
}

describe('resolveAssets', () => {
  it('resolves relative path and dedupes by sha', () => {
    const root = tmp();
    const doc = path.join(root, 'post.md');
    const img = path.join(root, 'assets', 'a.png');
    fs.mkdirSync(path.dirname(img), { recursive: true });
    fs.writeFileSync(img, Buffer.from([1, 2, 3]));
    fs.writeFileSync(doc, '![a](assets/a.png)\n![b](./assets/a.png)\n');
    const refs = extractRefs({ path: doc, kind: 'markdown' }, fs.readFileSync(doc, 'utf8'));
    const res = resolveAssets(refs, { scanRoot: root });
    expect(res.assets).toHaveLength(1);
    expect(res.assets[0].refs).toHaveLength(2);
  });

  it('blocks missing files', () => {
    const root = tmp();
    const doc = path.join(root, 'post.md');
    fs.writeFileSync(doc, '![a](./nope.png)\n');
    const refs = extractRefs({ path: doc, kind: 'markdown' }, fs.readFileSync(doc, 'utf8'));
    const res = resolveAssets(refs, { scanRoot: root });
    expect(res.blocked).toHaveLength(1);
    expect(res.blocked[0].code).toBe('E_ASSET_MISSING');
  });

  it('skips remote urls', () => {
    const root = tmp();
    const doc = path.join(root, 'post.md');
    fs.writeFileSync(doc, '![a](https://example.com/x.png)\n');
    const refs = extractRefs({ path: doc, kind: 'markdown' }, fs.readFileSync(doc, 'utf8'));
    const res = resolveAssets(refs, { scanRoot: root });
    expect(res.remoteSkips).toHaveLength(1);
  });
});

describe('rewrite + plan', () => {
  it('rewrites only the url slice and reverts', () => {
    const root = tmp();
    const doc = path.join(root, 'post.md');
    const content = 'see ![alt](./a.png) ok\n';
    fs.writeFileSync(doc, content);
    const refs = extractRefs({ path: doc, kind: 'markdown' }, content);
    const out = applyRewrites({
      docPath: doc,
      content,
      items: [
        {
          ref: refs[0],
          publicUrl: 'https://cdn.example/a.png',
          localPath: 'a.png',
          sha256: 'abc',
        },
      ],
      rootDir: root,
      backup: true,
    });
    expect(out.content).toContain('see ![alt](https://cdn.example/a.png) ok');
    const back = revertDoc(out.content, out.entries);
    expect(back).toContain('![alt](./a.png)');
  });

  it('buildPlan classifies upload vs cache', () => {
    const root = tmp();
    const doc = path.join(root, 'post.md');
    const img = path.join(root, 'a.png');
    fs.writeFileSync(img, Buffer.from('hello'));
    fs.writeFileSync(doc, '![a](a.png)\n');
    const refs = extractRefs({ path: doc, kind: 'markdown' }, fs.readFileSync(doc, 'utf8'));
    const res = resolveAssets(refs, { scanRoot: root });
    const plan1 = buildPlan({
      assets: res.assets,
      blocked: res.blocked,
      remoteSkips: res.remoteSkips,
      manifest: { version: 1, entries: [] },
    });
    expect(plan1[0].action).toBe('upload');
    const plan2 = buildPlan({
      assets: res.assets,
      blocked: res.blocked,
      remoteSkips: res.remoteSkips,
      manifest: {
        version: 1,
        entries: [
          {
            doc: 'post.md',
            raw: 'a.png',
            localPath: img,
            sha256: res.assets[0].sha256,
            publicUrl: 'https://x/y.png',
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    });
    expect(plan2[0].action).toBe('skip-cache');
  });
});
