import { SKETCH } from './config';

/** Height of one strip, in CSS px. */
const STRIP = 4;
const ALPHA = SKETCH.alpha / 255;
const RADIUS = SKETCH.diameter / 2;
/** On a row's centre line every point sits under this many circles (30px wide, 10px apart). */
const OVERLAP = SKETCH.diameter / SKETCH.spacing;
/** Share of the paint left after one dissolve step (blur plus black squares). */
const DISSOLVE_KEEP = 0.985;

/**
 * How much paint each horizontal strip of the picture holds, from 0 (black) to 1
 * (fully painted). Every row of circles spans the full width, so one number per
 * strip follows the picture closely. This lets the sound react to the image
 * without reading pixels back from the GPU.
 */
export class InkMap {
  #strips = new Float32Array(0);

  constructor(height = 0) {
    this.resize(height);
  }

  /** Grows with the painting surface; existing paint is kept. */
  resize(height: number): void {
    const count = Math.ceil(height / STRIP);
    if (count <= this.#strips.length) return;
    const strips = new Float32Array(count);
    strips.set(this.#strips);
    this.#strips = strips;
  }

  /**
   * Records one row of circles at `y`. Returns how much the picture changed, from
   * 0 (painting over paint that is already saturated) to 1 (painting on black).
   */
  paint(y: number): number {
    let added = 0;
    let possible = 0;
    const first = Math.max(0, Math.floor((y - RADIUS) / STRIP));
    const last = Math.min(this.#strips.length - 1, Math.floor((y + RADIUS) / STRIP));
    for (let i = first; i <= last; i++) {
      const offset = Math.abs((i + 0.5) * STRIP - y);
      if (offset >= RADIUS) continue;
      const cover = 1 - (1 - ALPHA) ** (OVERLAP * Math.sqrt(1 - (offset / RADIUS) ** 2));
      const before = this.#strips[i]!;
      const after = 1 - (1 - before) * (1 - cover);
      this.#strips[i] = after;
      added += after - before;
      possible += cover;
    }
    return possible > 0 ? added / possible : 0;
  }

  dissolve(): void {
    for (let i = 0; i < this.#strips.length; i++) this.#strips[i]! *= DISSOLVE_KEEP;
  }

  clear(): void {
    this.#strips.fill(0);
  }

  /** Paint held at height `y`. */
  at(y: number): number {
    return this.#strips[Math.floor(y / STRIP)] ?? 0;
  }

  /** Average paint over the top `height` px: how full the visible picture is. */
  fullness(height: number): number {
    const count = Math.min(this.#strips.length, Math.ceil(height / STRIP));
    if (count === 0) return 0;
    let sum = 0;
    for (let i = 0; i < count; i++) sum += this.#strips[i]!;
    return sum / count;
  }
}
