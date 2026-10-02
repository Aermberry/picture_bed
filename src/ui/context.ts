import type http from 'node:http';
import type { ResolvedConfig } from '../types.js';
import type { RootBinder } from './root.js';
import type { WatchController } from './watch.js';
import type { GhLoginStore } from './gh-login.js';

/** 拖拽/投放工作集条目（session 路由的可变状态）。 */
export interface WorksetItem {
  name: string;
  relativePath: string;
  type: 'file' | 'dir';
  resolvedPath?: string;
  status: string;
}

/**
 * 路由上下文：安检层（http/）已放行后，交给 routes/ 的全部依赖。
 * 之前这些都藏在 `createUiServer` 的闭包里，路由与协议代码纠缠在同一函数内。
 */
export interface UiRouteContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  method: string;
  pathname: string;
  send: (status: number, body: unknown) => void;
  /** 读取并解析过的请求体（已受 64 KiB 上限保护） */
  readBody: () => Promise<string>;
  cwd: string;
  binder: RootBinder;
  watch: WatchController;
  workset: WorksetItem[];
  ghLogin: GhLoginStore;
  loadCfg: () => ResolvedConfig;
}

/** 命中并返回 true（已响应）；未命中返回 false 交由下一张表。 */
export type UiRoute = (ctx: UiRouteContext) => Promise<boolean> | boolean;
