'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioAnalyzer } from '@/lib/audio/useAudioAnalyzer';
import type { VisualizerProps } from './types';

interface Dot {
  baseX: number;
  baseY: number;
  size: number;
  hue: number;
  phase: number;
  speed: number;
  band: number;
}

const DOT_COUNT = 32;
const CONNECTION_DIST = 110;

const createDots = (w: number, h: number): Dot[] =>
  Array.from({ length: DOT_COUNT }, (_, i) => ({
    baseX: w * 0.08 + Math.random() * w * 0.84,
    baseY: h * 0.08 + Math.random() * h * 0.84,
    size: 1.8 + Math.random() * 2.2,
    hue: 255 + Math.random() * 40,
    phase: Math.random() * Math.PI * 2,
    speed: 0.25 + Math.random() * 0.55,
    band: i % 3,
  }));

export const MinimalDots = memo(function MinimalDots({ isPlaying }: VisualizerProps) {
  const { bass, mids, highs, overall } = useAudioAnalyzer(isPlaying);
  const [hasEverPlayed, setHasEverPlayed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const audioRef = useRef({ bass: 0, mids: 0, highs: 0, overall: 0 });
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
      dotsRef.current = createDots(dimsRef.current.w, dimsRef.current.h);
    };
    resize();
    window.addEventListener('resize', resize);

    // Pre-allocate position arrays
    const posX = new Float32Array(DOT_COUNT);
    const posY = new Float32Array(DOT_COUNT);

    const loop = () => {
      rafId = requestAnimationFrame(loop);

      const { w, h } = dimsRef.current;
      if (w === 0 || h === 0) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { bass: b, mids: m, highs: hi, overall: o } = audioRef.current;
      const t = Date.now() * 0.001;
      const dots = dotsRef.current;

      // Compute positions - wider motion range driven by audio
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const bandVal = d.band === 0 ? b : d.band === 1 ? m : hi;
        const energy = 1 + o * 0.8;

        posX[i] = d.baseX
          + Math.sin(t * d.speed + d.phase) * 22 * energy
          + Math.cos(t * d.speed * 0.6 + d.phase * 2) * 14 * energy
          + Math.sin(d.phase + t * 1.5) * bandVal * 18;

        posY[i] = d.baseY
          + Math.cos(t * d.speed * 0.8 + d.phase) * 18 * energy
          + Math.sin(t * d.speed * 0.4 + d.phase * 1.5) * 10 * energy
          + Math.cos(d.phase + t * 1.5) * bandVal * 14;
      }

      // Draw connections - pulse width on bass
      const connDist = CONNECTION_DIST + o * 50;
      const connDistSq = connDist * connDist;
      const lineW = 0.5 + b * 1.5;
      ctx.lineWidth = lineW;

      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = posX[i] - posX[j];
          const dy = posY[i] - posY[j];
          const distSq = dx * dx + dy * dy;

          if (distSq < connDistSq) {
            const dist = Math.sqrt(distSq);
            const alpha = (1 - dist / connDist) * (0.12 + b * 0.15) * (0.5 + o * 0.5);
            const hue = 270 + m * 20;
            ctx.strokeStyle = `hsla(${hue}, 50%, 60%, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(posX[i], posY[i]);
            ctx.lineTo(posX[j], posY[j]);
            ctx.stroke();
          }
        }
      }

      // Draw dots
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const bandVal = d.band === 0 ? b : d.band === 1 ? m : hi;
        const s = d.size + bandVal * 4;
        const alpha = 0.4 + bandVal * 0.5;
        const hue = d.hue + m * 15;

        // Glow - bigger on bass
        const glowR = s * (3 + b * 2);
        ctx.beginPath();
        ctx.arc(posX[i], posY[i], glowR, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 60%, 60%, ${alpha * 0.08})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(posX[i], posY[i], s, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 70%, 68%, ${alpha})`;
        ctx.fill();
      }

      // Center ambient glow - stronger reaction
      const cAlpha = 0.04 + o * 0.08;
      const cg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.4);
      cg.addColorStop(0, `hsla(${270 + b * 20}, 50%, 50%, ${cAlpha})`);
      cg.addColorStop(1, 'transparent');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, w, h);
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
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
        >
          <canvas ref={canvasRef} className="w-full h-full" />
        </motion.div>
      )}
    </AnimatePresence>
  );
});
