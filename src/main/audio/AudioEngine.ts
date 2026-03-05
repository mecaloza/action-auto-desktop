import { Howl, Howler } from 'howler';

export class AudioEngine {
  private currentTrack: Howl | null = null;
  private preloadedTracks: Map<string, Howl> = new Map();
  private volume: number = 0.87;
  private progressInterval: NodeJS.Timeout | null = null;

  async play(url: string, startPositionMs: number = 0, volume: number = 0.87): Promise<void> {
    this.stop();
    this.volume = volume;

    // Check if track is preloaded
    let track = this.preloadedTracks.get(url);

    if (!track) {
      track = new Howl({
        src: [url],
        html5: true, // Enable streaming for URLs
        volume: volume,
        onloaderror: (_id, error) => {
          console.error('Audio load error:', error);
        },
        onplayerror: (_id, error) => {
          console.error('Audio play error:', error);
        },
      });
    } else {
      track.volume(volume);
    }

    this.currentTrack = track;

    // Wait for the track to be ready
    return new Promise((resolve) => {
      if (track!.state() === 'loaded') {
        track!.seek(startPositionMs / 1000);
        track!.play();
        resolve();
      } else {
        track!.once('load', () => {
          track!.seek(startPositionMs / 1000);
          track!.play();
          resolve();
        });
      }
    });
  }

  pause(): void {
    this.currentTrack?.pause();
  }

  resume(): void {
    this.currentTrack?.play();
  }

  stop(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.currentTrack?.stop();
    this.currentTrack?.unload();
    this.currentTrack = null;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.currentTrack?.volume(this.volume);
  }

  seek(positionMs: number): void {
    if (this.currentTrack) {
      this.currentTrack.seek(positionMs / 1000);
    }
  }

  getCurrentTime(): number {
    if (this.currentTrack) {
      const position = this.currentTrack.seek();
      return typeof position === 'number' ? position * 1000 : 0;
    }
    return 0;
  }

  async preload(url: string): Promise<void> {
    if (this.preloadedTracks.has(url)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const track = new Howl({
        src: [url],
        html5: true,
        preload: true,
        onload: () => {
          this.preloadedTracks.set(url, track);
          resolve();
        },
        onloaderror: (_id, error) => {
          reject(error);
        },
      });
    });
  }

  // Clean up preloaded tracks to prevent memory leaks
  clearPreloadedTracks(): void {
    this.preloadedTracks.forEach((track) => {
      track.unload();
    });
    this.preloadedTracks.clear();
  }

  // Set global volume (affects all Howler sounds)
  setGlobalVolume(volume: number): void {
    Howler.volume(Math.max(0, Math.min(1, volume)));
  }

  // Mute/unmute all audio
  setMuted(muted: boolean): void {
    Howler.mute(muted);
  }
}
