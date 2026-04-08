import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { MqttManager } from './mqtt/MqttManager';
import { AudioEngine } from './audio/AudioEngine';
import { setupIpcHandlers } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;
let mqttManager: MqttManager | null = null;
let audioEngine: AudioEngine | null = null;

// Check if we're in development by looking for the vite dev server
const isDev = process.env.NODE_ENV === 'development';

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

// NOTE: Removed disable-accelerated-audio-decode - it was blocking audio playback in production builds

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
    autoUpdater.quitAndInstall();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent memory leaks - clean up on exit
app.on('before-quit', () => {
  mqttManager?.disconnect();
  audioEngine?.stop();
});

// Handle uncaught exceptions to prevent crashes during long sessions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
