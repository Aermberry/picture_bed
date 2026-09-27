/**
 * F24 Electron main process — hosts the same Web UI as `picbed ui`.
 * No business rules here: createUiServer (dist/) owns scan/plan/sync/revert.
 */
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 「规范」入口：打包安装版必须关闭；desktop:dev 显示（F24 调试门）
if (app.isPackaged) {
  process.env.PICBED_UI_DEV = '0';
} else if (process.env.PICBED_UI_DEV === undefined) {
  process.env.PICBED_UI_DEV = '1';
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {{ url: string, close: () => Promise<void> } | null} */
let uiHandle = null;
let windowState = { width: 1280, height: 800 };

function stateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const raw = fs.readFileSync(stateFile(), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      windowState = {
        width: Math.min(Math.max(parsed.width, 860), 4000),
        height: Math.min(Math.max(parsed.height, 600), 3000),
        x: typeof parsed.x === 'number' ? parsed.x : undefined,
        y: typeof parsed.y === 'number' ? parsed.y : undefined,
      };
    }
  } catch {
    /* first run */
  }
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const b = mainWindow.getBounds();
    fs.writeFileSync(stateFile(), JSON.stringify(b), 'utf8');
  } catch {
    /* ignore */
  }
}

async function startUiServer() {
  // cache-bust so desktop:dev can re-import rebuilt dist/ without a process restart
  const bust = process.env.PICBED_DESKTOP_UI_BUST || '';
  const distUrl = new URL(`../dist/ui/index.js${bust}`, import.meta.url);
  const mod = await import(distUrl.href);
  const createUiServer = mod.createUiServer;
  if (typeof createUiServer !== 'function') {
    throw new Error('dist/ui/index.js missing createUiServer — run `npm run build` first');
  }
  const cwd = process.env.PICBED_CWD || process.cwd();
  const ui = createUiServer({ cwd });
  // Dev (electron-vite): stable port so Vite can proxy /api. Prod: ephemeral loopback.
  const dev = !app.isPackaged && process.env.PICBED_DESKTOP_DEV === '1';
  const port = dev ? Number(process.env.PICBED_UI_PORT || 4780) : 0;
  return ui.listen(port, '127.0.0.1');
}

async function createWindow() {
  loadWindowState();
  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 860,
    minHeight: 600,
    title: 'picbed',
    backgroundColor: '#F3F7FA',
    webPreferences: {
      // desktop/preload.cjs (source) or out/preload/preload.cjs (electron-vite build)
      preload: fs.existsSync(path.join(__dirname, 'preload.cjs'))
        ? path.join(__dirname, 'preload.cjs')
        : path.join(__dirname, '..', 'out', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('close', saveWindowState);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (!uiHandle) {
    try {
      uiHandle = await startUiServer();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await mainWindow.loadURL(
        'data:text/html;charset=utf-8,' +
          encodeURIComponent(
            `<!doctype html><meta charset="utf-8"><title>picbed</title>` +
              `<body style="font:14px/1.5 system-ui;padding:40px;color:#1c2b36">` +
              `<h2>无法启动本地服务</h2><pre>${message}</pre>` +
              `<p>请确认已执行 <code>npm run build</code>，并检查端口/权限。</p></body>`,
          ),
      );
      return;
    }
  }

  // electron-vite dev → Vite HMR URL (proxy /api → createUiServer)
  const rendererDevUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined;
  if (rendererDevUrl) {
    await mainWindow.loadURL(rendererDevUrl);
    return;
  }

  await mainWindow.loadURL(uiHandle.url);
}

/** Close + re-import UI server, then point the window at the new URL. */
async function restartUiServer() {
  const prev = uiHandle;
  uiHandle = null;
  if (prev) {
    try {
      await prev.close();
    } catch {
      /* ignore */
    }
  }
  process.env.PICBED_DESKTOP_UI_BUST = `?t=${Date.now()}`;
  try {
    uiHandle = await startUiServer();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[desktop] restartUiServer failed:', message);
    processExitForReload('ui-restart-failed');
    return;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.loadURL(uiHandle.url);
  }
}

/**
 * Process-level restart. Supervisor respawns us when PICBED_DESKTOP_SUPERVISED=1;
 * otherwise Electron's own relaunch keeps a single instance.
 */
function processExitForReload(_reason) {
  if (process.env.PICBED_DESKTOP_SUPERVISED === '1') {
    app.exit(0);
    return;
  }
  app.relaunch();
  app.exit(0);
}

function registerIpc() {
  ipcMain.handle('dialog:selectDirectory', async () => {
    const win = mainWindow ?? undefined;
    const result = await dialog.showOpenDialog(win, {
      title: '选择扫描根目录',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('dialog:selectFiles', async (_evt, opts) => {
    const win = mainWindow ?? undefined;
    const properties = ['openFile'];
    if (opts && opts.multi) properties.push('multiSelections');
    const result = await dialog.showOpenDialog(win, {
      title: '选择文档',
      properties,
      filters: (opts && opts.filters) || [
        { name: '文档', extensions: ['md', 'html', 'htm'] },
        { name: '全部', extensions: ['*'] },
      ],
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  ipcMain.handle('app:info', () => ({
    platform: process.platform,
    version: app.getVersion(),
    cwd: process.env.PICBED_CWD || process.cwd(),
  }));
}

/** @param {string} p */
function isNoiseWatchPath(p) {
  return /\.(tsbuildinfo|map|tmp|swp)$/i.test(p) || /[\\/]\.git[\\/]/.test(p);
}

/**
 * Tiered hot reload (dev only):
 * - desktop/**  → process restart (main/preload)
 * - dist/ui/spa/app.js only → webContents.reload()
 * - other dist/** → restart UI server + reload window
 */
function installDevHotReload() {
  const distDir = path.join(__dirname, '..', 'dist');
  const desktopDir = __dirname;
  /** @type {Record<string, number>} */
  const pending = {};
  let timer = null;
  let reloading = false;

  const flush = async () => {
    timer = null;
    const files = Object.keys(pending);
    for (const k of Object.keys(pending)) delete pending[k];
    if (!files.length || reloading) return;

    const desktopHit = files.some((f) => f.startsWith(desktopDir));
    if (desktopHit) {
      console.log('[desktop:dev] desktop/* changed → process restart');
      processExitForReload('desktop');
      return;
    }

    const spaAppOnly =
      files.length > 0 &&
      files.every((f) => f.replace(/\\/g, '/').endsWith('dist/ui/spa/app.js'));

    if (spaAppOnly && mainWindow && !mainWindow.isDestroyed()) {
      console.log('[desktop:dev] spa/app.js changed → reload window');
      mainWindow.webContents.reload();
      return;
    }

    console.log('[desktop:dev] dist/* changed → restart UI server');
    reloading = true;
    try {
      await restartUiServer();
    } finally {
      reloading = false;
    }
  };

  /** @param {string} root */
  const watchRoot = (root) => {
    try {
      fs.watch(root, { recursive: true }, (_event, filename) => {
        if (!filename || isNoiseWatchPath(String(filename))) return;
        const abs = path.join(root, String(filename));
        pending[abs] = Date.now();
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          void flush();
        }, 200);
      });
    } catch {
      /* recursive watch unsupported — ignore */
    }
  };

  watchRoot(distDir);
  watchRoot(desktopDir);
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();

  if (!app.isPackaged) installDevHotReload();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', (e) => {
  if (!uiHandle) return;
  e.preventDefault();
  const handle = uiHandle;
  uiHandle = null;
  handle
    .close()
    .catch(() => {})
    .finally(() => app.quit());
});
