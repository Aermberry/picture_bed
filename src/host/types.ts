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
  deleteFile(
    repoPath: string,
    sha: string,
    message: string,
    branch: string,
  ): Promise<void>;
  composeUrls(repoPath: string): HostUrls;
  remotePath(sha256: string, localPath: string, now?: Date): string;
  /**
   * 可选能力：判定远端路径是文件 / 目录 / 不存在。
   * GitHub 通过 Contents API 支持（F20 目录选择）；其它后端可不实现。
   */
  entryType?(repoPath: string): Promise<'file' | 'dir' | null>;
}
