"use client";

import { useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAudioStore } from "@/stores/audioStore";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useSleepTimer } from "@/lib/hooks/useSleepTimer";
import { useFocusTimer } from "@/lib/hooks/useFocusTimer";
import { useVolumeSlider } from "@/lib/hooks/useVolumeSlider";
import { LavaLamp } from "./visualizer/LavaLamp";
import { FocusMode } from "./ui/FocusMode";
import { PlayButton } from "./player/PlayButton";
import { GenerateButton } from "./player/GenerateButton";
import { FeedbackButtons } from "./player/FeedbackButtons";
import { Settings as SettingsIcon } from "lucide-react";
import { GlassButton } from "./ui";
import { VolumeControl, VolumeSlider } from "./player/VolumeControl";
import { SongInfo } from "./player/SongInfo";
import { LearningIndicator } from "./player/LearningIndicator";
import { Settings } from "./player/Settings";
import { Onboarding } from "./player/Onboarding";
import {
  applyWarmStart,
  OnboardingPreferences,
} from "@/lib/preferences/warmStart";

export function Player() {
  const {
    isPlaying,
    isLoading,
    bpm,
    volume,
    error,
    songId,
    togglePlayback,
    generate,
    setVolume,
    like,
    dislike,
    pause,
    retry,
    clearError,
  } = useAudioStore();

  const {
    controlsVisible,
    settingsOpen,
    showOnboarding,
    showLearningIndicator,
    toggleControls,
    showControls: resetControlsTimer,
    setSettingsOpen,
    completeOnboarding,
    startOnboarding,
  } = useUIStore();

  const {
    sleepTimerEndTime,
    clearSleepTimer,
    focusTimerEndTime,
    focusSessionStart,
    noiseType,
    noiseVolume,
    clearFocusTimer,
    startFocusSession,
    pauseFocusSession,
    focusElapsedMs,
  } = useSettingsStore();
  const { isDesktop } = useIsMobile();
  const {
    setNoiseType: setAudioNoiseType,
    setNoiseVolume: setAudioNoiseVolume,
  } = useAudioStore();

  useSleepTimer({
    sleepTimerEndTime,
    onTimerExpired: pause,
    clearTimer: clearSleepTimer,
  });

  // Focus timer - plays gentle notification when complete
  const handleFocusTimerComplete = useCallback(() => {
    toast("Focus complete! Take a break?", {
      duration: 5000,
      position: "top-center",
    });
  }, []);

  useFocusTimer({
    focusTimerEndTime,
    onTimerComplete: handleFocusTimerComplete,
    clearTimer: clearFocusTimer,
  });

  // Start/pause focus session with play state
  useEffect(() => {
    if (isPlaying && !focusSessionStart) {
      startFocusSession();
    } else if (!isPlaying && focusSessionStart) {
      pauseFocusSession();
    }
  }, [isPlaying, focusSessionStart, startFocusSession, pauseFocusSession]);

  // Sync noise settings to audio engine on mount and when they change
  useEffect(() => {
    setAudioNoiseType(noiseType);
  }, [noiseType, setAudioNoiseType]);

  useEffect(() => {
    setAudioNoiseVolume(noiseVolume);
  }, [noiseVolume, setAudioNoiseVolume]);

  const {
    showVolumeSlider,
    handleVolumeToggle,
    handleVolumeInteraction,
    closeVolumeSlider,
  } = useVolumeSlider({ isDesktop, resetControlsTimer });

  // Focus mode is active on mobile when controls are hidden and playing
  const isInFocusMode = !isDesktop && !controlsVisible && isPlaying;

  useKeyboardShortcuts({
    onTogglePlayback: togglePlayback,
    onGenerate: generate,
    onLike: like,
    onDislike: dislike,
    onCloseSettings: () => setSettingsOpen(false),
    onCloseVolumeSlider: closeVolumeSlider,
    onExitFocusMode: resetControlsTimer,
    isInFocusMode,
    isSettingsOpen: settingsOpen,
    isVolumeSliderOpen: showVolumeSlider,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const focusModeHistoryPushed = useRef(false);

  // Handle back button for focus mode
  useEffect(() => {
    if (isInFocusMode && !focusModeHistoryPushed.current) {
      window.history.pushState({ modal: "focus-mode" }, "");
      focusModeHistoryPushed.current = true;
    } else if (!isInFocusMode && focusModeHistoryPushed.current) {
      // Exiting focus mode, clean up history if needed
      if (window.history.state?.modal === "focus-mode") {
        window.history.back();
      }
      focusModeHistoryPushed.current = false;
    }
  }, [isInFocusMode]);

  useEffect(() => {
    const handlePopstate = () => {
      if (isInFocusMode) {
        focusModeHistoryPushed.current = false;
        resetControlsTimer();
      }
    };

    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, [isInFocusMode, resetControlsTimer]);

  useEffect(() => {
    const hasSeenOnboarding =
      localStorage.getItem("lofai-onboarding-complete") === "true";
    if (!hasSeenOnboarding) {
      startOnboarding();
    }
  }, [startOnboarding]);

  const handleTap = useCallback(() => {
    // Close volume slider when clicking outside on any device
    if (showVolumeSlider) {
      closeVolumeSlider();
      return;
    }

    // Mobile-only: toggle controls visibility
    if (!isDesktop) {
      if (!isPlaying) {
        if (!controlsVisible) {
          resetControlsTimer();
        }
      } else {
        toggleControls();
      }
    }
  }, [
    toggleControls,
    isDesktop,
    controlsVisible,
    isPlaying,
    resetControlsTimer,
    showVolumeSlider,
    closeVolumeSlider,
  ]);

  useEffect(() => {
    if (!isDesktop && isPlaying) {
      resetControlsTimer();
    }
  }, [isDesktop, isPlaying, resetControlsTimer]);

  const handleMouseMove = useCallback(() => {
    if (isPlaying) {
      resetControlsTimer();
    }
  }, [isPlaying, resetControlsTimer]);

  const showControls = isDesktop || controlsVisible;

  return (
    <>
      <a href="#main-controls" className="skip-to-content">
        Skip to player controls
      </a>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-bg/95 flex flex-col items-center justify-center p-6"
          >
            <div className="text-center max-w-md">
              <div className="text-error text-4xl mb-4">:(</div>
              <h2 className="text-text-bright text-xl mb-2">
                Something went wrong
              </h2>
              <p className="text-text-muted text-sm mb-6">
                Failed to load the melody AI. This might be a network issue.
              </p>
              <button
                onClick={() => {
                  clearError();
                  retry();
                }}
                className="px-6 py-3 bg-accent/20 hover:bg-accent/30 text-accent rounded-full transition-colors"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Onboarding
        isOpen={showOnboarding}
        onComplete={async (preferences: OnboardingPreferences) => {
          await applyWarmStart(preferences);
          completeOnboarding();
          togglePlayback();
        }}
      />

      <Settings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div
        ref={containerRef}
        className="relative h-[100dvh] w-full overflow-hidden bg-bg select-none"
        onClick={handleTap}
        onMouseMove={isDesktop ? handleMouseMove : undefined}
      >
        <LavaLamp isPlaying={isPlaying} bpm={bpm} />

        {!isDesktop && (
          <FocusMode
            isActive={!controlsVisible && isPlaying}
            focusTimerEndTime={focusTimerEndTime}
          />
        )}

        <div
          ref={mainContentRef}
          className={`
            relative z-10 h-full flex flex-col items-center
            justify-end md:justify-between
            safe-area-top safe-area-bottom safe-area-left safe-area-right
            pt-12 pb-8 px-6 md:py-16 md:px-8
          `}
        >
          {/* Top section - absolute on mobile, relative on desktop */}
          <div
            className="w-full flex justify-between items-center py-2 px-4
            absolute top-0 left-0 right-0 md:relative
            safe-area-top mt-3 md:mt-4
          "
          >
            <div className="flex-1" />
            <LearningIndicator
              isVisible={showLearningIndicator && showControls}
            />
            <div className="flex-1" />
          </div>

          <AnimatePresence>
            {showControls && (
              <motion.div
                id="main-controls"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-6 md:gap-8"
                onClick={(e) => {
                  e.stopPropagation();
                  // Close volume slider when clicking anywhere in controls (including other buttons)
                  if (showVolumeSlider) {
                    closeVolumeSlider();
                  }
                }}
                tabIndex={-1}
              >
                <SongInfo
                  focusSessionStart={focusSessionStart}
                  focusElapsedMs={focusElapsedMs}
                  isVisible={true}
                  isPlaying={isPlaying}
                />

                <FeedbackButtons
                  onLike={() => {
                    closeVolumeSlider();
                    like();
                  }}
                  onDislike={() => {
                    closeVolumeSlider();
                    dislike();
                  }}
                  songId={songId}
                  centerSlot={
                    <PlayButton
                      isPlaying={isPlaying}
                      isLoading={isLoading}
                      loadingText={isPlaying ? undefined : "Generating..."}
                      onClick={() => {
                        closeVolumeSlider();
                        togglePlayback();
                      }}
                    />
                  }
                />

                <AnimatePresence mode="wait">
                  {showVolumeSlider ? (
                    <motion.div
                      key="volume-slider"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <VolumeSlider
                        volume={volume}
                        onChange={setVolume}
                        isVisible={true}
                        onInteraction={handleVolumeInteraction}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="secondary-controls"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-4 md:gap-6"
                    >
                      <VolumeControl
                        volume={volume}
                        showSlider={showVolumeSlider}
                        onToggleSlider={handleVolumeToggle}
                      />
                      <GlassButton
                        variant="default"
                        size="lg-responsive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettingsOpen(true);
                        }}
                        aria-label="Open settings"
                      >
                        <SettingsIcon />
                      </GlassButton>
                      <GenerateButton onClick={generate} disabled={isLoading} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom spacer for layout balance */}
          <div className="w-full pt-6 pb-6 md:pt-0 md:pb-10" />
        </div>
      </div>
    </>
  );
}
