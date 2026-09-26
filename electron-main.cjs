const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { registerFcpIpc, stopFcpIpc } = require('./fcp-electron.cjs');

const isDevelopment = !app.isPackaged;
const developmentUrl = process.env.CENTRAL_CORE_DEV_URL || 'http://127.0.0.1:3000';
let serverHandle;
let appUrl;

Menu.setApplicationMenu(null);
registerFcpIpc();

ipcMain.handle('app:get-local-username', () => os.userInfo().username);

async function waitForDevelopmentServer() {
  let lastError;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(developmentUrl);
      if (response.ok) return;
      lastError = new Error(`Development server returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`Central Core dev server did not start at ${developmentUrl}: ${lastError?.message || 'connection failed'}`);
}

async function getAppUrl() {
  if (appUrl) return appUrl;

  if (isDevelopment) {
    await waitForDevelopmentServer();
    appUrl = developmentUrl;
    return appUrl;
  }

  process.env.CENTRAL_CORE_ROOT = app.getAppPath();
  process.env.CENTRAL_CORE_DATA_DIR = app.getPath('userData');
  process.env.NODE_ENV = 'production';

  const serverEntry = path.join(app.getAppPath(), 'dist-server', 'server.mjs');
  const { startServer } = await import(pathToFileURL(serverEntry).href);
  serverHandle = await startServer({ host: '127.0.0.1', port: 0, useVite: false });
  appUrl = serverHandle.url;
  return appUrl;
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    fullscreen: true,
    icon: path.join(app.getAppPath(), 'Assets', 'icon.ico'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url).catch(error => console.error('Failed to open external link:', error));
    }
    return { action: 'deny' };
  });

  await window.loadURL(await getAppUrl());
  window.once('ready-to-show', () => window.show());
  return window;
}

app.whenReady().then(async () => {
  try {
    await createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().catch(showStartupError);
      }
    });
  } catch (error) {
    showStartupError(error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopFcpIpc();
  serverHandle?.close().catch(error => console.error('Failed to stop local server:', error));
});

function showStartupError(error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error('Central Core failed to start:', error);
  dialog.showErrorBox('Central Core could not start', message);
  app.quit();
}
