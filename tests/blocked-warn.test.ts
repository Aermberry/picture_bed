import { describe, expect, it } from 'vitest';
import {
  collectBlockedForDocs,
  truncateRaw,
} from '../renderer/src/features/blocked-warn.js';

describe('拖入文档的 blocked 引用警告（renderer）', () => {
  it('data: URI 被截断，不把整串塞进 DOM', () => {
    const big = 'data:image/svg+xml;base64,' + 'A'.repeat(5000);
    const out = truncateRaw(big);
    expect(out.length).toBeLessThanOrEqual(81);
    expect(out.endsWith('…')).toBe(true);
    // 短串原样返回
    expect(truncateRaw('img/a.png')).toBe('img/a.png');
  });

  it('只挑本次拖入文档的 blocked 项，不扩大报全仓', () => {
    const plan = [
      { action: 'blocked', code: 'E_SKIP_REF', doc: 'C:/root/a.md', raw: 'data:image/png;base64,xx' },
      { action: 'blocked', code: 'E_EXT', doc: 'C:/root/b.md', raw: 'x.txt' },
      { action: 'upload', doc: 'C:/root/a.md', localPath: 'C:/root/i.png' },
      { action: 'blocked', code: 'E_ASSET_MISSING', doc: 'C:/root/a.md', raw: 'gone.png' },
    ];
    const got = collectBlockedForDocs(plan, ['C:/root/a.md']);
    expect(got).toHaveLength(2);
    expect(got.every((p: any) => p.doc === 'C:/root/a.md')).toBe(true);
  });

  it('Windows 反斜杠路径与正斜杠等价', () => {
    const plan = [{ action: 'blocked', code: 'E_SKIP_REF', doc: 'C:\\root\\a.md', raw: 'data:x' }];
    expect(collectBlockedForDocs(plan, ['C:/root/a.md'])).toHaveLength(1);
  });

  it('无 blocked 项时返回空（纯图片拖入不触发警告）', () => {
    const plan = [{ action: 'upload', doc: 'C:/root/a.md', localPath: 'C:/root/i.png' }];
    expect(collectBlockedForDocs(plan, ['C:/root/a.md'])).toHaveLength(0);
  });
});
