import { getModelUrl } from './modelLoader';

interface INoteSequence {
  quantizationInfo?: { stepsPerQuarter: number };
  notes?: Array<{
    pitch?: number;
    quantizedStartStep?: number;
    quantizedEndStep?: number;
    velocity?: number;
  }>;
  totalQuantizedSteps?: number;
}

interface MusicRNN {
  initialize(): Promise<void>;
  continueSequence(
    seed: INoteSequence,
    length: number,
    temperature: number,
    chordProgression?: string[]
  ): Promise<INoteSequence>;
  dispose(): void;
}

let model: MusicRNN | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

export async function initMelodyRNN(): Promise<void> {
  if (model) return;
  if (loadPromise) return loadPromise;

  isLoading = true;

  loadPromise = (async () => {
    try {
      const { MusicRNN } = await import('@magenta/music/esm/music_rnn');

      const modelUrl = getModelUrl('improv_rnn');
      model = new MusicRNN(modelUrl) as unknown as MusicRNN;
      await model.initialize();
    } catch (error) {
      throw error;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

export function isModelReady(): boolean {
  return model !== null && !isLoading;
}

export async function generateMelody(options: {
  chordProgression: string[];
  stepsPerQuarter?: number;
  temperature?: number;
  length?: number;
}): Promise<INoteSequence> {
  if (!model) {
    await initMelodyRNN();
  }

  if (!model) {
    throw new Error('ML model failed to initialize');
  }

  const {
    chordProgression,
    stepsPerQuarter = 4,
    temperature = 1.0,
    length = 64,
  } = options;

  const seed: INoteSequence = {
    quantizationInfo: { stepsPerQuarter },
    notes: [
      {
        pitch: 60,
        quantizedStartStep: 0,
        quantizedEndStep: 1,
      },
    ],
    totalQuantizedSteps: 1,
  };

  const result = await model.continueSequence(
    seed,
    length,
    temperature,
    chordProgression
  );

  return result;
}

export interface ToneNote {
  note: string;
  time: string;
  duration: string;
  velocity: number;
}

const MIDI_TO_NOTE: Record<number, string> = {};
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

for (let midi = 0; midi < 128; midi++) {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  MIDI_TO_NOTE[midi] = `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function convertToToneNotes(
  sequence: INoteSequence,
  bpm: number
): ToneNote[] {
  if (!sequence.notes || sequence.notes.length === 0) {
    throw new Error('Sequence has no notes');
  }

  if (!sequence.quantizationInfo?.stepsPerQuarter) {
    throw new Error('Sequence missing quantization info');
  }

  const stepsPerQuarter = sequence.quantizationInfo.stepsPerQuarter;
  const secondsPerStep = 60 / bpm / stepsPerQuarter;

  return sequence.notes.map((note, index) => {
    if (note.quantizedStartStep === undefined) {
      throw new Error(`Note ${index} missing quantizedStartStep`);
    }
    if (note.quantizedEndStep === undefined) {
      throw new Error(`Note ${index} missing quantizedEndStep`);
    }
    if (note.pitch === undefined) {
      throw new Error(`Note ${index} missing pitch`);
    }

    const startStep = note.quantizedStartStep;
    const endStep = note.quantizedEndStep;
    const pitch = note.pitch;

    const durationSeconds = (endStep - startStep) * secondsPerStep;

    const bars = Math.floor(startStep / (stepsPerQuarter * 4));
    const beats = Math.floor((startStep % (stepsPerQuarter * 4)) / stepsPerQuarter);
    const sixteenths = startStep % stepsPerQuarter;

    const noteName = MIDI_TO_NOTE[pitch];
    if (!noteName) {
      throw new Error(`Invalid MIDI pitch: ${pitch}`);
    }

    return {
      note: noteName,
      time: `${bars}:${beats}:${sixteenths}`,
      duration: `${durationSeconds}s`,
      velocity: note.velocity !== undefined ? note.velocity / 127 : 0.7,
    };
  });
}

export function disposeMelodyRNN(): void {
  if (model) {
    model.dispose();
    model = null;
    loadPromise = null;
  }
}
