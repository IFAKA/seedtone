import { create } from 'zustand';
import { audioEngine, type NoiseType } from '@/lib/audio/engine';
import { handleExplicitLike, handleExplicitDislike, isTrackingSong } from '@/lib/preferences/feedback';

interface AudioStore {
  isInitialized: boolean;
  isPlaying: boolean;
  bpm: number;
  currentKey: string;
  songId: string | null;
  progression: string[];
  progressIndex: number;

  volume: number;
  isLoading: boolean;
  error: string | null;

  samplesLoading: boolean;
  samplesLoaded: boolean;

  initialize: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  togglePlayback: () => Promise<void>;
  generate: () => Promise<void>;
  setVolume: (volume: number) => void;
  setNoiseType: (type: NoiseType) => void;
  setNoiseVolume: (volume: number) => void;
  like: () => Promise<void>;
  dislike: () => Promise<void>;
  clearError: () => void;
  retry: () => Promise<void>;
}

export const useAudioStore = create<AudioStore>((set, get) => {
  if (typeof window !== 'undefined') {
    audioEngine.subscribe((state) => {
      set({
        isInitialized: state.isInitialized,
        isPlaying: state.isPlaying,
        bpm: state.bpm,
        currentKey: state.currentKey,
        songId: state.songId,
        samplesLoading: state.samplesLoading,
        samplesLoaded: state.samplesLoaded,
        progression: state.progression,
        progressIndex: state.progressIndex,
      });
    });
  }

  return {
    isInitialized: false,
    isPlaying: false,
    bpm: 78,
    currentKey: 'C',
    songId: null,
    progression: [],
    progressIndex: 0,
    volume: 0.8,
    isLoading: false,
    error: null,

    samplesLoading: false,
    samplesLoaded: false,

    initialize: async () => {
      set({ isLoading: true });
      try {
        await audioEngine.initialize();
        audioEngine.setVolume(get().volume);
      } finally {
        set({ isLoading: false });
      }
    },

    play: async () => {
      set({ isLoading: true, error: null });
      try {
        await audioEngine.play();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start playback';
        set({ error: message });
        throw err;
      } finally {
        set({ isLoading: false });
      }
    },

    pause: () => {
      audioEngine.pause();
    },

    togglePlayback: async () => {
      const { isPlaying, isInitialized } = get();

      if (!isInitialized) {
        await get().initialize();
      }

      if (isPlaying) {
        get().pause();
      } else {
        await get().play();
      }
    },

    generate: async () => {
      set({ isLoading: true });
      try {
        await audioEngine.generateNewSong();
        if (!get().isPlaying) {
          await audioEngine.play();
        }
      } finally {
        set({ isLoading: false });
      }
    },

    setVolume: (volume: number) => {
      set({ volume });
      if (get().isInitialized) {
        audioEngine.setVolume(volume);
      }
    },

    setNoiseType: (type: NoiseType) => {
      if (get().isInitialized) {
        audioEngine.setNoiseType(type);
      }
    },

    setNoiseVolume: (volume: number) => {
      if (get().isInitialized) {
        audioEngine.setNoiseVolume(volume);
      }
    },

    like: async () => {
      if (isTrackingSong()) {
        try {
          await handleExplicitLike();
        } catch {
          // Ignore feedback errors
        }
      }
    },

    dislike: async () => {
      if (isTrackingSong()) {
        try {
          await handleExplicitDislike();
        } catch {
          // Ignore feedback errors
        }
      }
      await get().generate();
    },

    clearError: () => {
      set({ error: null });
    },

    retry: async () => {
      set({ error: null });
      audioEngine.dispose();
      await get().initialize();
      await get().play();
    },
  };
});
