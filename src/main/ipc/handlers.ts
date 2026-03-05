import { IpcMain, app } from 'electron';
import Store from 'electron-store';
import { MqttManager } from '../mqtt/MqttManager';
import { AudioEngine } from '../audio/AudioEngine';

const store = new Store();

export function setupIpcHandlers(
  ipcMain: IpcMain,
  mqttManager: MqttManager,
  audioEngine: AudioEngine
): void {
  // MQTT Handlers
  ipcMain.handle('mqtt:connect', async (_event, config: { club: string; room: string }) => {
    await mqttManager.connect(config.club, config.room);
  });

  ipcMain.handle('mqtt:disconnect', async () => {
    mqttManager.disconnect();
  });

  ipcMain.handle('mqtt:publishLightSequence', async (_event, sequence: number) => {
    mqttManager.publishLightSequence(sequence);
  });

  ipcMain.handle('mqtt:publishControl', async (_event, loadType: string, controlValue: number) => {
    mqttManager.publishControl(loadType, controlValue);
  });

  ipcMain.handle('mqtt:setAutomaticMode', async () => {
    mqttManager.setAutomaticMode();
  });

  ipcMain.handle('mqtt:setManualMode', async () => {
    mqttManager.setManualMode();
  });

  ipcMain.handle('mqtt:ensureSound', async () => {
    mqttManager.ensureSound();
  });

  // Audio Handlers
  ipcMain.handle('audio:play', async (_event, config: { url: string; startPosition?: number; volume?: number }) => {
    await audioEngine.play(config.url, config.startPosition || 0, config.volume || 0.87);
  });

  ipcMain.handle('audio:pause', async () => {
    audioEngine.pause();
  });

  ipcMain.handle('audio:resume', async () => {
    audioEngine.resume();
  });

  ipcMain.handle('audio:stop', async () => {
    audioEngine.stop();
  });

  ipcMain.handle('audio:setVolume', async (_event, volume: number) => {
    audioEngine.setVolume(volume);
  });

  ipcMain.handle('audio:seek', async (_event, positionMs: number) => {
    audioEngine.seek(positionMs);
  });

  ipcMain.handle('audio:getCurrentTime', async () => {
    return audioEngine.getCurrentTime();
  });

  ipcMain.handle('audio:preload', async (_event, url: string) => {
    await audioEngine.preload(url);
  });

  // Store Handlers (replacing cookies)
  ipcMain.handle('store:get', async (_event, key: string) => {
    return store.get(key);
  });

  ipcMain.handle('store:set', async (_event, key: string, value: unknown) => {
    store.set(key, value);
  });

  ipcMain.handle('store:delete', async (_event, key: string) => {
    store.delete(key);
  });

  ipcMain.handle('store:clear', async () => {
    store.clear();
  });

  // App Handlers
  ipcMain.handle('app:getVersion', async () => {
    return app.getVersion();
  });
}
