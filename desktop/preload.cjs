/**
 * F24 preload — progressive enhancement bridge.
 * Browser `picbed ui` has no `window.picbedNative`; SPA must keep working without it.
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

function filePathFor(file) {
  try {
    if (webUtils && typeof webUtils.getPathForFile === 'function') {
      const p = webUtils.getPathForFile(file);
      if (p) return p;
    }
  } catch (_) {}
  try {
    if (file && typeof file.path === 'string' && file.path) return file.path;
  } catch (_) {}
  return '';
}

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
  getPathForFile(file) {
    return filePathFor(file);
  },
  platform: process.platform,
});
