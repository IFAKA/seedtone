'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioAnalyzer } from '@/lib/audio/useAudioAnalyzer';
import type { VisualizerProps } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 60;

export const ParticleField = memo(function ParticleField({ isPlaying, bpm }: VisualizerProps) {
  const { bass, overall } = useAudioAnalyzer(isPlaying);
  const [hasEverPlayed, setHasEverPlayed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const audioRef = useRef({ bass: 0, overall: 0, bpm: 78 });
  const playingRef = useRef(isPlaying);
  const dimsRef = useRef({ w: 0, h: 0 });

  audioRef.current = { bass, overall, bpm };
  playingRef.current = isPlaying;

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

    const spawn = (): Particle => {
      const { w, h } = dimsRef.current;
      const maxLife = 150 + Math.random() * 200;
      return {
        x: Math.random() * w,
        y: h * 0.4 + Math.random() * h * 0.6,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.15 + Math.random() * 0.35),
        size: 1.5 + Math.random() * 2.5,
        hue: 255 + Math.random() * 40,
        life: maxLife,
        maxLife,
      };
    };

    const loop = () => {
      rafId = requestAnimationFrame(loop);

      const { w, h } = dimsRef.current;
      if (w === 0 || h === 0) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { bass: b, overall: o, bpm: abpm } = audioRef.current;
      const bpmMult = Math.max(0.6, abpm / 80);

      // Spawn only while playing
      if (playingRef.current && particlesRef.current.length < MAX_PARTICLES) {
        const rate = Math.max(1, Math.floor(0.5 + b * 2 + o * 1.5));
        for (let i = 0; i < rate; i++) {
          particlesRef.current.push(spawn());
        }
      }

      // Update and draw
      particlesRef.current = particlesRef.current.filter(p => {
        p.life -= 1;
        if (p.life <= 0) return false;

        p.vy -= 0.008 * bpmMult;
        p.vx += (Math.random() - 0.5) * 0.04;
        p.x += p.vx * bpmMult;
        p.y += p.vy * bpmMult;

        // Wrap horizontally
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;

        const fadeIn = Math.min(1, (p.maxLife - p.life) / 30);
        const fadeOut = Math.min(1, p.life / 40);
        const alpha = fadeIn * fadeOut * (0.3 + o * 0.5);

        const sizeBoost = b > 0.4 ? (b - 0.4) * 3 : 0;
        const s = p.size + sizeBoost;

        // Outer glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 4, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 60%, 60%, ${alpha * 0.04})`;
        ctx.fill();

        // Inner glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 65%, 65%, ${alpha * 0.12})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${alpha})`;
        ctx.fill();

        return true;
      });
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      particlesRef.current = [];
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
          transition={{ duration: 1 }}
        >
          <canvas ref={canvasRef} className="w-full h-full" />
        </motion.div>
      )}
    </AnimatePresence>
  );
});
