'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { usePreferenceStore } from '@/stores/preferenceStore';
import { useSettingsStore, type NoiseType } from '@/stores/settingsStore';
import { useAudioStore } from '@/stores/audioStore';
import {
  Slider,
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '../ui';
import {
  StatsSection,
  LearningProgress,
  LearnedPreferences,
} from './settings/index';
import {
  exportAllData,
  downloadJson,
  validateImportData,
  importAllData,
} from '@/lib/preferences/dataTransfer';
import { generateTasteProfile, getTasteProfileUrl } from '@/lib/preferences/tasteProfile';
import { AnalyticsDashboard } from '../analytics/AnalyticsDashboard';
import type { VisualizerType } from '../visualizer/types';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const SETTINGS_HISTORY_STATE = 'settings-open';

const FOCUS_TIMER_OPTIONS = [
  { label: 'Off', value: null },
  { label: '25 min', value: 25 },
  { label: '50 min', value: 50 },
] as const;

const NOISE_TYPE_OPTIONS: { label: string; value: NoiseType }[] = [
  { label: 'Off', value: 'off' },
  { label: 'White', value: 'white' },
  { label: 'Pink', value: 'pink' },
  { label: 'Brown', value: 'brown' },
];

const VISUALIZER_OPTIONS: { label: string; value: VisualizerType }[] = [
  { label: 'Lava Lamp', value: 'lava' },
  { label: 'Waveform', value: 'waveform' },
  { label: 'Particles', value: 'particles' },
  { label: 'Dots', value: 'dots' },
];

const SLEEP_TIMER_OPTIONS = [
  { label: 'Off', value: null },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
] as const;

function isTimerOptionActive(
  optionValue: number | null,
  timerMinutes: number | null,
  timerEndTime: number | null
): boolean {
  if (optionValue === null) return timerEndTime === null;
  return timerMinutes === optionValue && timerEndTime !== null;
}

function getExplorationLabel(value: number): string {
  if (value < 0.25) return 'Familiar';
  if (value < 0.5) return 'Mostly Familiar';
  if (value < 0.75) return 'Balanced';
  if (value < 0.9) return 'Mostly New';
  return 'Discover';
}

function getExplorationDescription(value: number): string {
  if (value < 0.3) return 'Sticks to your learned preferences';
  if (value < 0.7) return 'Balances favorites with new discoveries';
  return 'Explores more variety in music styles';
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const isClosingFromPopstate = useRef(false);
  const wasOpen = useRef(false);

  const {
    totalSongs,
    likeCount,
    skipCount,
    exploitationRatio,
    bestParams,
    loadStats,
    resetPreferences,
    isLoading,
  } = usePreferenceStore();

  const {
    bpmMin,
    bpmMax,
    explorationLevel,
    sleepTimerMinutes,
    sleepTimerEndTime,
    noiseType,
    noiseVolume,
    focusTimerMinutes,
    focusTimerEndTime,
    showAdvancedSettings,
    setBpmRange,
    setExplorationLevel,
    setSleepTimer,
    clearSleepTimer,
    setNoiseType,
    setNoiseVolume,
    setFocusTimer,
    setShowAdvancedSettings,
    visualizerType,
    setVisualizerType,
  } = useSettingsStore();

  const { pause, setNoiseType: setAudioNoiseType, setNoiseVolume: setAudioNoiseVolume } = useAudioStore();

  const [localBpmMin, setLocalBpmMin] = useState(bpmMin);
  const [localBpmMax, setLocalBpmMax] = useState(bpmMax);
  const [localExploration, setLocalExploration] = useState(explorationLevel);
  const [localNoiseVolume, setLocalNoiseVolume] = useState(noiseVolume);
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState<string | null>(null);
  const [focusTimeRemaining, setFocusTimeRemaining] = useState<string | null>(null);
  const [customFocusInput, setCustomFocusInput] = useState('');
  const [showCustomFocus, setShowCustomFocus] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    setLocalBpmMin(bpmMin);
    setLocalBpmMax(bpmMax);
    setLocalExploration(explorationLevel);
    setLocalNoiseVolume(noiseVolume);
  }, [bpmMin, bpmMax, explorationLevel, noiseVolume]);

  // Sleep timer countdown
  useEffect(() => {
    if (!sleepTimerEndTime) {
      setSleepTimeRemaining(null);
      return;
    }

    const updateRemaining = () => {
      const remaining = sleepTimerEndTime - Date.now();
      if (remaining <= 0) {
        pause();
        clearSleepTimer();
        setSleepTimeRemaining(null);
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setSleepTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndTime, pause, clearSleepTimer]);

  // Focus timer countdown
  useEffect(() => {
    if (!focusTimerEndTime) {
      setFocusTimeRemaining(null);
      return;
    }

    const updateRemaining = () => {
      const remaining = focusTimerEndTime - Date.now();
      if (remaining <= 0) {
        setFocusTimeRemaining(null);
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setFocusTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [focusTimerEndTime]);

  useEffect(() => {
    if (isOpen) loadStats();
  }, [isOpen, loadStats]);

  // Manage history state for back button support
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      // Opening: push state
      window.history.pushState({ modal: SETTINGS_HISTORY_STATE }, '');
    } else if (!isOpen && wasOpen.current && !isClosingFromPopstate.current) {
      // Closing (not from popstate): go back
      if (window.history.state?.modal === SETTINGS_HISTORY_STATE) {
        window.history.back();
      }
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  // Handle browser back button
  useEffect(() => {
    const handlePopstate = () => {
      if (isOpen) {
        isClosingFromPopstate.current = true;
        onClose();
        setTimeout(() => {
          isClosingFromPopstate.current = false;
        }, 0);
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [isOpen, onClose]);

  const handleBpmMinCommit = useCallback(() => {
    const min = Math.min(localBpmMin, localBpmMax);
    const max = Math.max(localBpmMin, localBpmMax);
    setBpmRange(min, max);
  }, [localBpmMin, localBpmMax, setBpmRange]);

  const handleBpmMaxCommit = useCallback(() => {
    const min = Math.min(localBpmMin, localBpmMax);
    const max = Math.max(localBpmMin, localBpmMax);
    setBpmRange(min, max);
  }, [localBpmMin, localBpmMax, setBpmRange]);

  const handleExplorationCommit = useCallback(() => {
    setExplorationLevel(localExploration);
  }, [localExploration, setExplorationLevel]);

  const handleNoiseVolumeCommit = useCallback(() => {
    setNoiseVolume(localNoiseVolume);
    setAudioNoiseVolume(localNoiseVolume);
  }, [localNoiseVolume, setNoiseVolume, setAudioNoiseVolume]);

  const handleNoiseTypeChange = (type: NoiseType) => {
    setNoiseType(type);
    setAudioNoiseType(type);
  };

  const handleCustomFocusSubmit = () => {
    const minutes = parseInt(customFocusInput, 10);
    if (!isNaN(minutes) && minutes > 0 && minutes <= 180) {
      setFocusTimer(minutes);
      setShowCustomFocus(false);
      setCustomFocusInput('');
    }
  };

  const handleReset = async () => {
    if (confirm('Reset all learned preferences? This cannot be undone.')) {
      await resetPreferences();
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleShareTaste = async () => {
    try {
      const profile = await generateTasteProfile();
      const url = getTasteProfileUrl(profile);
      await navigator.clipboard.writeText(url);
      toast.success(`Copied! Your taste: ${profile.summary}`);
    } catch {
      toast.error('Failed to generate taste profile');
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      downloadJson(data);
      toast.success('Data exported successfully');
    } catch {
      toast.error('Failed to export data');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!validateImportData(parsed)) {
          toast.error('Invalid data file');
          return;
        }
        await importAllData(parsed);
        toast.success('Data imported successfully');
        loadStats();
      } catch {
        toast.error('Failed to import data');
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const settingsContent = (
    <div className="space-y-8">
      <h2 className="text-text-bright text-lg font-medium">Settings</h2>

      {/* Focus Timer */}
      <section aria-labelledby="settings-focus-timer" className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 id="settings-focus-timer" className="text-text text-sm">Focus Timer</h3>
          {focusTimeRemaining && (
            <span className="text-accent text-sm">Remaining: {focusTimeRemaining}</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {FOCUS_TIMER_OPTIONS.map((option) => (
            <button
              key={option.label}
              onClick={() => {
                setFocusTimer(option.value);
                setShowCustomFocus(false);
              }}
              className={`px-4 py-2 rounded-xl text-sm transition-colors ${
                isTimerOptionActive(option.value, focusTimerMinutes, focusTimerEndTime)
                  ? 'bg-accent/25 text-accent border border-accent/30'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            onClick={() => setShowCustomFocus(!showCustomFocus)}
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${
              showCustomFocus ? 'bg-accent/25 text-accent border border-accent/30' : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
          >
            Custom
          </button>
        </div>
        <AnimatePresence>
          {showCustomFocus && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 items-center overflow-hidden"
            >
              <input
                type="number"
                value={customFocusInput}
                onChange={(e) => setCustomFocusInput(e.target.value)}
                placeholder="Minutes (1-180)"
                min={1}
                max={180}
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-text text-sm focus:outline-none focus:border-accent/50"
              />
              <button
                onClick={handleCustomFocusSubmit}
                className="px-4 py-2 rounded-xl bg-accent/20 text-accent text-sm hover:bg-accent/30 transition-colors"
              >
                Set
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Background Noise */}
      <section aria-labelledby="settings-noise" className="space-y-4">
        <h3 id="settings-noise" className="text-text text-sm">Background Noise</h3>
        <div className="flex gap-2 flex-wrap">
          {NOISE_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleNoiseTypeChange(option.value)}
              className={`px-4 py-2 rounded-xl text-sm transition-colors ${
                noiseType === option.value
                  ? 'bg-accent/25 text-accent border border-accent/30'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {noiseType !== 'off' && (
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-light rounded-xl p-4 space-y-2"
          >
            <div className="flex justify-between text-xs text-text-muted">
              <span>Volume</span>
              <span>{Math.round(localNoiseVolume * 100)}%</span>
            </div>
            <Slider
              aria-label="Noise volume"
              value={[localNoiseVolume]}
              onValueChange={([v]) => setLocalNoiseVolume(v)}
              onValueCommit={handleNoiseVolumeCommit}
              min={0}
              max={1}
              step={0.05}
            />
          </motion.div>
        )}
      </section>

      {/* Visualizer */}
      <section aria-labelledby="settings-visualizer" className="space-y-4">
        <h3 id="settings-visualizer" className="text-text text-sm">Visualizer</h3>
        <div className="flex gap-2 flex-wrap">
          {VISUALIZER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setVisualizerType(option.value)}
              className={`px-4 py-2 rounded-xl text-sm transition-colors ${
                visualizerType === option.value
                  ? 'bg-accent/25 text-accent border border-accent/30'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* Sleep Timer */}
      <section aria-labelledby="settings-sleep-timer" className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 id="settings-sleep-timer" className="text-text text-sm">Sleep Timer</h3>
          {sleepTimeRemaining && (
            <span className="text-accent text-sm">{sleepTimeRemaining}</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {SLEEP_TIMER_OPTIONS.map((option) => (
            <button
              key={option.label}
              onClick={() => setSleepTimer(option.value)}
              className={`px-4 py-2 rounded-xl text-sm transition-colors ${
                isTimerOptionActive(option.value, sleepTimerMinutes, sleepTimerEndTime)
                  ? 'bg-accent/25 text-accent border border-accent/30'
                  : 'text-text-muted hover:text-text hover:bg-white/5'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* Advanced Settings (Collapsible) */}
      <section aria-labelledby="settings-advanced" className="space-y-4">
        <button
          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          className="flex items-center gap-2 text-text-muted hover:text-text transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showAdvancedSettings ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span id="settings-advanced" className="text-sm">Advanced Settings</span>
        </button>

        <AnimatePresence>
          {showAdvancedSettings && (
            <motion.div
              initial={false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 overflow-hidden"
            >
              {/* BPM Range */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-text text-sm">BPM Range</h3>
                  <span className="text-text-muted text-xs">
                    {localBpmMin} - {localBpmMax} BPM
                  </span>
                </div>
                <div className="glass-light rounded-xl p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Min</span>
                      <span>{localBpmMin} BPM</span>
                    </div>
                    <Slider
                      aria-label="Minimum BPM"
                      value={[localBpmMin]}
                      onValueChange={([v]) => setLocalBpmMin(v)}
                      onValueCommit={handleBpmMinCommit}
                      min={60}
                      max={100}
                      step={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Max</span>
                      <span>{localBpmMax} BPM</span>
                    </div>
                    <Slider
                      aria-label="Maximum BPM"
                      value={[localBpmMax]}
                      onValueChange={([v]) => setLocalBpmMax(v)}
                      onValueCommit={handleBpmMaxCommit}
                      min={60}
                      max={100}
                      step={5}
                    />
                  </div>
                  <p className="text-text-muted text-xs">
                    Restricts generated songs to this tempo range
                  </p>
                </div>
              </div>

              {/* Discovery Mode */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-text text-sm">Discovery Mode</h3>
                  <span className="text-text-muted text-xs">
                    {getExplorationLabel(localExploration)}
                  </span>
                </div>
                <div className="glass-light rounded-xl p-5 space-y-3">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Familiar</span>
                    <span>Discover</span>
                  </div>
                  <Slider
                    aria-label="Discovery mode level"
                    value={[localExploration]}
                    onValueChange={([v]) => setLocalExploration(v)}
                    onValueCommit={handleExplorationCommit}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                  <p className="text-text-muted text-xs">
                    {getExplorationDescription(localExploration)}
                  </p>
                </div>
              </div>

              <StatsSection totalSongs={totalSongs} likeCount={likeCount} skipCount={skipCount} isLoading={isLoading} />
              <LearningProgress exploitationRatio={exploitationRatio} totalSongs={totalSongs} />
              <LearnedPreferences bestParams={bestParams} />

              {/* Reset Button */}
              <button
                onClick={handleReset}
                disabled={isLoading}
                className="w-full py-3 rounded-xl border border-error/30 text-error text-sm hover:bg-error/10 transition-colors disabled:opacity-50"
              >
                Reset Learned Preferences
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Your Data */}
      <section aria-labelledby="settings-data" className="space-y-4">
        <h3 id="settings-data" className="text-text text-sm">Your Data</h3>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 py-3 rounded-xl glass-light text-text text-sm hover:bg-white/10 transition-colors"
          >
            Export Data
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-3 rounded-xl glass-light text-text text-sm hover:bg-white/10 transition-colors"
          >
            Import Data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
        <p className="text-text-muted text-xs">
          Export your preferences and listening history, or import from a backup.
        </p>
      </section>

      {/* Insights & Sharing */}
      <section className="space-y-3">
        <div className="flex gap-3">
          <button
            onClick={() => setShowAnalytics(true)}
            className="flex-1 py-3 rounded-xl glass-light text-text text-sm hover:bg-white/10 transition-colors"
          >
            View Insights
          </button>
          <button
            onClick={handleShareTaste}
            className="flex-1 py-3 rounded-xl glass-light text-text text-sm hover:bg-white/10 transition-colors"
          >
            Share Your Taste
          </button>
        </div>
      </section>

      {/* About */}
      <div className="text-center space-y-2 pt-6">
        <p className="text-text-muted text-xs">
          LofAI v1.0{process.env.NEXT_PUBLIC_BUILD_ID ? ` (${process.env.NEXT_PUBLIC_BUILD_ID})` : ''}
        </p>
        <p className="text-text-muted text-xs">
          Focus music for ADHD brains
        </p>
      </div>
    </div>
  );

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="safe-area-bottom">
          <DrawerTitle className="sr-only">Settings</DrawerTitle>
          <DrawerDescription className="sr-only">Adjust focus timer, background noise, sleep timer, and advanced music preferences.</DrawerDescription>
          <div className="overflow-y-auto overscroll-contain px-6 pb-10 max-h-[80vh]">
            {settingsContent}
          </div>
        </DrawerContent>
      </Drawer>
      <AnalyticsDashboard isOpen={showAnalytics} onClose={() => setShowAnalytics(false)} />
    </>
  );
}
