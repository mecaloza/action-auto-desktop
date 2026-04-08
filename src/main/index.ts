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

// Check if we're in development by looking for the vite dev server
const isDev = process.env.NODE_ENV === 'development';

// Handle being launched by the installer (NSIS) - allow quit during install/uninstall
if (process.argv.some(arg => arg.startsWith('--updated') || arg.startsWith('--uninstall'))) {
  isQuitting = true;
}

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

  // Auto-updater setup: download but NEVER auto-install (user must click the button)
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update:downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  // Check for updates on startup and every 30 minutes
  autoUpdater.checkForUpdates().catch((err) => console.error('Update check failed:', err));
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => console.error('Update check failed:', err));
  }, 30 * 60 * 1000);

  // IPC handler: force install update
  ipcMain.handle('app:installUpdate', () => {
    isQuitting = true;
    autoUpdater.quitAndInstall();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (isQuitting) {
    // Allow normal quit (installer, update, user intentional quit)
    app.quit();
  } else if (process.platform !== 'darwin') {
    // Crash recovery: recreate the window instead of quitting
    console.error('All windows closed unexpectedly, recreating...');
    createWindow();
  }
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
