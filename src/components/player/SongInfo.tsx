'use client';

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SongInfoProps {
  focusSessionStart: number | null;
  focusElapsedMs: number;
  isVisible: boolean;
  isPlaying: boolean;
}

export const SongInfo = memo(function SongInfo({
  focusSessionStart,
  focusElapsedMs,
  isVisible,
  isPlaying,
}: SongInfoProps) {
  const [focusMinutes, setFocusMinutes] = useState(0);

  useEffect(() => {
    const updateFocusTime = () => {
      // Current session elapsed (if playing)
      const currentSessionMs = focusSessionStart ? Date.now() - focusSessionStart : 0;
      // Total = accumulated + current session
      const totalMs = focusElapsedMs + currentSessionMs;
      setFocusMinutes(Math.floor(totalMs / 60000));
    };

    updateFocusTime();

    // Only run interval when playing
    if (!isPlaying) return;

    const interval = setInterval(updateFocusTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [focusSessionStart, focusElapsedMs, isPlaying]);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="focus-time"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="text-center"
        >
          <div className="text-text-muted text-sm md:text-base">
            Focused: {focusMinutes} min
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
