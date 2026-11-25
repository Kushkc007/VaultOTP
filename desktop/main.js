'use strict';

/**
 * VaultOTP desktop shell (Electron).
 *
 * The renderer is the exact same offline web app that ships on vaultotp.app and
 * in the Android build — this file only adds a window, a menu and a strict
 * security policy around it:
 *
 *   - no Node.js in the renderer (contextIsolation + sandbox)
 *   - no remote content is ever loaded, and navigation is blocked
 *   - only the camera permission may be granted (for QR scanning)
 *   - new windows, webviews and permission requests are denied by default
 */

const { app, BrowserWindow, Menu, session, shell } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;
const APP_ORIGIN = 'file://';

/** @type {BrowserWindow | null} */
let mainWindow = null;

function hardenWebContents(contents) {
  // Never let the app navigate somewhere else, and never open child windows.
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', event => event.preventDefault());
  contents.on('will-attach-webview', event => event.preventDefault());

  contents.on('will-redirect', event => event.preventDefault());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 840,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#07090e',
    title: 'VaultOTP',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '..', 'web', 'icons', 'icon-512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
      devTools: isDev,
      // The UI loads from disk; no network access is required at all.
      backgroundThrottling: false,
    },
  });

  hardenWebContents(mainWindow.webContents);

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'web', 'index.html'));
}

function buildMenu() {
  const template = [
    {
      label: 'Vault',
      submenu: [
        {
          label: 'Lock vault',
          accelerator: 'CmdOrCtrl+L',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript('lockVault(true)'),
        },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow && mainWindow.webContents.executeJavaScript('openSettings()'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'How VaultOTP works',
          click: () =>
            shell.openExternal('https://github.com/<your-user>/vaultotp/blob/main/docs/HOW-IT-WORKS.md'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Single instance: a second launch focuses the existing window instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    // Camera is the only capability the app may use (QR scanning).
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'media');
    });
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

    // Block every outbound request: VaultOTP is a strictly offline app.
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const url = details.url;
      const allowed =
        url.startsWith(APP_ORIGIN) ||
        url.startsWith('data:') ||
        url.startsWith('blob:') ||
        url.startsWith('devtools:');
      callback({ cancel: !allowed });
    });

    createWindow();
    buildMenu();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
