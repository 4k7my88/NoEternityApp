/** A source of uniform numbers in [0, 1), like `Math.random`. */
export type Rng = () => number;

/** Small seeded PRNG (mulberry32): fast, and deterministic for tests. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed that differs on every visit, so no two sessions paint alike. */
export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0]!;
}

/** Processing's `random(low, high)`. */
export function random(rng: Rng, low: number, high: number): number {
  return low + rng() * (high - low);
}
