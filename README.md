# Seedtone

AI-generated music that learns your taste. No playlists, no searching — just press play.

![Seedtone](https://img.shields.io/badge/AI-Powered-purple) ![PWA](https://img.shields.io/badge/PWA-Ready-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## What Makes Seedtone Different

Unlike traditional music apps that rely on pre-made playlists or simple shuffle algorithms, Seedtone **generates unique tracks in real-time** and **learns your preferences** using machine learning — creating a truly personalized, infinite listening experience.

### Key Features

- **AI-Generated Melodies** — Uses Google's Magenta.js (MusicRNN) for chord-conditioned melody generation
- **Adaptive Personalization** — Thompson Sampling algorithm learns your taste from both implicit (listen duration) and explicit (like/dislike) feedback
- **Real-Time Synthesis** — Multi-layer audio engine with piano, drums, bass, and pads
- **Physics-Based Visualization** — Lava lamp visualization responds to audio frequency analysis
- **Mobile-First UX** — Swipe gestures, auto-hiding controls, focus mode
- **Offline Ready** — PWA with service worker caching

---

## How the AI Works

### Thompson Sampling for Personalization

Seedtone uses a **multi-armed bandit algorithm** (Thompson Sampling) to balance exploration vs. exploitation when generating music. Each track is generated from 5 musical dimensions:

| Dimension | Arms | Description |
|-----------|------|-------------|
| **Tempo** | 60-70, 70-80, 80-90, 90-100 BPM | Speed of the track |
| **Energy** | low, medium, high | Velocity and instrument density |
| **Valence** | sad, neutral, happy | Emotional tone (chord extensions) |
| **Danceability** | chill, groovy, bouncy | Swing and rhythm emphasis |
| **Mode** | major, minor | Overall tonality |

Each arm maintains a **Beta distribution** (α, β) representing our belief about how much you like that setting. When generating a new song:

1. **Sample** from each arm's Beta distribution
2. **Select** the arm with the highest sampled value
3. **Generate** a track with those parameters
4. **Update** the distributions based on your feedback

```
Reward signals:
  +1.5  Explicit like
  +1.0  Listened to 90%+ of track
  +0.5  30+ minute session bonus
  +0.3  Listened to 50-90%
  -0.5  Listened to <30%
  -1.0  Skipped within 10 seconds
  -1.5  Explicit dislike
```

The algorithm uses **Marsaglia-Tsang's method** for gamma variate sampling to properly sample from Beta distributions — a statistically rigorous implementation that converges to your preferences over time.

### Melody Generation with Magenta.js

Seedtone integrates Google's **MusicRNN** model for chord-conditioned melody generation:

1. Generate a chord progression based on valence/mode parameters
2. Feed chords to MusicRNN as conditioning
3. Model generates melodic sequences that harmonize with the progression
4. Quantize and layer over the generated drums/bass/pads

---

## Architecture

```
src/
├── app/                    # Next.js app router
├── components/
│   ├── player/            # UI controls (play, skip, feedback, settings)
│   ├── visualizer/        # Lava lamp physics simulation
│   └── ui/                # Reusable UI components
├── lib/
│   ├── audio/
│   │   ├── engine.ts      # Core Tone.js synthesis engine
│   │   ├── analyzer.ts    # FFT analysis for visualization
│   │   ├── synths/        # Instrument definitions
│   │   ├── effects/       # Lofi effect chain (compressor, low-pass)
│   │   └── generators/    # Chord/drum pattern generation
│   ├── ml/
│   │   ├── melodyRNN.ts   # Magenta.js integration
│   │   └── modelLoader.ts # Async model loading
│   └── preferences/
│       ├── bandit.ts      # Thompson Sampling implementation
│       ├── feedback.ts    # Reward calculation
│       ├── storage.ts     # IndexedDB persistence
│       └── types.ts       # Type definitions
└── stores/                # Zustand state management
```

### Tech Stack

- **Framework**: Next.js 16 + React 19
- **Audio**: Tone.js for Web Audio synthesis
- **ML**: @magenta/music for melody generation
- **State**: Zustand with persistence
- **Animation**: Framer Motion
- **Styling**: Tailwind CSS 4
- **PWA**: Serwist (service worker)
- **Storage**: IndexedDB via idb

---

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) and press play.

---

## Controls

### Desktop
| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `→` | Skip |
| `L` | Like |
| `D` | Dislike |
| `Esc` | Close settings |

### Mobile
| Gesture | Action |
|---------|--------|
| Tap | Toggle controls |
| Swipe right | Skip |
| Swipe left | Like |
| Swipe up | Open settings |

---

## Settings

- **BPM Range** — Constrain tempo selection (e.g., only 70-90 BPM)
- **Exploration Level** — 0 = use learned preferences, 1 = random exploration
- **Sleep Timer** — Auto-pause after 15/30/60 minutes
- **Background Animation** — Toggle lava lamp visualization

---

## How It Learns

Seedtone improves with every song:

1. **Implicit feedback**: The system tracks how long you listen. Finishing a track = positive signal. Skipping early = negative signal.

2. **Explicit feedback**: Like/dislike buttons provide strong training signals (±1.5 reward).

3. **Session awareness**: Listening for 30+ minutes triggers a session bonus, reinforcing the current style.

4. **Bayesian updates**: Each feedback event updates the Beta distribution for the selected arms, making future selections more likely to match your taste.

After ~30 songs, the algorithm has usually identified your preferred settings. The "Learning Indicator" in the UI shows your personalization progress.

---

## Privacy

All preference data stays on your device in IndexedDB. No tracking, no accounts, no data sent to servers. The ML model runs entirely in your browser.

---

## License

MIT

---

## Support

If this project is useful to you, you can support my work:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/zfaka)
