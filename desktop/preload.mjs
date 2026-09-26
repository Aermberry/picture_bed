/**
 * F24 preload — progressive enhancement bridge.
 * Browser `picbed ui` has no `window.picbedNative`; SPA must keep working without it.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';

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
  /** Absolute FS path for a drag-drop File (Electron only). */
  getPathForFile(file) {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return null;
    }
  },
  platform: process.platform,
});
