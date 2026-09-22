import { describe, expect, it } from 'vitest';
import { blankCodeRegions, extractRefs, isImageExt } from '../src/extract.js';

describe('extractRefs', () => {
  it('extracts markdown images', () => {
    const text = '# t\n\n![a](./x.png)\n';
    const refs = extractRefs({ path: 'a.md', kind: 'markdown' }, text);
    expect(refs).toHaveLength(1);
    expect(refs[0].raw).toBe('./x.png');
    expect(text.slice(refs[0].start, refs[0].end)).toBe('./x.png');
    expect(refs[0].syntax).toBe('md-image');
  });

  it('ignores refs inside fenced code', () => {
    const text = '```\n![a](./x.png)\n```\n![b](./y.png)\n';
    const refs = extractRefs({ path: 'a.md', kind: 'markdown' }, text);
    expect(refs).toHaveLength(1);
    expect(refs[0].raw).toBe('./y.png');
  });

  it('extracts html img src', () => {
    const text = '<img alt="z" src="assets/p.jpg">';
    const refs = extractRefs({ path: 'a.html', kind: 'html' }, text);
    expect(refs).toHaveLength(1);
    expect(refs[0].raw).toBe('assets/p.jpg');
  });

  it('blankCodeRegions preserves length', () => {
    const s = 'a `code` b';
    expect(blankCodeRegions(s)).toHaveLength(s.length);
  });

  it('isImageExt', () => {
    expect(isImageExt('a.PNG')).toBe(true);
    expect(isImageExt('a.txt')).toBe(false);
  });
});
