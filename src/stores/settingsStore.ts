import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NoiseType = 'off' | 'white' | 'pink' | 'brown';

interface SettingsStore {
  bpmMin: number;
  bpmMax: number;

  explorationLevel: number;

  sleepTimerMinutes: number | null;
  sleepTimerEndTime: number | null;

  backgroundEnabled: boolean;

  // Focus/ADHD features
  noiseType: NoiseType;
  noiseVolume: number;
  focusTimerMinutes: number | null;
  focusTimerEndTime: number | null;
  focusSessionStart: number | null;
  focusElapsedMs: number; // Accumulated focus time across pause/resume
  showAdvancedSettings: boolean;

  setBpmRange: (min: number, max: number) => void;
  setExplorationLevel: (level: number) => void;
  setSleepTimer: (minutes: number | null) => void;
  clearSleepTimer: () => void;
  setBackgroundEnabled: (enabled: boolean) => void;

  // Focus/ADHD actions
  setNoiseType: (type: NoiseType) => void;
  setNoiseVolume: (volume: number) => void;
  setFocusTimer: (minutes: number | null) => void;
  clearFocusTimer: () => void;
  startFocusSession: () => void;
  pauseFocusSession: () => void;
  resetFocusSession: () => void;
  setShowAdvancedSettings: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      bpmMin: 60,
      bpmMax: 72,

      explorationLevel: 0.5,

      sleepTimerMinutes: null,
      sleepTimerEndTime: null,

      backgroundEnabled: true, // ON by default for desktop

      // Focus/ADHD defaults
      noiseType: 'pink',
      noiseVolume: 0.3,
      focusTimerMinutes: null,
      focusTimerEndTime: null,
      focusSessionStart: null,
      focusElapsedMs: 0,
      showAdvancedSettings: false,

      setBpmRange: (min, max) => {
        const clampedMin = Math.max(60, Math.min(100, min));
        const clampedMax = Math.max(clampedMin, Math.min(100, max));
        set({ bpmMin: clampedMin, bpmMax: clampedMax });
      },

      setExplorationLevel: (level) => {
        set({ explorationLevel: Math.max(0, Math.min(1, level)) });
      },

      setSleepTimer: (minutes) => {
        if (minutes === null) {
          set({ sleepTimerMinutes: null, sleepTimerEndTime: null });
        } else {
          set({
            sleepTimerMinutes: minutes,
            sleepTimerEndTime: Date.now() + minutes * 60 * 1000,
          });
        }
      },

      clearSleepTimer: () => {
        set({ sleepTimerMinutes: null, sleepTimerEndTime: null });
      },

      setBackgroundEnabled: (enabled) => {
        set({ backgroundEnabled: enabled });
      },

      // Focus/ADHD actions
      setNoiseType: (type) => {
        set({ noiseType: type });
      },

      setNoiseVolume: (volume) => {
        set({ noiseVolume: Math.max(0, Math.min(1, volume)) });
      },

      setFocusTimer: (minutes) => {
        if (minutes === null) {
          set({ focusTimerMinutes: null, focusTimerEndTime: null });
        } else {
          set({
            focusTimerMinutes: minutes,
            focusTimerEndTime: Date.now() + minutes * 60 * 1000,
          });
        }
      },

      clearFocusTimer: () => {
        set({ focusTimerMinutes: null, focusTimerEndTime: null });
      },

      startFocusSession: () => {
        set({ focusSessionStart: Date.now() });
      },

      pauseFocusSession: () => {
        set((state) => {
          if (!state.focusSessionStart) return state;
          const elapsed = Date.now() - state.focusSessionStart;
          return {
            focusSessionStart: null,
            focusElapsedMs: state.focusElapsedMs + elapsed,
          };
        });
      },

      resetFocusSession: () => {
        set({ focusSessionStart: null, focusElapsedMs: 0 });
      },

      setShowAdvancedSettings: (show) => {
        set({ showAdvancedSettings: show });
      },
    }),
    {
      name: 'lofai-settings',
      partialize: (state) => ({
        bpmMin: state.bpmMin,
        bpmMax: state.bpmMax,
        explorationLevel: state.explorationLevel,
        backgroundEnabled: state.backgroundEnabled,
        // Persist noise preferences (not timers)
        noiseType: state.noiseType,
        noiseVolume: state.noiseVolume,
        showAdvancedSettings: state.showAdvancedSettings,
      }),
    }
  )
);

export function getAllowedTempoArms(bpmMin: number, bpmMax: number): string[] {
  const arms: string[] = [];

  if (bpmMin <= 72 && bpmMax >= 60) arms.push('focus');
  if (bpmMin <= 78 && bpmMax >= 70) arms.push('60-70');
  if (bpmMin <= 86 && bpmMax >= 78) arms.push('70-80');
  if (bpmMin <= 94 && bpmMax >= 86) arms.push('80-90');
  if (bpmMin <= 102 && bpmMax >= 94) arms.push('90-100');

  if (arms.length === 0) {
    if (bpmMax < 72) return ['focus'];
    if (bpmMin > 94) return ['90-100'];
    return ['70-80'];
  }

  return arms;
}
