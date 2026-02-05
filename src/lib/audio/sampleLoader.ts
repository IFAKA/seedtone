const PIANO_NOTES = [
  'a1', 'c1', 'eb1', 'gb1',
  'a2', 'c2', 'eb2', 'gb2',
  'a3', 'c3', 'eb3', 'gb3',
  'a4', 'c4', 'eb4', 'gb4',
  'a5', 'c5', 'eb5', 'gb5',
  'a6', 'c6', 'eb6', 'gb6',
] as const;

const VELOCITY_LAYERS = ['soft', 'hard'] as const;

const DRUM_TYPES = ['kick', 'snare', 'hihat'] as const;

export type VelocityLayer = (typeof VELOCITY_LAYERS)[number];
export type PianoNote = (typeof PIANO_NOTES)[number];
export type DrumType = (typeof DRUM_TYPES)[number];

export interface SampleLoadProgress {
  loaded: number;
  total: number;
  percentage: number;
  currentFile: string;
  phase: 'piano' | 'drums' | 'complete';
}

export type ProgressCallback = (progress: SampleLoadProgress) => void;

export function getPianoSamplerUrls(layer: VelocityLayer): Record<string, string> {
  const urls: Record<string, string> = {};

  for (const note of PIANO_NOTES) {
    const key = note.charAt(0).toUpperCase() + note.slice(1);
    urls[key] = `/samples/piano/${layer}/${note}.mp3`;
  }

  return urls;
}

export function getDrumSamplerUrls(): Record<string, string> {
  return {
    kick: '/samples/drums/kick.mp3',
    snare: '/samples/drums/snare.mp3',
    hihat: '/samples/drums/hihat.mp3',
  };
}
