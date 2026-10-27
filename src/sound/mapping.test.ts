import { describe, expect, it } from 'vitest';
import { createRng } from '../sketch/random';
import {
  SOUND,
  crackleGap,
  cutoffForBlue,
  droneLevel,
  frequencyForStep,
  grainChance,
  grainInterval,
  grainShape,
  impulseResponse,
  panForX,
  reverbLevel,
  stepForY,
} from './mapping';

describe('pitch from height', () => {
  it('rises from A2 at the bottom to A5 at the top', () => {
    expect(stepForY(800, 800)).toBe(0);
    expect(stepForY(0, 800)).toBe(15);
    expect(stepForY(400, 800)).toBe(8);
    expect(stepForY(-50, 800)).toBe(15);
    expect(stepForY(100, 0)).toBe(0);

    expect(frequencyForStep(0)).toBeCloseTo(110);
    expect(frequencyForStep(5)).toBeCloseTo(220);
    expect(frequencyForStep(15)).toBeCloseTo(880);
  });

  it('stays in A minor pentatonic, above and below the range too', () => {
    const allowed = new Set(SOUND.scale.map((s) => s % 12));
    for (let step = -7; step <= 25; step++) {
      const semitones = Math.round(12 * Math.log2(frequencyForStep(step) / SOUND.rootHz));
      expect(allowed.has(((semitones % 12) + 12) % 12)).toBe(true);
    }
    expect(frequencyForStep(3)).toBeCloseTo(110 * 2 ** (7 / 12));
    expect(frequencyForStep(-5)).toBeCloseTo(55);
  });
});

describe('tone, space and level', () => {
  it('opens the filter as the colours turn pale', () => {
    expect(cutoffForBlue(0)).toBeCloseTo(SOUND.cutoffHz.warm);
    expect(cutoffForBlue(255)).toBeCloseTo(SOUND.cutoffHz.pale);
    expect(cutoffForBlue(128)).toBeGreaterThan(cutoffForBlue(64));
    expect(cutoffForBlue(999)).toBeCloseTo(SOUND.cutoffHz.pale);
  });

  it('pans with the position on screen', () => {
    expect(panForX(0, 1000)).toBe(-1);
    expect(panForX(500, 1000)).toBe(0);
    expect(panForX(1000, 1000)).toBe(1);
    expect(panForX(3000, 1000)).toBe(1);
    expect(panForX(10, 0)).toBe(0);
  });

  it('is loudest and busiest when painting on black', () => {
    expect(droneLevel(0)).toBe(SOUND.drone.floor);
    expect(droneLevel(1)).toBeCloseTo(SOUND.drone.floor + SOUND.drone.fresh);
    expect(droneLevel(5)).toBe(droneLevel(1));
    expect(grainChance(1)).toBeGreaterThan(grainChance(0) * 5);
    expect(grainChance(-1)).toBe(grainChance(0));
  });

  it('grows the room as the picture fills', () => {
    expect(reverbLevel(0)).toBe(SOUND.reverb.empty);
    expect(reverbLevel(1)).toBeCloseTo(SOUND.reverb.full);
    expect(reverbLevel(0.5)).toBeGreaterThan(reverbLevel(0.2));
  });
});

describe('grains from circles', () => {
  it('rings chord tones for pale circles and passing notes for warm ones', () => {
    const rng = createRng(11);
    const pale = new Set(Array.from({ length: 200 }, () => grainInterval(255, 255, rng)));
    expect([...pale].sort((a, b) => a - b)).toEqual([0, 3, 5]);
    const warm = new Set(Array.from({ length: 400 }, () => grainInterval(200, 255, rng)));
    for (const step of warm) expect([0, 3, 5]).not.toContain(step);
    expect(warm.size).toBeGreaterThan(4);
  });

  it('strikes harder for red and rings longer for green', () => {
    expect(grainShape(255, 10).peak).toBeGreaterThan(grainShape(10, 10).peak);
    expect(grainShape(10, 255).decay).toBeGreaterThan(grainShape(10, 10).decay);
    const loudest = grainShape(255, 255);
    expect(loudest.peak).toBeLessThan(0.15);
    expect(loudest.decay).toBeLessThan(2);
  });
});

describe('dissolve and room', () => {
  it('spaces crackles randomly at the configured rate', () => {
    const rng = createRng(4);
    const gaps = Array.from({ length: 20_000 }, () => crackleGap(rng));
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(mean).toBeCloseTo(1 / SOUND.dissolve.cracklesPerSecond, 2);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0);
  });

  it('makes a stereo reverb tail that fades to silence', () => {
    const [left, right] = impulseResponse(createRng(8), 8000, 2);
    expect(left!.length).toBe(16000);
    expect(right!.length).toBe(16000);
    expect(left).not.toEqual(right);
    const energy = (data: Float32Array, from: number, to: number) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += data[i]! ** 2;
      return sum;
    };
    expect(energy(left!, 0, 1000)).toBeGreaterThan(energy(left!, 8000, 9000) * 10);
    expect(Math.abs(left!.at(-1)!)).toBeLessThan(1e-6);
  });
});
