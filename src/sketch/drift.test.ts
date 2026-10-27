import { describe, expect, it } from 'vitest';
import { SKETCH } from './config';
import { createDrift, type Point } from './drift';
import { createRng } from './random';

const DT = 1 / 60;

describe('createDrift', () => {
  it('stays on screen for an hour of wandering', () => {
    for (const bounds of [
      { width: 390, height: 844 },
      { width: 1920, height: 1080 },
      { width: 40, height: 30 },
    ]) {
      const drift = createDrift(createRng(bounds.width));
      let p: Point = { x: bounds.width / 2, y: bounds.height / 2 };
      let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
      for (let i = 0; i < 60 * 60 * 60; i++) {
        p = drift(p, DT, bounds);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      expect(minX).toBeGreaterThanOrEqual(0);
      expect(maxX).toBeLessThanOrEqual(bounds.width);
      expect(minY).toBeGreaterThanOrEqual(0);
      expect(maxY).toBeLessThanOrEqual(bounds.height);
    }
  });

  it('moves smoothly, never faster than its top speed', () => {
    const drift = createDrift(createRng(42));
    const bounds = { width: 1200, height: 800 };
    let p: Point = { x: 600, y: 400 };
    let travelled = 0;
    for (let i = 0; i < 60 * 120; i++) {
      const next = drift(p, DT, bounds);
      expect(Math.abs(next.x - p.x)).toBeLessThanOrEqual(SKETCH.driftSpeed.x * DT + 1e-9);
      expect(Math.abs(next.y - p.y)).toBeLessThanOrEqual(SKETCH.driftSpeed.y * DT + 1e-9);
      travelled += Math.hypot(next.x - p.x, next.y - p.y);
      p = next;
    }
    // It actually goes somewhere: well over a screen's height in two minutes.
    expect(travelled).toBeGreaterThan(800);
  });

  it('continues from wherever the visitor left the brush', () => {
    const drift = createDrift(createRng(9));
    const from = { x: 123, y: 456 };
    const next = drift(from, DT, { width: 1000, height: 1000 });
    expect(Math.hypot(next.x - from.x, next.y - from.y)).toBeLessThan(2);
  });

  it('copes with a screen that has no size yet', () => {
    const drift = createDrift(createRng(1));
    expect(drift({ x: 5, y: 5 }, DT, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('is repeatable for a given seed', () => {
    const run = () => {
      const drift = createDrift(createRng(2015));
      let p: Point = { x: 10, y: 10 };
      for (let i = 0; i < 600; i++) p = drift(p, DT, { width: 500, height: 500 });
      return p;
    };
    expect(run()).toEqual(run());
  });
});
