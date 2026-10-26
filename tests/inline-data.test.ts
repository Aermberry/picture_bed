import { describe, expect, it } from 'vitest';
import {
  INLINE_MAX_BYTES,
  inlineLocalPath,
  isDataUri,
  parseInlineImage,
} from '../src/lib/inline.js';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

describe('data:image/* 内嵌图解析', () => {
  it('base64 编码的 SVG 解码成功', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const r = parseInlineImage(`data:image/svg+xml;base64,${b64(svg)}`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.image.mime).toBe('image/svg+xml');
      expect(r.image.ext).toBe('svg');
      expect(r.image.data.toString('utf8')).toBe(svg);
    }
  });

  it('URL-encoded（非 base64）SVG 同样支持', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const r = parseInlineImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.image.data.toString('utf8')).toBe(svg);
  });

  it('png / jpeg 等位图按 MIME 反查扩展名', () => {
    const png = parseInlineImage(`data:image/png;base64,${b64('x')}`);
    expect(png.ok).toBe(true);
    if (png.ok) expect(png.image.ext).toBe('png');
    const jpg = parseInlineImage(`data:image/jpeg;base64,${b64('x')}`);
    expect(jpg.ok).toBe(true);
    if (jpg.ok) expect(jpg.image.ext).toBe('jpg');
  });

  it('非图片 data URI 回落到 E_SKIP_REF', () => {
    const r = parseInlineImage(`data:text/plain;base64,${b64('hi')}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('E_SKIP_REF');
  });

  it('不支持的图片 MIME 被拒（不在 IMAGE_MIME 白名单）', () => {
    const r = parseInlineImage('data:image/tiff;base64,AAAA');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('E_INLINE_MIME');
  });

  it('超过 10MB 上限被拒', () => {
    // base64 每 4 字符解出 3 字节，故载荷需 > 上限的 4/3
    const big = 'A'.repeat(Math.ceil(((INLINE_MAX_BYTES + 1024) * 4) / 3));
    const r = parseInlineImage(`data:image/png;base64,${big}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('E_INLINE_TOO_LARGE');
  });

  it('畸形 data URI（无逗号）被拒', () => {
    const r = parseInlineImage('data:image/png;base64');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('E_INLINE_DATA');
  });

  it('空载荷被拒', () => {
    const r = parseInlineImage('data:image/png;base64,');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('E_INLINE_DATA');
  });

  it('大小写与空白容忍', () => {
    expect(isDataUri('  DATA:image/png;base64,AA')).toBe(true);
    const r = parseInlineImage('data:IMAGE/PNG;base64,AAAA');
    expect(r.ok).toBe(true);
  });

  it('合成占位名不指向真实路径，仅用于推导远端文件名', () => {
    expect(inlineLocalPath('abc123def456', 'svg')).toBe('inline/abc123def456.svg');
  });
});
