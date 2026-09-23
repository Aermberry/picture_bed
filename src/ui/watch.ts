import type { Watcher } from '../watch.js';
import { startWatch } from '../watch.js';

export type WatchMode = 'preview' | 'confirm-each' | 'auto';

export interface WatchState {
  active: boolean;
  mode: WatchMode;
  root?: string;
  debounceMs?: number;
  lastBatch?: string[];
  events: { at: string; message: string; changed?: string[] }[];
}

export class WatchController {
  state: WatchState = { active: false, mode: 'preview', events: [] };
  private watcher?: Watcher;
  private onBatch?: (changed: string[], mode: WatchMode) => Promise<void> | void;

  start(opts: {
    root: string;
    debounceMs?: number;
    mode?: WatchMode;
    onBatch: (changed: string[], mode: WatchMode) => Promise<void> | void;
  }): WatchState {
    this.stop();
    const mode = opts.mode ?? 'preview';
    this.onBatch = opts.onBatch;
    this.watcher = startWatch({
      root: opts.root,
      debounceMs: opts.debounceMs ?? 300,
      onTrigger: async (changed) => {
        this.state.lastBatch = changed;
        this.pushEvent(`batch ${changed.length} change(s)`, changed);
        if (mode === 'preview') return;
        await this.onBatch?.(changed, mode);
      },
    });
    this.state = {
      active: true,
      mode,
      root: opts.root,
      debounceMs: opts.debounceMs ?? 300,
      events: this.state.events.slice(-50),
    };
    this.pushEvent(`watch started (${mode})`);
    return this.state;
  }

  stop(): WatchState {
    this.watcher?.close();
    this.watcher = undefined;
    this.state = {
      ...this.state,
      active: false,
    };
    if (this.state.root) this.pushEvent('watch stopped');
    return this.state;
  }

  private pushEvent(message: string, changed?: string[]) {
    this.state.events.push({ at: new Date().toISOString(), message, changed });
    if (this.state.events.length > 100) this.state.events = this.state.events.slice(-100);
  }
}
