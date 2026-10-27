import { random, type Rng } from '../sketch/random';

/**
 * Every tunable of the sound. Each value says which part of the picture it follows.
 */
export const SOUND = {
  /** A minor pentatonic, as semitones above the root: any notes sounding together stay consonant. */
  scale: [0, 3, 5, 7, 10],
  /** The bottom of the screen is A2… */
  rootHz: 110,
  /** …and pitch rises with height over this many octaves, to A5 at the top. */
  octaves: 3,
  /** Blue sets the tone: 0 (warm yellows and reds) is dark, 255 (pale pastels) is bright. */
  cutoffHz: { warm: 280, pale: 4200 },
  masterGain: 1,
  /** The drone under each brush: always faintly there, louder while it lays down new paint. */
  drone: { floor: 0.07, fresh: 0.16 },
  /** Bell-like grains, one per sampled circle: occasional over old paint, frequent over black. */
  grains: { chance: 0.012, freshChance: 0.11, maxPlaying: 24 },
  /** More paint on screen, more reverb. */
  reverb: { seconds: 3.6, empty: 0.12, full: 0.55 },
  /** Dissolving muffles and smears the sound; the black squares crackle. */
  dissolve: { cutoffHz: 800, cracklesPerSecond: 28 },
} as const;

const NOTES_PER_OCTAVE = SOUND.scale.length;

/** Scale step for a height on screen: 0 at the bottom, `octaves × 5` at the top. */
export function stepForY(y: number, height: number): number {
  if (height <= 0) return 0;
  const rise = 1 - Math.min(Math.max(y / height, 0), 1);
  return Math.round(rise * SOUND.octaves * NOTES_PER_OCTAVE);
}

/** Frequency of a scale step; steps below 0 or above the range keep going in the same scale. */
export function frequencyForStep(step: number): number {
  const octave = Math.floor(step / NOTES_PER_OCTAVE);
  const degree = step - octave * NOTES_PER_OCTAVE;
  return SOUND.rootHz * 2 ** (octave + SOUND.scale[degree]! / 12);
}

/** Low-pass cutoff for a blue value, spaced evenly in pitch. */
export function cutoffForBlue(blue: number): number {
  const t = Math.min(Math.max(blue / 255, 0), 1);
  return SOUND.cutoffHz.warm * (SOUND.cutoffHz.pale / SOUND.cutoffHz.warm) ** t;
}

/** Stereo position for a place on screen: left edge −1, right edge +1. */
export function panForX(x: number, width: number): number {
  if (width <= 0) return 0;
  return Math.min(Math.max((x / width) * 2 - 1, -1), 1);
}

/** Drone loudness for how much the picture just changed under the brush (0–1). */
export function droneLevel(change: number): number {
  return SOUND.drone.floor + SOUND.drone.fresh * Math.min(Math.max(change, 0), 1);
}

/** Chance, per step, that a painted circle rings out. */
export function grainChance(change: number): number {
  return SOUND.grains.chance + SOUND.grains.freshChance * Math.min(Math.max(change, 0), 1);
}

/** Pale circles (red and green both maxed) ring chord tones: root, fifth, octave. */
const CHORD_STEPS = [0, 3, 5] as const;
/** Warmer circles wander to the notes in between. */
const PASSING_STEPS = [-2, -1, 1, 2, 4, 6, 7] as const;

/**
 * Scale steps above the drone for a circle of this colour. About 30% of circles
 * are pale, since each channel is maxed about 55% of the time.
 */
export function grainInterval(red: number, green: number, rng: Rng): number {
  const choices = red === 255 && green === 255 ? CHORD_STEPS : PASSING_STEPS;
  return choices[Math.floor(rng() * choices.length)]!;
}

/** Grain envelope: redder circles strike harder, greener ones ring longer. */
export function grainShape(red: number, green: number): { peak: number; decay: number } {
  return { peak: 0.06 + 0.08 * (red / 255), decay: 0.35 + 1.25 * (green / 255) };
}

/** Wait before the next crackle while dissolving, in seconds. */
export function crackleGap(rng: Rng): number {
  return -Math.log(1 - rng()) / SOUND.dissolve.cracklesPerSecond;
}

/** Reverb send for how full the picture is (0–1). */
export function reverbLevel(fullness: number): number {
  const t = Math.min(Math.max(fullness, 0), 1);
  return SOUND.reverb.empty + (SOUND.reverb.full - SOUND.reverb.empty) * t;
}

/** Stereo noise with an exponential tail: a reverb impulse response made on the spot. */
export function impulseResponse(rng: Rng, sampleRate: number, seconds: number): Float32Array[] {
  const length = Math.round(sampleRate * seconds);
  return [0, 1].map(() => {
    const channel = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      channel[i] = random(rng, -1, 1) * (1 - i / length) ** 3.2;
    }
    return channel;
  });
}
