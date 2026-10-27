import { describe, expect, it } from 'vitest';
import { createRng, random, randomSeed } from './random';

describe('random', () => {
  it('repeats exactly for the same seed and differs between seeds', () => {
    const a = createRng(123);
    const b = createRng(123);
    const c = createRng(124);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(seqA);
  });

  it('stays in [0, 1) and spreads evenly', () => {
    const rng = createRng(99);
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 50_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 10)]!++;
    }
    for (const n of buckets) expect(n).toBeGreaterThan(4500);
  });

  it('maps to a range like Processing random(low, high)', () => {
    const rng = createRng(5);
    for (let i = 0; i < 1000; i++) {
      const v = random(rng, 10, 555);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(555);
    }
  });

  it('seeds each visit differently', () => {
    expect(randomSeed()).not.toBe(randomSeed());
  });
});
