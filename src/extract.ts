import path from 'node:path';
import type { DocFile, DocKind, ImageRef, RefSyntax } from './types.js';

const IMAGE_EXT = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'svg',
  'bmp',
  'ico',
]);

export function isImageExt(p: string): boolean {
  const ext = path.extname(p).replace(/^\./, '').toLowerCase();
  return IMAGE_EXT.has(ext);
}

function kindOf(docPath: string): DocKind {
  const ext = path.extname(docPath).toLowerCase();
  return ext === '.md' || ext === '.markdown' ? 'markdown' : 'html';
}

/** Strip fenced/inline code spans so we do not rewrite false refs. */
export function blankCodeRegions(text: string): string {
  let out = text;
  // fenced code blocks ``` ... ```
  out = out.replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length));
  out = out.replace(/~~~[\s\S]*?~~~/g, (m) => ' '.repeat(m.length));
  // inline code `...`
  out = out.replace(/`[^`\n]+`/g, (m) => ' '.repeat(m.length));
  return out;
}

function pushRef(
  refs: ImageRef[],
  docPath: string,
  kind: DocKind,
  syntax: RefSyntax,
  raw: string,
  start: number,
  alt?: string,
): void {
  refs.push({
    docPath,
    raw,
    start,
    end: start + raw.length,
    kind,
    syntax,
    alt,
  });
}

export function extractRefs(doc: DocFile, content: string): ImageRef[] {
  const kind = kindOf(doc.path);
  const scanText = blankCodeRegions(content);
  const refs: ImageRef[] = [];
  const seen = new Set<string>();

  const add = (
    syntax: RefSyntax,
    raw: string,
    start: number,
    alt?: string,
  ): void => {
    const key = `${start}:${raw}`;
    if (seen.has(key)) return;
    // Prefer exact original slice from content
    const actual = content.slice(start, start + raw.length);
    if (actual !== raw) return;
    seen.add(key);
    pushRef(refs, doc.path, kind, syntax, raw, start, alt);
  };

  if (kind === 'markdown') {
    // ![alt](url) or ![alt](url "title")
    const mdImg = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    for (const m of scanText.matchAll(mdImg)) {
      const raw = m[2];
      const start = m.index! + m[0].indexOf(raw);
      add('md-image', raw, start, m[1]);
    }
    // [text](url) pointing at image
    const mdLink = /(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    for (const m of scanText.matchAll(mdLink)) {
      const raw = m[2];
      if (!isImageExt(raw.split(/[?#]/)[0] ?? raw)) continue;
      const start = m.index! + m[0].indexOf(raw);
      add('md-link', raw, start, m[1]);
    }
    // HTML inside markdown
    extractHtml(scanText, doc.path, kind, add);
  } else {
    extractHtml(scanText, doc.path, kind, add);
  }

  refs.sort((a, b) => a.start - b.start);
  return refs;
}

function extractHtml(
  scanText: string,
  docPath: string,
  kind: DocKind,
  add: (
    syntax: RefSyntax,
    raw: string,
    start: number,
    alt?: string,
  ) => void,
): void {
  const imgTag = /<img\b[^>]*>/gi;
  for (const m of scanText.matchAll(imgTag)) {
    const tag = m[0];
    const base = m.index!;
    const src = /\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    if (src) {
      const raw = src[2] ?? src[3] ?? '';
      const start = base + src.index + src[0].indexOf(raw);
      const altM = /\balt\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
      add('html-img', raw, start, altM?.[2] ?? altM?.[3]);
    }
    const srcset = /\bsrcset\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    if (srcset) {
      const value = srcset[2] ?? srcset[3] ?? '';
      for (const part of value.split(',')) {
        const url = part.trim().split(/\s+/)[0];
        if (!url) continue;
        const start = base + srcset.index + srcset[0].indexOf(url);
        add('html-srcset', url, start);
      }
    }
  }

  const sourceTag = /<source\b[^>]*>/gi;
  for (const m of scanText.matchAll(sourceTag)) {
    const tag = m[0];
    const base = m.index!;
    const src = /\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    if (src) {
      const raw = src[2] ?? src[3] ?? '';
      const start = base + src.index + src[0].indexOf(raw);
      add('html-source', raw, start);
    }
    const srcset = /\bsrcset\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    if (srcset) {
      const value = srcset[2] ?? srcset[3] ?? '';
      for (const part of value.split(',')) {
        const url = part.trim().split(/\s+/)[0];
        if (!url) continue;
        const start = base + srcset.index + srcset[0].indexOf(url);
        add('html-srcset', url, start);
      }
    }
  }

  const imageTag = /<image\b[^>]*>/gi;
  for (const m of scanText.matchAll(imageTag)) {
    const tag = m[0];
    const base = m.index!;
    const href = /\b(?:xlink:)?href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    if (href) {
      const raw = href[2] ?? href[3] ?? '';
      const start = base + href.index + href[0].indexOf(raw);
      add('other', raw, start);
    }
  }
}
