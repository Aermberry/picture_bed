export interface HostUrls {
  publicUrl: string;
  rawUrl: string;
  cdnUrl?: string;
}

/** F13 port: replaceable image-host backend. AC7 upload/URL semantics stay stable. */
export interface HostAdapter {
  readonly type: string;
  readonly requiresToken: boolean;
  exists(repoPath: string): Promise<boolean>;
  putFile(
    repoPath: string,
    bytes: Buffer,
    message: string,
    branch: string,
  ): Promise<void>;
  composeUrls(repoPath: string): HostUrls;
  remotePath(sha256: string, localPath: string, now?: Date): string;
}
