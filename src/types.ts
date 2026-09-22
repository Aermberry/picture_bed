export type DocKind = 'markdown' | 'html';

export type RefSyntax =
  | 'md-image'
  | 'md-link'
  | 'html-img'
  | 'html-srcset'
  | 'html-source'
  | 'other';

export interface DocFile {
  path: string;
  kind: DocKind;
}

export interface ImageRef {
  docPath: string;
  raw: string;
  start: number;
  end: number;
  kind: DocKind;
  syntax: RefSyntax;
  alt?: string;
}

export interface Asset {
  localPath: string;
  sha256: string;
  bytes: number;
  mime: string;
  refs: ImageRef[];
}

export interface RemoteImage {
  publicUrl: string;
  rawUrl: string;
  cdnUrl?: string;
  repoPath: string;
  sha256: string;
}

export type PlanAction =
  | 'upload'
  | 'skip-cache'
  | 'skip-remote'
  | 'rewrite-only'
  | 'blocked';

export interface SyncPlanItem {
  action: PlanAction;
  asset?: Asset;
  remote?: RemoteImage;
  reason?: string;
  ref?: ImageRef;
}

export interface BlockedItem {
  ref: ImageRef;
  reason: string;
  code: string;
}

export interface ManifestEntry {
  doc: string;
  raw: string;
  localPath: string;
  sha256: string;
  publicUrl: string;
  updatedAt: string;
}

export interface Manifest {
  version: 1;
  entries: ManifestEntry[];
}

export interface GithubConfig {
  owner: string;
  repo: string;
  branch: string;
  dir: string;
}

export type HostType = 'github' | 'local';

export interface HostConfig {
  type: HostType;
}

export interface LocalHostConfig {
  root: string;
  publicBase: string;
  dir: string;
}

export interface UrlConfig {
  style: 'raw' | 'jsdelivr' | 'custom';
  customTemplate?: string;
}

export interface ScanConfig {
  extensions: string[];
  ignore: string[];
}

export interface UploadConfig {
  concurrency: number;
  commitMessage: string;
}

export interface RewriteConfig {
  backup: boolean;
}

export interface ResolvedConfig {
  host: HostConfig;
  github: GithubConfig;
  local: LocalHostConfig;
  url: UrlConfig;
  scan: ScanConfig;
  upload: UploadConfig;
  rewrite: RewriteConfig;
  configPath?: string;
  rootDir: string;
}

export interface JsonError {
  code: string;
  message: string;
  path?: string;
  hint?: string;
}

export interface JsonEnvelope<T = unknown> {
  schemaVersion: 1;
  ok: boolean;
  command: string;
  data?: T;
  warnings?: string[];
  error?: JsonError | null;
}

export const EXIT = {
  OK: 0,
  GENERAL: 1,
  USAGE: 2,
  CONFIG: 3,
  LOCAL: 4,
  REMOTE: 5,
  PARTIAL: 6,
  CONFIRM: 7,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
