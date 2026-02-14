import type { ArmState, TempoArm } from '@/lib/preferences/types';

export type GenreId = 'lofi';

export interface TempoConfig {
  ranges: Record<TempoArm, { min: number; max: number }>;
  multiplier: number;
  armLabels: Record<TempoArm, string>;
}

export interface DrumSampleConfig {
  path: string;              // e.g. 'drums/lofi'
  kickVolume?: number;       // dB, default 0
  snareVolume?: number;      // dB, default -4
  hatVolume?: number;        // dB, default -6
  effects?: {
    distortion?: number;     // 0-1
    reverb?: { decay: number; wet: number };
    filterFreq?: number;     // lowpass cutoff Hz
    bitCrush?: number;       // bits (e.g. 8, 12)
  };
}

export interface SynthConfig {
  pianoFilterFreq: number;
  masterFilterFreq: number;
  compressor: { threshold: number; ratio: number; attack: number; release: number };
  noiseDefaults: { type: 'white' | 'pink' | 'brown'; volume: number };
  stereoWidth: number;
  drumSamples?: DrumSampleConfig;
}

export interface ChordConfig {
  voicingSize: number;
  progressionLength: number;
  useExtendedVoicings: boolean;
}

export interface MelodyConfig {
  densityRange: [number, number];
  subdivision: '4n' | '8n' | '16n';
  scaleRange: number;
  noteDuration: string;
}

export interface DrumPattern {
  kick: (string | null)[];
  snare: (string | null)[];
  hat: (string | null)[];
  subdivision: string;
  snareSubdivision?: string;
  hatSubdivision?: string;
}

export interface DrumConfig {
  patterns: Record<'chill' | 'groovy' | 'bouncy', DrumPattern>;
  velocityMultiplier: number;
  kickProbability: number;
  snareProbability: number;
  hatProbability: number;
}

export interface EngineConfig {
  defaultBpm: number;
  sectionLengths: number[];
  instrumentDropout: { kick: number; snare: number; hat: number; melody: number };
  swing: [number, number];
  transitionFilterSweep: { downFreq: number; upFreq: number; duration: number };
}

export interface BanditDefaults {
  createDefaultArmState: () => ArmState;
}

export interface GenreConfig {
  id: GenreId;
  label: string;
  tempo: TempoConfig;
  synth: SynthConfig;
  chords: ChordConfig;
  melody: MelodyConfig;
  drums: DrumConfig;
  engine: EngineConfig;
  banditDefaults: BanditDefaults;
  bpmSliderRange: { min: number; max: number };
}

// --- Lo-fi ---

const LOFI_CONFIG: GenreConfig = {
  id: 'lofi',
  label: 'Lo-fi',
  tempo: {
    ranges: {
      'focus': { min: 60, max: 72 },
      '60-70': { min: 70, max: 78 },
      '70-80': { min: 78, max: 86 },
      '80-90': { min: 86, max: 94 },
      '90-100': { min: 94, max: 102 },
    },
    multiplier: 2,
    armLabels: {
      'focus': 'Focus', '60-70': 'Slow', '70-80': 'Medium',
      '80-90': 'Upbeat', '90-100': 'Fast',
    },
  },
  synth: {
    pianoFilterFreq: 1000,
    masterFilterFreq: 2000,
    compressor: { threshold: -6, ratio: 3, attack: 0.5, release: 0.1 },
    noiseDefaults: { type: 'pink', volume: 0.3 },
    stereoWidth: 0.5,
    drumSamples: { path: 'drums/lofi' },
  },
  chords: {
    voicingSize: 4,
    progressionLength: 8,
    useExtendedVoicings: false,
  },
  melody: {
    densityRange: [0.2, 0.5],
    subdivision: '8n',
    scaleRange: 7,
    noteDuration: '2n',
  },
  drums: {
    patterns: {
      chill: {
        kick: ['C4', null, null, null, null, null, null, 'C4', 'C4', null, '.', null, null, null, null, null],
        snare: [null, 'C4'],
        hat: ['C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4'],
        subdivision: '8n',
        snareSubdivision: '2n',
        hatSubdivision: '4n',
      },
      groovy: {
        kick: ['C4', null, null, null, null, null, null, 'C4', 'C4', null, '.', null, null, null, null, null],
        snare: [null, 'C4'],
        hat: ['C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4'],
        subdivision: '8n',
        snareSubdivision: '2n',
        hatSubdivision: '4n',
      },
      bouncy: {
        kick: ['C4', null, null, null, null, null, null, 'C4', 'C4', null, '.', null, null, null, null, null],
        snare: [null, 'C4'],
        hat: ['C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4'],
        subdivision: '8n',
        snareSubdivision: '2n',
        hatSubdivision: '4n',
      },
    },
    velocityMultiplier: 1.0,
    kickProbability: 0.6,
    snareProbability: 0.8,
    hatProbability: 0.5,
  },
  engine: {
    defaultBpm: 156,
    sectionLengths: [16, 20, 24, 28, 32, 48],
    instrumentDropout: { kick: 0.15, snare: 0.2, hat: 0.25, melody: 0.25 },
    swing: [0.45, 0.65],
    transitionFilterSweep: { downFreq: 300, upFreq: 2000, duration: 2 },
  },
  banditDefaults: {
    createDefaultArmState: () => ({
      tempo: {
        'focus': { alpha: 3, beta: 1 },
        '60-70': { alpha: 2, beta: 1 },
        '70-80': { alpha: 1, beta: 1 },
        '80-90': { alpha: 1, beta: 1.5 },
        '90-100': { alpha: 1, beta: 2 },
      },
      energy: {
        low: { alpha: 2, beta: 1 },
        medium: { alpha: 2, beta: 1 },
        high: { alpha: 1, beta: 1.5 },
      },
      valence: {
        sad: { alpha: 1, beta: 1 },
        neutral: { alpha: 1, beta: 1 },
        happy: { alpha: 1, beta: 1 },
      },
      danceability: {
        chill: { alpha: 2, beta: 1 },
        groovy: { alpha: 1.5, beta: 1 },
        bouncy: { alpha: 1, beta: 1.5 },
      },
      mode: {
        major: { alpha: 1, beta: 1 },
        minor: { alpha: 1, beta: 1 },
      },
    }),
  },
  bpmSliderRange: { min: 60, max: 100 },
};

// --- Registry ---

export const GENRE_CONFIGS: Record<GenreId, GenreConfig> = {
  lofi: LOFI_CONFIG,
};

export const GENRE_IDS: GenreId[] = ['lofi'];

export function getGenreConfig(id: GenreId): GenreConfig {
  return GENRE_CONFIGS[id];
}
