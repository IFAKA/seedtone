import { generativeEngine, type NoiseType } from './generative';
import { mediaSession } from './mediaSession';
import { selectGenerationParams } from '@/lib/preferences/bandit';
import {
  startSongTracking,
  endSongPlayback,
  updateListenDuration,
  isTrackingSong,
} from '@/lib/preferences/feedback';

export type { NoiseType };

export interface EngineState {
  isInitialized: boolean;
  isPlaying: boolean;
  bpm: number;
  currentKey: string;
  songId: string | null;
  samplesLoaded: boolean;
  samplesLoading: boolean;
  progressIndex: number;
  progression: string[];
}

class AudioEngine {
  private state: EngineState = {
    isInitialized: false,
    isPlaying: false,
    bpm: 78, // Effective BPM (156 with swing)
    currentKey: 'C',
    songId: null,
    samplesLoaded: false,
    samplesLoading: false,
    progressIndex: 0,
    progression: [],
  };

  private stateListeners: Set<(state: EngineState) => void> = new Set();

  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private listenStartTime: number = 0;

  async initialize(): Promise<void> {
    if (this.state.isInitialized) return;

    this.state.samplesLoading = true;
    this.notifyListeners();

    await generativeEngine.initialize();

    generativeEngine.subscribe((genState) => {
      this.state.isPlaying = genState.isPlaying;
      this.state.currentKey = genState.key;
      this.state.bpm = 78; // Effective BPM
      this.state.progressIndex = genState.progressIndex;
      this.state.progression = genState.progression.map(c => c.degree);
      this.state.samplesLoaded = genState.isLoaded;
      this.state.samplesLoading = !genState.isLoaded;
      this.notifyListeners();
    });

    mediaSession.setup({
      onPlay: () => this.play(),
      onPause: () => this.pause(),
      onNextTrack: () => this.generateNewSong(),
    });

    this.state.isInitialized = true;
    this.state.samplesLoaded = true;
    this.state.samplesLoading = false;
    this.notifyListeners();
  }

  async generateNewSong(): Promise<void> {
    if (isTrackingSong()) {
      try {
        await endSongPlayback(true);
      } catch {
        // Ignore errors from ending previous song
      }
    }
    this.stopDurationTracking();

    const params = await selectGenerationParams();
    generativeEngine.applyGenerationParams(params);
    generativeEngine.skip();

    const songId = await startSongTracking(params, 180);
    this.state.songId = songId;
    this.startDurationTracking();

    const genState = generativeEngine.getState();

    mediaSession.updateMetadata({
      title: `Lofi in ${genState.key}`,
      artist: 'LofAI Generative',
      album: 'LofAI',
    });

    this.notifyListeners();
  }

  async play(): Promise<void> {
    if (!this.state.isInitialized) {
      await this.initialize();
    }

    if (!isTrackingSong()) {
      const params = await selectGenerationParams();
      generativeEngine.applyGenerationParams(params);
      const songId = await startSongTracking(params, 180);
      this.state.songId = songId;
    }

    await generativeEngine.play();
    this.startDurationTracking();

    const genState = generativeEngine.getState();

    mediaSession.updateMetadata({
      title: `Lofi in ${genState.key}`,
      artist: 'LofAI Generative',
      album: 'LofAI',
    });

    mediaSession.setPlaybackState('playing');
  }

  pause(): void {
    generativeEngine.pause();
    this.stopDurationTracking();
    mediaSession.setPlaybackState('paused');
  }

  async stop(): Promise<void> {
    if (isTrackingSong()) {
      try {
        await endSongPlayback(false);
      } catch {
        // Ignore errors when stopping
      }
    }
    this.stopDurationTracking();
    this.state.songId = null;

    generativeEngine.stop();
    mediaSession.setPlaybackState('none');
  }

  setVolume(volume: number): void {
    generativeEngine.setVolume(volume);
  }

  setNoiseType(type: NoiseType): void {
    generativeEngine.setNoiseType(type);
  }

  setNoiseVolume(volume: number): void {
    generativeEngine.setNoiseVolume(volume);
  }

  private startDurationTracking(): void {
    this.listenStartTime = Date.now();
    this.durationInterval = setInterval(() => {
      if (this.state.isPlaying) {
        const duration = (Date.now() - this.listenStartTime) / 1000;
        updateListenDuration(duration);
      }
    }, 1000);
  }

  private stopDurationTracking(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  getState(): EngineState {
    return { ...this.state };
  }

  subscribe(listener: (state: EngineState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.stateListeners.forEach((listener) => listener(state));
  }

  dispose(): void {
    this.stopDurationTracking();
    generativeEngine.dispose();
    mediaSession.cleanup();
    this.state.isInitialized = false;
  }
}

export const audioEngine = new AudioEngine();
