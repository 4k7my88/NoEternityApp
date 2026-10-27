import { SKETCH } from './config';
import type { Rng } from './random';

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  width: number;
  height: number;
}

/** Moves a point by `dt` seconds inside `bounds`. */
export type Drift = (from: Point, dt: number, bounds: Bounds) => Point;

const TAU = Math.PI * 2;

/**
 * The screen-saver hand. Its velocity is a blend of slow sines with random phases,
 * so it lingers, speeds up and turns back without ever repeating, and it bounces
 * off the screen edges. Starting from any point keeps the motion continuous when
 * it takes over from the visitor.
 */
export function createDrift(rng: Rng): Drift {
  const phase = [rng(), rng(), rng(), rng()].map((p) => p * TAU) as [number, number, number, number];
  let time = rng() * 1000;
  let dirX = rng() < 0.5 ? -1 : 1;
  let dirY = rng() < 0.5 ? -1 : 1;

  return (from, dt, bounds) => {
    time += dt;
    const vx =
      SKETCH.driftSpeed.x * (0.6 * Math.sin(time * 0.21 + phase[0]) + 0.4 * Math.sin(time * 0.077 + phase[1]));
    const vy =
      SKETCH.driftSpeed.y * (0.7 * Math.sin(time * 0.13 + phase[2]) + 0.3 * Math.sin(time * 0.051 + phase[3]));

    const x = bounce(from.x + vx * dirX * dt, bounds.width);
    const y = bounce(from.y + vy * dirY * dt, bounds.height);
    if (x.flipped) dirX = -dirX;
    if (y.flipped) dirY = -dirY;
    return { x: x.value, y: y.value };
  };
}

function bounce(value: number, max: number): { value: number; flipped: boolean } {
  if (max <= 0) return { value: 0, flipped: false };
  if (value < 0) return { value: Math.min(-value, max), flipped: true };
  if (value > max) return { value: Math.max(2 * max - value, 0), flipped: true };
  return { value, flipped: false };
}
