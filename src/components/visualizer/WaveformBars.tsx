'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioAnalyzer } from '@/lib/audio/useAudioAnalyzer';
import type { VisualizerProps } from './types';

const BAR_COUNT = 48;

export const WaveformBars = memo(function WaveformBars({ isPlaying }: VisualizerProps) {
  const { bass, mids, highs, overall } = useAudioAnalyzer(isPlaying);
  const [hasEverPlayed, setHasEverPlayed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef({ bass: 0, mids: 0, highs: 0, overall: 0 });
  const smoothRef = useRef(new Float32Array(BAR_COUNT));
  const dimsRef = useRef({ w: 0, h: 0 });

  audioRef.current = { bass, mids, highs, overall };

  useEffect(() => {
    if (isPlaying) setHasEverPlayed(true);
  }, [isPlaying]);

  useEffect(() => {
    if (!hasEverPlayed || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      dimsRef.current.w = canvas.offsetWidth;
      dimsRef.current.h = canvas.offsetHeight;
      canvas.width = dimsRef.current.w * dpr;
      canvas.height = dimsRef.current.h * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const smooth = smoothRef.current;

    const loop = () => {
      rafId = requestAnimationFrame(loop);

      const { w, h } = dimsRef.current;
      if (w === 0 || h === 0) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { bass: b, mids: m, highs: hi, overall: o } = audioRef.current;
      const t = Date.now() * 0.001;

      const gap = 2;
      const barW = Math.max(4, w / BAR_COUNT - gap);
      const total = BAR_COUNT * (barW + gap);
      const ox = (w - total) / 2;

      // Bass pulse - global glow at bottom on strong beats
      if (b > 0.45) {
        const pulseAlpha = (b - 0.45) * 0.6;
        const grad = ctx.createLinearGradient(0, h, 0, h * 0.5);
        grad.addColorStop(0, `hsla(270, 80%, 50%, ${pulseAlpha * 0.15})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        const p = i / BAR_COUNT;

        // Frequency-mapped influence - stronger reactivity
        const bassI = Math.max(0, 1 - p * 2.5) * b * 1.4;
        const midsI = (1 - Math.abs(p - 0.5) * 2.5) * m * 1.1;
        const highsI = Math.max(0, p * 2.5 - 1.2) * hi * 1.2;

        // Gentle wave for baseline animation
        const wave = Math.sin(p * Math.PI * 3 + t * 1.2) * 0.05
          + Math.cos(p * Math.PI * 5 - t * 0.7) * 0.025;

        const target = Math.min(1, Math.max(0.015,
          0.03 + (bassI + midsI + highsI) * 0.7 + o * 0.18 + wave));

        // Faster interpolation for snappier response
        smooth[i] += (target - smooth[i]) * 0.22;

        const barH = smooth[i] * h * 0.9;
        const x = ox + i * (barW + gap);
        const y = h - barH;

        // Hue shifts with bass energy
        const hue = 260 + p * 30 + b * 15;
        const light = 48 + smooth[i] * 28;
        const alpha = 0.4 + smooth[i] * 0.55;

        // Rounded rect (top corners only)
        const r = Math.min(barW / 2, 3);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, h);
        ctx.lineTo(x, h);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();

        // Gradient fill - brighter top
        const grad = ctx.createLinearGradient(x, y, x, h);
        grad.addColorStop(0, `hsla(${hue}, 75%, ${light}%, ${alpha})`);
        grad.addColorStop(0.5, `hsla(${hue}, 70%, ${light - 8}%, ${alpha * 0.6})`);
        grad.addColorStop(1, `hsla(${hue}, 60%, ${light - 15}%, ${alpha * 0.1})`);
        ctx.fillStyle = grad;
        ctx.fill();

        // Top cap glow on active bars
        if (smooth[i] > 0.15) {
          ctx.beginPath();
          ctx.arc(x + barW / 2, y, barW * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 80%, 70%, ${smooth[i] * 0.12})`;
          ctx.fill();
        }
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [hasEverPlayed]);

  return (
    <AnimatePresence>
      {hasEverPlayed && (
        <motion.div
          className="absolute inset-0 flex items-end pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
        >
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ height: '60%', maxHeight: '450px' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});
