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

const DOT_COUNT = 28;
const CONNECTION_DIST = 100;

const createDots = (w: number, h: number): Dot[] =>
  Array.from({ length: DOT_COUNT }, (_, i) => ({
    baseX: w * 0.1 + Math.random() * w * 0.8,
    baseY: h * 0.1 + Math.random() * h * 0.8,
    size: 1.5 + Math.random() * 2,
    hue: 260 + Math.random() * 35,
    phase: Math.random() * Math.PI * 2,
    speed: 0.2 + Math.random() * 0.5,
    band: i % 3,
  }));

export const MinimalDots = memo(function MinimalDots({ isPlaying }: VisualizerProps) {
  const { bass, mids, overall } = useAudioAnalyzer(isPlaying);
  const [hasEverPlayed, setHasEverPlayed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const audioRef = useRef({ bass: 0, mids: 0, overall: 0 });
  const dimsRef = useRef({ w: 0, h: 0 });

  audioRef.current = { bass, mids, overall };

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

      const { bass: b, mids: m, overall: o } = audioRef.current;
      const t = Date.now() * 0.001;
      const dots = dotsRef.current;

      // Compute positions
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const bandVal = d.band === 0 ? b : d.band === 1 ? m : o;

        posX[i] = d.baseX
          + Math.sin(t * d.speed + d.phase) * 18
          + Math.cos(t * d.speed * 0.6 + d.phase * 2) * 10
          + Math.sin(d.phase + t * 1.5) * bandVal * 8;

        posY[i] = d.baseY
          + Math.cos(t * d.speed * 0.8 + d.phase) * 14
          + Math.sin(t * d.speed * 0.4 + d.phase * 1.5) * 8
          + Math.cos(d.phase + t * 1.5) * bandVal * 6;
      }

      // Draw connections
      const connDist = CONNECTION_DIST + o * 40;
      const connDistSq = connDist * connDist;
      ctx.lineWidth = 0.5;

      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = posX[i] - posX[j];
          const dy = posY[i] - posY[j];
          const distSq = dx * dx + dy * dy;

          if (distSq < connDistSq) {
            const dist = Math.sqrt(distSq);
            const alpha = (1 - dist / connDist) * 0.12 * (0.5 + o * 0.5);
            ctx.strokeStyle = `hsla(275, 45%, 60%, ${alpha})`;
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
        const bandVal = d.band === 0 ? b : d.band === 1 ? m : o;
        const s = d.size + bandVal * 2.5;
        const alpha = 0.35 + bandVal * 0.4;

        // Glow
        ctx.beginPath();
        ctx.arc(posX[i], posY[i], s * 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${d.hue}, 55%, 60%, ${alpha * 0.06})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(posX[i], posY[i], s, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${d.hue}, 65%, 65%, ${alpha})`;
        ctx.fill();
      }

      // Subtle center ambient glow
      const cAlpha = 0.03 + o * 0.05;
      const cg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.35);
      cg.addColorStop(0, `hsla(275, 45%, 50%, ${cAlpha})`);
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
