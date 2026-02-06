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

const MAX_PARTICLES = 80;

export const ParticleField = memo(function ParticleField({ isPlaying, bpm }: VisualizerProps) {
  const { bass, mids, highs, overall } = useAudioAnalyzer(isPlaying);
  const [hasEverPlayed, setHasEverPlayed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const audioRef = useRef({ bass: 0, mids: 0, highs: 0, overall: 0, bpm: 78 });
  const playingRef = useRef(isPlaying);
  const dimsRef = useRef({ w: 0, h: 0 });

  audioRef.current = { bass, mids, highs, overall, bpm };
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

    const spawn = (burst = false): Particle => {
      const { w, h } = dimsRef.current;
      const maxLife = 120 + Math.random() * 220;
      return {
        x: Math.random() * w,
        y: burst ? h * 0.6 + Math.random() * h * 0.4 : h * 0.3 + Math.random() * h * 0.7,
        vx: (Math.random() - 0.5) * (burst ? 1.2 : 0.4),
        vy: -(0.2 + Math.random() * (burst ? 0.8 : 0.4)),
        size: 1.5 + Math.random() * (burst ? 3.5 : 2.5),
        hue: 250 + Math.random() * 50,
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

      const { bass: b, mids: m, highs: hi, overall: o, bpm: abpm } = audioRef.current;
      const bpmMult = Math.max(0.6, abpm / 80);

      // Spawn - faster on audio energy, burst on strong bass
      if (playingRef.current && particlesRef.current.length < MAX_PARTICLES) {
        const rate = Math.max(1, Math.floor(1 + b * 3 + o * 2));
        const isBurst = b > 0.6;
        for (let i = 0; i < rate; i++) {
          particlesRef.current.push(spawn(isBurst));
        }
      }

      // Ambient glow reacting to mids
      if (o > 0.2) {
        const gAlpha = o * 0.06;
        const g = ctx.createRadialGradient(w / 2, h * 0.7, 0, w / 2, h * 0.7, w * 0.4);
        g.addColorStop(0, `hsla(270, 60%, 50%, ${gAlpha})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Update and draw
      particlesRef.current = particlesRef.current.filter(p => {
        p.life -= 1;
        if (p.life <= 0) return false;

        // Audio-reactive velocity
        p.vy -= (0.01 + hi * 0.008) * bpmMult;
        p.vx += (Math.random() - 0.5) * 0.05 + Math.sin(Date.now() * 0.002 + p.hue) * m * 0.02;
        p.x += p.vx * bpmMult;
        p.y += p.vy * bpmMult;

        // Wrap horizontally
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;

        const fadeIn = Math.min(1, (p.maxLife - p.life) / 25);
        const fadeOut = Math.min(1, p.life / 35);
        const alpha = fadeIn * fadeOut * (0.35 + o * 0.6);

        const sizeBoost = b > 0.35 ? (b - 0.35) * 4 : 0;
        const s = p.size + sizeBoost;

        // Hue shifts with mids
        const hue = p.hue + m * 20;

        // Outer glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 4.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 60%, 60%, ${alpha * 0.05})`;
        ctx.fill();

        // Inner glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 70%, 65%, ${alpha * 0.15})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 75%, 72%, ${alpha})`;
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
