/**
 * F24 preload — progressive enhancement bridge.
 * Browser `picbed ui` has no `window.picbedNative`; SPA must keep working without it.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('picbedNative', {
  async selectDirectory() {
    return ipcRenderer.invoke('dialog:selectDirectory');
  },
  async selectFiles(opts) {
    return ipcRenderer.invoke('dialog:selectFiles', opts ?? {});
  },
  async appInfo() {
    return ipcRenderer.invoke('app:info');
  },
  platform: process.platform,
});
