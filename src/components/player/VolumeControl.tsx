'use client';

import { memo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { VolumeX, Volume1, Volume2, Volume } from 'lucide-react';
import { GlassButton, Slider } from '../ui';
import { fadeInUp } from '@/lib/animations';

interface VolumeControlProps {
  volume: number;
  showSlider: boolean;
  onToggleSlider: () => void;
}

export const VolumeControl = memo(function VolumeControl({ volume, showSlider, onToggleSlider }: VolumeControlProps) {
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <GlassButton
      variant="default"
      size="lg-responsive"
      onClick={onToggleSlider}
      aria-label="Volume control"
      aria-expanded={showSlider}
    >
      <VolumeIcon className="w-6 h-6 text-text-bright" />
    </GlassButton>
  );
});

interface VolumeSliderProps {
  volume: number;
  onChange: (volume: number) => void;
  isVisible: boolean;
  onInteraction: () => void;
}

export const VolumeSlider = memo(function VolumeSlider({ volume, onChange, isVisible, onInteraction }: VolumeSliderProps) {
  const handleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(0);
    onInteraction();
  }, [onChange, onInteraction]);

  const handleMax = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(1);
    onInteraction();
  }, [onChange, onInteraction]);

  const handleValueChange = useCallback((value: number[]) => {
    onChange(value[0]);
    onInteraction();
  }, [onChange, onInteraction]);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInteraction();
  }, [onInteraction]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          {...fadeInUp}
          className="glass rounded-full px-5 h-16 md:h-20 flex items-center gap-4"
          onClick={handleContainerClick}
        >
          <button
            onClick={handleMute}
            className="text-text-muted hover:text-text transition-colors flex-shrink-0 flex items-center justify-center"
            aria-label="Mute"
          >
            <Volume className="w-6 h-6 md:w-7 md:h-7" />
          </button>

          <Slider
            value={[volume]}
            onValueChange={handleValueChange}
            min={0}
            max={1}
            step={0.01}
            className="w-32 md:w-40"
            aria-label="Volume"
          />

          <button
            onClick={handleMax}
            className="text-text-muted hover:text-text transition-colors flex-shrink-0 flex items-center justify-center"
            aria-label="Max volume"
          >
            <Volume2 className="w-6 h-6 md:w-7 md:h-7" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
