export interface GhLoginState {
  status: 'running' | 'done' | 'error';
  output: string;
  error?: string;
}

/**
 * gh auth login 会话状态（单例，同时只允许一个登录流程）。
 * 此前是 `createUiServer` 闭包里的一个可变 let，路由与状态管理混在一起。
 */
export class GhLoginStore {
  private state: GhLoginState | null = null;
  private timer: NodeJS.Timeout | null = null;

  get(): GhLoginState | null {
    return this.state;
  }

  set(next: GhLoginState | null): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.state = next;
  }

  get isRunning(): boolean {
    return this.state?.status === 'running';
  }

  /** 追加子进程输出（登录过程日志） */
  append(chunk: string): void {
    if (this.state) this.state.output += chunk;
  }

  /**
   * 终态（done/error）延迟清理：让前端有机会读到最终状态（此前 5s）。
   * 返回该状态是否为终态。
   */
  scheduleClearIfTerminal(delayMs = 5000): boolean {
    const terminal = this.state?.status === 'done' || this.state?.status === 'error';
    if (terminal && !this.timer) {
      this.timer = setTimeout(() => {
        this.state = null;
        this.timer = null;
      }, delayMs);
      // 不持有事件循环
      this.timer.unref?.();
    }
    return terminal;
  }

  cancel(reason = '用户取消'): void {
    if (this.state?.status === 'running') {
      this.set({ status: 'error', output: this.state.output, error: reason });
    }
  }
}
