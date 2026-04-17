import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // MQTT operations
  mqtt: {
    connect: (config: { club: string; room: string }) =>
      ipcRenderer.invoke('mqtt:connect', config),
    disconnect: () => ipcRenderer.invoke('mqtt:disconnect'),
    publishLightSequence: (sequence: number) =>
      ipcRenderer.invoke('mqtt:publishLightSequence', sequence),
    publishControl: (loadType: string, controlValue: number) =>
      ipcRenderer.invoke('mqtt:publishControl', loadType, controlValue),
    setAutomaticMode: () => ipcRenderer.invoke('mqtt:setAutomaticMode'),
    setManualMode: () => ipcRenderer.invoke('mqtt:setManualMode'),
    ensureSound: () => ipcRenderer.invoke('mqtt:ensureSound'),
    onConnectionStatus: (callback: (status: string) => void) => {
      ipcRenderer.on('mqtt:status', (_event, status) => callback(status));
      return () => ipcRenderer.removeAllListeners('mqtt:status');
    },
  },

  // Audio operations
  audio: {
    play: (config: { url: string; startPosition?: number; volume?: number }) =>
      ipcRenderer.invoke('audio:play', config),
    pause: () => ipcRenderer.invoke('audio:pause'),
    resume: () => ipcRenderer.invoke('audio:resume'),
    stop: () => ipcRenderer.invoke('audio:stop'),
    setVolume: (volume: number) => ipcRenderer.invoke('audio:setVolume', volume),
    seek: (positionMs: number) => ipcRenderer.invoke('audio:seek', positionMs),
    getCurrentTime: () => ipcRenderer.invoke('audio:getCurrentTime'),
    preload: (url: string) => ipcRenderer.invoke('audio:preload', url),
    onProgress: (callback: (progress: { current: number; duration: number }) => void) => {
      ipcRenderer.on('audio:progress', (_event, progress) => callback(progress));
      return () => ipcRenderer.removeAllListeners('audio:progress');
    },
  },

  // Store operations (replacing cookies and localStorage)
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    clear: () => ipcRenderer.invoke('store:clear'),
  },

  // App info
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => process.platform,
    installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
    quit: () => ipcRenderer.invoke('app:quit'),
    setClassActive: (active: boolean) => ipcRenderer.invoke('app:setClassActive', active),
    onUpdateDownloaded: (cb: () => void) => {
      ipcRenderer.on('update:downloaded', () => cb());
      return () => { ipcRenderer.removeAllListeners('update:downloaded'); };
    },
  },
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electron: {
      mqtt: {
        connect: (config: { club: string; room: string }) => Promise<void>;
        disconnect: () => Promise<void>;
        publishLightSequence: (sequence: number) => Promise<void>;
        publishControl: (loadType: string, controlValue: number) => Promise<void>;
        setAutomaticMode: () => Promise<void>;
        setManualMode: () => Promise<void>;
        ensureSound: () => Promise<void>;
        onConnectionStatus: (callback: (status: string) => void) => () => void;
      };
      audio: {
        play: (config: { url: string; startPosition?: number; volume?: number }) => Promise<void>;
        pause: () => Promise<void>;
        resume: () => Promise<void>;
        stop: () => Promise<void>;
        setVolume: (volume: number) => Promise<void>;
        seek: (positionMs: number) => Promise<void>;
        getCurrentTime: () => Promise<number>;
        preload: (url: string) => Promise<void>;
        onProgress: (callback: (progress: { current: number; duration: number }) => void) => () => void;
      };
      store: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<void>;
        delete: (key: string) => Promise<void>;
        clear: () => Promise<void>;
      };
      app: {
        getVersion: () => Promise<string>;
        getPlatform: () => string;
        installUpdate: () => Promise<void>;
        quit: () => Promise<void>;
        setClassActive: (active: boolean) => Promise<void>;
        onUpdateDownloaded: (cb: () => void) => () => void;
      };
    };
  }
}
