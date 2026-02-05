import * as Tone from 'tone';
import {
  SamplePack,
  SampleMetadata,
  SampleCategory,
  LoadedSample,
  EnergyLevel,
  Mood,
} from './types';
import { SAMPLES_BASE_PATH, getSamplesByCategory } from './manifest';

const CROSSFADE_DURATION = 2;
const SECTION_LENGTH_BARS = 16;

const LAYER_CHANGE_PROBABILITY: Record<SampleCategory, number> = {
  loops: 0,
  drums: 0.2,
  chords: 0.15,
  melodies: 0.3,
  bass: 0.2,
  ambient: 0.1,
};

const LAYER_VOLUMES: Record<SampleCategory, number> = {
  loops: 0,
  drums: -3,
  chords: -5,
  melodies: -7,
  bass: -6,
  ambient: -18,
};

const KEY_COMPATIBILITY: Record<string, string[]> = {
  'C': ['C', 'Am'],
  'Am': ['Am', 'C'],
  'Cm': ['Cm'],
  'Fm': ['Fm'],
  'Dm': ['Dm'],
};

interface ActiveLayer {
  sample: SampleMetadata;
  player: Tone.Player;
  gain: Tone.Gain;
}

export class SampleMixer {
  private pack: SamplePack | null = null;
  private loadedSamples: Map<string, LoadedSample> = new Map();
  private activeLayers: Map<SampleCategory, ActiveLayer> = new Map();

  private output: Tone.Gain | null = null;
  private bpm: number = 120;
  private currentKey: string = 'Cm';
  private currentEnergy: EnergyLevel = 'low';
  private currentMood: Mood = 'chill';

  private barCount: number = 0;
  private sectionCount: number = 0;
  private isPlaying: boolean = false;

  private barCallback: number | null = null;

  private ensureOutput(): Tone.Gain {
    if (!this.output) {
      this.output = new Tone.Gain(1);
    }
    return this.output;
  }

  async loadPack(pack: SamplePack): Promise<void> {
    this.pack = pack;
    this.bpm = pack.defaultBpm;

    const stemsToLoad = pack.samples.filter(s => s.category !== 'loops');

    const loadPromises = stemsToLoad.map(async (sample) => {
      const url = `${SAMPLES_BASE_PATH}/${sample.filename}`;

      try {
        const player = new Tone.Player({
          url,
          loop: true,
          fadeIn: 0.05,
          fadeOut: 0.05,
        });

        await Tone.loaded();

        this.loadedSamples.set(sample.id, {
          metadata: sample,
          buffer: player.buffer.get() as AudioBuffer,
          player,
        });
      } catch {
        // Skip failed samples
      }
    });

    await Promise.all(loadPromises);
  }

  getOutput(): Tone.Gain {
    return this.ensureOutput();
  }

  setParameters(params: {
    energy?: EnergyLevel;
    mood?: Mood;
  }): void {
    if (params.energy) this.currentEnergy = params.energy;
    if (params.mood) this.currentMood = params.mood;
  }

  private getCompatibleKeys(key: string): string[] {
    return KEY_COMPATIBILITY[key] || [key];
  }

  private isKeyCompatible(sampleKey: string): boolean {
    if (sampleKey === 'C' && !this.currentKey) return true;

    const compatibleKeys = this.getCompatibleKeys(this.currentKey);
    return compatibleKeys.includes(sampleKey);
  }

  private selectSample(category: SampleCategory, forceKeyMatch: boolean = true): SampleMetadata | null {
    if (!this.pack) return null;

    let candidates = getSamplesByCategory(this.pack, category);
    if (candidates.length === 0) return null;

    candidates = candidates.filter(c => this.loadedSamples.has(c.id));
    if (candidates.length === 0) return null;

    if (forceKeyMatch && (category === 'melodies' || category === 'bass')) {
      const keyMatched = candidates.filter(c => this.isKeyCompatible(c.key));
      if (keyMatched.length > 0) {
        candidates = keyMatched;
      } else {
        return null;
      }
    }

    const current = this.activeLayers.get(category);
    if (current && candidates.length > 1) {
      candidates = candidates.filter(c => c.id !== current.sample.id);
    }

    const scored = candidates.map(sample => {
      let score = 1;
      if (sample.mood === this.currentMood) score += 2;
      if (sample.energy === this.currentEnergy) score += 1;
      return { sample, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topScore = scored[0].score;
    const topCandidates = scored.filter(s => s.score >= topScore - 1);

    const pick = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    return pick.sample;
  }

  private selectChords(): SampleMetadata | null {
    if (!this.pack) return null;

    let candidates = getSamplesByCategory(this.pack, 'chords');
    candidates = candidates.filter(c => this.loadedSamples.has(c.id));
    if (candidates.length === 0) return null;

    const current = this.activeLayers.get('chords');
    if (current && candidates.length > 1) {
      candidates = candidates.filter(c => c.id !== current.sample.id);
    }

    const scored = candidates.map(sample => {
      let score = 1;
      if (sample.mood === this.currentMood) score += 3;
      if (sample.energy === this.currentEnergy) score += 2;
      return { sample, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topScore = scored[0].score;
    const topCandidates = scored.filter(s => s.score >= topScore - 1);

    const pick = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    return pick.sample;
  }

  private activateLayer(category: SampleCategory, sample: SampleMetadata): void {
    const loaded = this.loadedSamples.get(sample.id);
    if (!loaded || !loaded.player) return;

    const existing = this.activeLayers.get(category);
    if (existing) {
      existing.player.stop();
      existing.player.unsync();
      existing.player.disconnect();
      existing.gain.disconnect();
    }

    const sourcePlayer = loaded.player as Tone.Player;

    const player = new Tone.Player({
      url: sourcePlayer.buffer,
      loop: true,
      fadeIn: 0.05,
      fadeOut: 0.05,
    });

    const gain = new Tone.Gain(Tone.dbToGain(LAYER_VOLUMES[category]));

    player.connect(gain);
    gain.connect(this.ensureOutput());

    this.activeLayers.set(category, { sample, player, gain });

    if (this.isPlaying) {
      player.sync().start(0);
    }
  }

  private crossfadeLayer(category: SampleCategory, newSample: SampleMetadata): void {
    const oldLayer = this.activeLayers.get(category);
    const loaded = this.loadedSamples.get(newSample.id);

    if (!loaded || !loaded.player) return;

    const sourcePlayer = loaded.player as Tone.Player;

    const newPlayer = new Tone.Player({
      url: sourcePlayer.buffer,
      loop: true,
      fadeIn: 0.05,
      fadeOut: 0.05,
    });

    const newGain = new Tone.Gain(0);

    newPlayer.connect(newGain);
    newGain.connect(this.ensureOutput());

    newPlayer.sync().start(0);

    const now = Tone.now();
    const targetVolume = Tone.dbToGain(LAYER_VOLUMES[category]);

    newGain.gain.setValueAtTime(0, now);
    newGain.gain.linearRampToValueAtTime(targetVolume, now + CROSSFADE_DURATION);

    if (oldLayer) {
      oldLayer.gain.gain.setValueAtTime(oldLayer.gain.gain.value, now);
      oldLayer.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_DURATION);

      setTimeout(() => {
        oldLayer.player.stop();
        oldLayer.player.unsync();
        oldLayer.player.disconnect();
        oldLayer.gain.disconnect();
      }, CROSSFADE_DURATION * 1000 + 100);
    }

    this.activeLayers.set(category, {
      sample: newSample,
      player: newPlayer,
      gain: newGain,
    });
  }

  private buildCoherentSet(): void {
    const chords = this.selectChords();
    if (!chords) return;

    this.currentKey = chords.key;
    this.activateLayer('chords', chords);

    const drums = this.selectSample('drums', false);
    if (drums) this.activateLayer('drums', drums);

    if (Math.random() < 0.7) {
      const melody = this.selectSample('melodies', true);
      if (melody) this.activateLayer('melodies', melody);
    }

    if (Math.random() < 0.6) {
      const bass = this.selectSample('bass', true);
      if (bass) this.activateLayer('bass', bass);
    }

    if (Math.random() < 0.5) {
      const ambient = this.selectSample('ambient', false);
      if (ambient) this.activateLayer('ambient', ambient);
    }
  }

  async start(): Promise<void> {
    if (!this.pack) {
      throw new Error('No sample pack loaded');
    }

    if (this.isPlaying) return;

    Tone.getTransport().bpm.value = this.bpm;
    this.buildCoherentSet();

    this.barCallback = Tone.getTransport().scheduleRepeat(
      (time) => this.onBar(time),
      '1m',
      0
    );

    for (const [, layer] of this.activeLayers) {
      layer.player.sync().start(0);
    }

    this.isPlaying = true;
  }

  stop(): void {
    if (!this.isPlaying) return;

    for (const [, layer] of this.activeLayers) {
      layer.player.stop();
      layer.player.unsync();
      layer.player.disconnect();
      layer.gain.disconnect();
    }

    this.activeLayers.clear();

    if (this.barCallback !== null) {
      Tone.getTransport().clear(this.barCallback);
      this.barCallback = null;
    }

    this.barCount = 0;
    this.sectionCount = 0;
    this.isPlaying = false;
  }

  private onBar(_time: number): void {
    this.barCount++;

    if (this.barCount >= SECTION_LENGTH_BARS) {
      this.barCount = 0;
      this.sectionCount++;
      this.onSectionChange();
    }
  }

  private onSectionChange(): void {
    if (Math.random() < LAYER_CHANGE_PROBABILITY.chords) {
      const newChords = this.selectChords();
      if (newChords && newChords.id !== this.activeLayers.get('chords')?.sample.id) {
        const oldKey = this.currentKey;
        this.currentKey = newChords.key;
        this.crossfadeLayer('chords', newChords);

        if (oldKey !== this.currentKey) {

          if (this.activeLayers.has('melodies')) {
            const newMelody = this.selectSample('melodies', true);
            if (newMelody) {
              this.crossfadeLayer('melodies', newMelody);
            }
          }

          if (this.activeLayers.has('bass')) {
            const newBass = this.selectSample('bass', true);
            if (newBass) {
              this.crossfadeLayer('bass', newBass);
            }
          }
        }
        return;
      }
    }

    if (Math.random() < LAYER_CHANGE_PROBABILITY.drums) {
      const newDrums = this.selectSample('drums', false);
      if (newDrums && newDrums.id !== this.activeLayers.get('drums')?.sample.id) {
        this.crossfadeLayer('drums', newDrums);
      }
    }

    if (this.activeLayers.has('melodies') && Math.random() < LAYER_CHANGE_PROBABILITY.melodies) {
      const newMelody = this.selectSample('melodies', true);
      if (newMelody && newMelody.id !== this.activeLayers.get('melodies')?.sample.id) {
        this.crossfadeLayer('melodies', newMelody);
      }
    }

    if (Math.random() < 0.15) {
      if (!this.activeLayers.has('melodies')) {
        const melody = this.selectSample('melodies', true);
        if (melody) this.activateLayer('melodies', melody);
      } else if (!this.activeLayers.has('bass')) {
        const bass = this.selectSample('bass', true);
        if (bass) this.activateLayer('bass', bass);
      } else if (!this.activeLayers.has('ambient')) {
        const ambient = this.selectSample('ambient', false);
        if (ambient) this.activateLayer('ambient', ambient);
      }
    }

    if (Math.random() < 0.08 && this.activeLayers.size > 3) {
      const removable: SampleCategory[] = ['melodies', 'bass', 'ambient']
        .filter(c => this.activeLayers.has(c as SampleCategory)) as SampleCategory[];

      if (removable.length > 0) {
        const category = removable[Math.floor(Math.random() * removable.length)];
        const layer = this.activeLayers.get(category);

        if (layer) {
          const now = Tone.now();
          layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
          layer.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_DURATION);

          setTimeout(() => {
            layer.player.stop();
            layer.player.unsync();
            layer.player.disconnect();
            layer.gain.disconnect();
            this.activeLayers.delete(category);
          }, CROSSFADE_DURATION * 1000 + 100);
        }
      }
    }
  }

  async transition(): Promise<void> {
    const newChords = this.selectChords();
    if (newChords) {
      this.currentKey = newChords.key;
      this.crossfadeLayer('chords', newChords);
    }

    const newDrums = this.selectSample('drums', false);
    if (newDrums) this.crossfadeLayer('drums', newDrums);

    if (this.activeLayers.has('melodies')) {
      const newMelody = this.selectSample('melodies', true);
      if (newMelody) this.crossfadeLayer('melodies', newMelody);
    }

    if (this.activeLayers.has('bass')) {
      const newBass = this.selectSample('bass', true);
      if (newBass) this.crossfadeLayer('bass', newBass);
    }
  }

  getState(): {
    isPlaying: boolean;
    bpm: number;
    key: string;
    activeLayers: string[];
    sectionCount: number;
  } {
    return {
      isPlaying: this.isPlaying,
      bpm: this.bpm,
      key: this.currentKey,
      activeLayers: Array.from(this.activeLayers.entries()).map(
        ([category, layer]) => `${category}: ${layer.sample.id}`
      ),
      sectionCount: this.sectionCount,
    };
  }

  dispose(): void {
    this.stop();

    for (const [, loaded] of this.loadedSamples) {
      if (loaded.player && typeof (loaded.player as Tone.Player).dispose === 'function') {
        (loaded.player as Tone.Player).dispose();
      }
    }

    this.loadedSamples.clear();
    this.output?.dispose();
    this.output = null;
  }
}

export const sampleMixer = new SampleMixer();
