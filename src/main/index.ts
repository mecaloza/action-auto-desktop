import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { MqttManager } from './mqtt/MqttManager';
import { AudioEngine } from './audio/AudioEngine';
import { setupIpcHandlers } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;
let mqttManager: MqttManager | null = null;
let audioEngine: AudioEngine | null = null;
let isQuitting = false;

// Hard kill the app process — bypasses ALL Electron lifecycle, crash recovery, everything
function forceKill(): void {
  console.log('forceKill: terminating process');
  isQuitting = true;
  mqttManager?.disconnect();
  audioEngine?.stop();
  process.removeAllListeners('uncaughtException');
  process.removeAllListeners('unhandledRejection');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners();
    mainWindow.destroy();
    mainWindow = null;
  }
  // process.exit is the nuclear option — nothing survives this
  process.exit(0);
}

// Force quit and install update
function forceQuitAndInstall(): void {
  console.log('forceQuitAndInstall: installing update and killing process...');
  isQuitting = true;
  mqttManager?.disconnect();
  audioEngine?.stop();
  process.removeAllListeners('uncaughtException');
  process.removeAllListeners('unhandledRejection');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners();
    mainWindow.destroy();
    mainWindow = null;
  }
  // Start the installer, then force-kill this process so NSIS can proceed
  autoUpdater.quitAndInstall(true, true);
  setTimeout(() => {
    console.log('forceQuitAndInstall: force process.exit()');
    process.exit(0);
  }, 3000);
}

// Check if we're in development by looking for the vite dev server
const isDev = process.env.NODE_ENV === 'development';

// Handle being launched by the installer (NSIS) - allow quit during install/uninstall
if (process.argv.some(arg => arg.startsWith('--updated') || arg.startsWith('--uninstall'))) {
  isQuitting = true;
}

// Single instance lock: if the installer (or anything else) launches a second
// instance, the OLD instance receives 'second-instance' and force-exits so
// NSIS / the new process can proceed.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // We are the second instance — exit immediately so the primary can keep running
  // (or, in the installer case, so NSIS sees no conflict).
  process.exit(0);
}
app.on('second-instance', () => {
  console.log('second-instance detected — force-exiting old instance for installer');
  isQuitting = true;
  process.exit(0);
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true, // Start in fullscreen
    autoHideMenuBar: true, // Hide the menu bar
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // CRITICAL: Enable autoplay without user gesture
      autoplayPolicy: 'no-user-gesture-required',
      // Allow renderer to fetch remote audio/media from file:// protocol in production
      webSecurity: false,
    },
  });

  // Remove the menu bar completely
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Dev tools - only in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Initialize managers
  mqttManager = new MqttManager();
  audioEngine = new AudioEngine();

  // Setup IPC handlers
  setupIpcHandlers(ipcMain, mqttManager, audioEngine);

  // Prevent renderer crashes from closing the app - reload instead
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details.reason);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer crashed, reloading...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
  });

  // Prevent the window from being closed accidentally
  mainWindow.on('unresponsive', () => {
    console.error('Window unresponsive, waiting for recovery...');
  });

  // Any 'close' event = intentional close (user Alt+F4, OS shutdown, NSIS
  // installer WM_CLOSE). Mark as quitting so window-all-closed won't resurrect.
  mainWindow.on('close', () => {
    console.log('window close event — treating as intentional quit');
    isQuitting = true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    mqttManager?.disconnect();
    audioEngine?.stop();
  });
}

// Disable hardware acceleration issues on some systems
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Force software video decoding to avoid VDA (Video Decode Accelerator) errors
// VDA Error 4 occurs when hardware decoder fails on certain video codecs
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-gpu-video-decode');

// Fix audio playback on Windows - keep audio service in-process
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess,AudioServiceSandbox');

// Ignore GPU blocklist for better compatibility
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Enable autoplay for media
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
  createWindow();

  // Auto-updater setup: download and install automatically
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version, '— will auto-install');
    mainWindow?.webContents.send('update:downloaded');
    // Auto quit and install after 5 seconds — no user action needed
    setTimeout(() => {
      console.log('Auto-installing update now...');
      forceQuitAndInstall();
    }, 5000);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  // Check for updates on startup and every 2 minutes
  autoUpdater.checkForUpdates().catch((err) => console.error('Update check failed:', err));
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => console.error('Update check failed:', err));
  }, 2 * 60 * 1000);

  // IPC handler: force install update
  ipcMain.handle('app:installUpdate', () => {
    forceQuitAndInstall();
  });

  // IPC handler: quit app — hard kill so installer/reinstall can proceed
  ipcMain.handle('app:quit', () => {
    forceKill();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Always quit when all windows are closed. Crash recovery is handled by
  // render-process-gone / crashed / uncaughtException (which reload the
  // renderer without destroying the window). Resurrecting the window here
  // was blocking legitimate quit signals from the NSIS installer.
  app.quit();
});

// Mark as intentional quit so window-all-closed allows it
app.on('before-quit', () => {
  isQuitting = true;
  mqttManager?.disconnect();
  audioEngine?.stop();
});

// Handle uncaught exceptions - NEVER let the app die
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Try to recover by reloading the renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    } catch (e) {
      console.error('Failed to reload after uncaught exception:', e);
    }
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Handle GPU process crash - reload renderer
app.on('gpu-process-crashed' as any, (_event: any, killed: boolean) => {
  console.error('GPU process crashed, killed:', killed);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.reload();
  }
});
