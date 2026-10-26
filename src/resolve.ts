import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isImageExt, mimeOf } from './lib/img.js';
import { sha256Hex, sha12 } from './lib/hash.js';
import { inlineLocalPath, isDataUri, parseInlineImage } from './lib/inline.js';
import { isUnderRoot } from './lib/paths.js';
import type { Asset, BlockedItem, ImageRef } from './types.js';

export interface ResolveOptions {
  scanRoot: string;
  allowAbsolute?: boolean;
  /** 是否把 `data:image/*` 内嵌图解码为内存资产（默认 true）。 */
  inlineImages?: boolean;
}

export interface ResolveResult {
  assets: Asset[];
  blocked: BlockedItem[];
  remoteSkips: ImageRef[];
}

function isRemote(raw: string): boolean {
  return /^https?:\/\//i.test(raw) || raw.startsWith('//');
}

function isData(raw: string): boolean {
  return raw.startsWith('data:');
}

export function resolveAssets(
  refs: ImageRef[],
  opts: ResolveOptions,
): ResolveResult {
  const blocked: BlockedItem[] = [];
  const remoteSkips: ImageRef[] = [];
  const byPath = new Map<string, Asset>();
  const root = path.resolve(opts.scanRoot);

  const inlineImages = opts.inlineImages !== false;

  for (const ref of refs) {
    const raw = ref.raw.trim();
    if (!raw || raw.startsWith('#')) {
      blocked.push({
        ref,
        code: 'E_SKIP_REF',
        reason: 'data/anchor/empty ref skipped',
      });
      continue;
    }
    if (isDataUri(raw)) {
      if (!inlineImages) {
        blocked.push({ ref, code: 'E_SKIP_REF', reason: 'inline images disabled' });
        continue;
      }
      const parsed = parseInlineImage(raw);
      if (!parsed.ok) {
        blocked.push({ ref, code: parsed.code, reason: parsed.reason });
        continue;
      }
      // 内存资产：sha256 与本地图片同池去重，不落盘
      const sha256 = sha256Hex(parsed.image.data);
      const existing = byPath.get(sha256);
      if (existing) {
        existing.refs.push(ref);
        continue;
      }
      byPath.set(sha256, {
        localPath: inlineLocalPath(sha12(sha256), parsed.image.ext),
        sha256,
        bytes: parsed.image.data.length,
        mime: parsed.image.mime,
        refs: [ref],
        data: parsed.image.data,
      });
      continue;
    }
    if (isRemote(raw)) {
      remoteSkips.push(ref);
      continue;
    }
    if (raw.startsWith('file://')) {
      if (!opts.allowAbsolute) {
        blocked.push({
          ref,
          code: 'E_FILE_URL',
          reason: 'file:// not allowed by default',
        });
        continue;
      }
    }

    let localPath = raw.split(/[?#]/)[0] ?? raw;
    if (localPath.startsWith('file://')) {
      localPath = localPath.replace(/^file:\/\//, '');
    }

    const docDir = path.dirname(ref.docPath);
    const abs = path.isAbsolute(localPath)
      ? path.resolve(localPath)
      : path.resolve(docDir, localPath);

    if (path.isAbsolute(localPath) && !opts.allowAbsolute) {
      blocked.push({
        ref,
        code: 'E_ABSOLUTE',
        reason: 'absolute path not allowed by default',
      });
      continue;
    }

    if (!isUnderRoot(root, abs)) {
      if (!opts.allowAbsolute) {
        blocked.push({
          ref,
          code: 'E_PATH_ESCAPE',
          reason: 'path escapes scan root',
        });
        continue;
      }
    }

    if (!isImageExt(abs)) {
      blocked.push({ ref, code: 'E_EXT', reason: 'extension not in image whitelist' });
      continue;
    }

    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      blocked.push({ ref, code: 'E_ASSET_MISSING', reason: 'file not found', });
      continue;
    }

    const buf = fs.readFileSync(abs);
    const sha256 = sha256Hex(buf);
    const key = sha256;
    const existing = byPath.get(key);
    if (existing) {
      existing.refs.push(ref);
      continue;
    }
    byPath.set(key, {
      localPath: abs,
      sha256,
      bytes: buf.length,
      mime: mimeOf(abs),
      refs: [ref],
    });
  }

  return {
    assets: [...byPath.values()],
    blocked,
    remoteSkips,
  };
}


