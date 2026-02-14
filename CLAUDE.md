# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (webpack)
npm run build:turbo  # Production build (turbopack)
npm run lint         # ESLint
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run
npx vitest run src/path/to/test.ts  # Run a single test file
```

## Tech Stack

- **Next.js 16** (App Router, single-page at `/`, no API routes — fully client-side)
- **React 19**, **TypeScript 5** (strict), **Tailwind CSS 4**
- **Tone.js** — Web Audio synthesis and sequencing
- **@magenta/music** — MusicRNN for ML-powered melody generation
- **Zustand** — State management (4 stores: audio, settings, preferences, ui)
- **Radix UI / shadcn/ui** — Component primitives
- **Framer Motion** — Animations
- **Serwist** — PWA service worker
- **idb** — IndexedDB wrapper for ML preference persistence
- **Vitest** + **@testing-library/react** — Testing (jsdom environment)

Path alias: `@/*` → `./src/*`

## Architecture

Seedtone is an offline-capable AI music generator that learns user taste through reinforcement learning. Everything runs client-side.

### Audio Pipeline

`src/lib/audio/engine.ts` orchestrates the top-level playback lifecycle. It delegates to:

1. **Generative engine** (`src/lib/audio/generative/engine.ts`) — core synthesis loop using Tone.js. Generates chord progressions, melodies, and drum patterns in real-time. `sequencer.ts` creates Tone.Sequence instances, `synthSetup.ts` initializes instruments, `paramApplicator.ts` maps ML parameters to synth settings.

2. **Synths** (`src/lib/audio/synths/`) — sampled piano (multi-velocity) and drums. Audio samples live in `public/samples/`.

3. **Effects** (`src/lib/audio/effects/lofiChain.ts`) — lo-fi processing chain (lowpass filter, compressor, noise generator, stereo width).

4. **Analyzer** (`src/lib/audio/analyzer.ts`) — FFT analysis feeding visualizers. Hook: `useAudioAnalyzer.ts`.

### ML Personalization

Thompson Sampling multi-armed bandit (`src/lib/preferences/bandit.ts`) over 5 dimensions: tempo, energy, valence, danceability, mode. Each dimension has a Beta distribution updated by feedback signals.

- **Feedback** (`src/lib/preferences/feedback.ts`) — implicit (listen duration) and explicit (like/dislike) signals produce reward values from -1.5 to +1.5
- **Storage** (`src/lib/preferences/storage.ts`) — arm distributions and song logs persisted to IndexedDB, **per-genre** (each genre learns independently)
- **Warm start** (`src/lib/preferences/warmStart.ts`) — onboarding flow seeds initial preferences

Magenta MusicRNN model (`src/lib/ml/melodyRNN.ts`) generates chord-conditioned melodies. Model weights at `public/models/improv_rnn/`. Lazy-loaded with retry logic. Works well for all jazz-adjacent genres (lofi, bossa, ambient, chillstep).

### Visualizers

Four canvas/CSS visualizers in `src/components/visualizer/`: LavaLamp (default, physics-based blobs), WaveformBars, ParticleField, MinimalDots. All react to FFT data. LavaLamp has performance tiers (high/medium/low) and a CSS-only mobile fallback (<768px).

### Zustand Stores (`src/stores/`)

- `audioStore` — playback state, current song, volume
- `settingsStore` — user prefs (BPM range, noise, exploration level), persisted to localStorage
- `preferenceStore` — ML stats (total songs, likes, skips, exploitation ratio)
- `uiStore` — controls visibility, settings drawer, onboarding state

### PWA

Service worker at `src/app/sw.ts` using Serwist. CacheFirst strategy for audio samples. Manifest at `public/manifest.json`. Update prompt component at `UpdateNotification.tsx`.

## Key Patterns

- All audio code must handle Tone.js AudioContext lifecycle (user gesture required to start)
- Mobile has separate rendering paths in visualizers and glass effects (no backdrop-filter on touch)
- `globals.css` defines CSS custom properties for the dark theme and glassmorphism effects
- Media Session API integration in `src/lib/audio/mediaSession.ts` for OS-level playback controls
