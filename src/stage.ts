import { SKETCH } from './sketch/config';
import { blurInPlace } from './sketch/blur';
import { createDrift, type Drift, type Point } from './sketch/drift';
import { InkMap } from './sketch/ink';
import {
  blueAt,
  createDissolveState,
  paintRow,
  scatter,
  type CircleSample,
} from './sketch/paint';
import { createRng, randomSeed, type Rng } from './sketch/random';

const STEP_MS = 1000 / SKETCH.stepsPerSecond;
/** After a stall (slow device, background tab), catch up by at most this many steps. */
const MAX_STEPS_PER_FRAME = 4;
/** Beyond 2x the extra pixels cost memory and time without visible gain on soft circles. */
const MAX_DPR = 2;
/** Brush id for the resting pointer; touches use their pointer ids. */
const CURSOR_ID = -1;

/** One row painted during a step. */
export interface BrushFrame {
  id: number;
  x: number;
  y: number;
  blue: number;
  /** How much the picture changed under the row: 1 on black, near 0 over saturated paint. */
  change: number;
  /** One of the circles just drawn. */
  circle: CircleSample;
}

/** What one step of the animation did, for the sound to follow. */
export interface StepFrame {
  brushes: BrushFrame[];
  dissolving: boolean;
  /** How much of the visible picture is painted, 0–1. */
  fullness: number;
  width: number;
  height: number;
}

export interface StageElements {
  art: HTMLCanvasElement;
  /** An element sized `100lvh`, to size against the viewport with mobile browser bars hidden. */
  viewportProbe: HTMLElement;
}

interface Viewport {
  width: number;
  /** What is visible right now. */
  height: number;
  /** The largest height the browser can show, with mobile browser bars hidden. */
  layoutHeight: number;
}

/**
 * Owns the canvas and runs the artwork: one step paints a row at every touch (or at
 * the last pointer position), and dissolves while that is held.
 *
 * The painting surface only ever grows. Rotating a phone or showing the browser bar
 * would otherwise wipe the picture, and nothing in the original ever cleared it.
 */
export class Stage {
  /** Called on every visitor input, so the controls can show themselves. */
  onInput: () => void = () => {};
  /** Called after every animation step with what was painted. */
  onStep: (frame: StepFrame) => void = () => {};

  readonly #art: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #probe: HTMLElement;
  readonly #reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  readonly #rng: Rng;
  readonly #drift: Drift;
  readonly #dissolve = createDissolveState();
  readonly #ink = new InkMap();
  #scratch: HTMLCanvasElement | null = null;

  #dpr = 0;
  /** Painting surface size in CSS px. */
  #size = { width: 0, height: 0 };
  #viewport: Viewport = { width: 0, height: 0, layoutHeight: 0 };

  /** Where a row is painted when no finger is down: like Processing's `mouseX`/`mouseY`, it stays put. */
  #cursor: Point = { x: 0, y: 0 };
  readonly #touches = new Map<number, Point>();
  #lastInput = -Infinity;
  #dissolving = false;

  #lastFrame = 0;
  #pending = 0;

  constructor({ art, viewportProbe }: StageElements, seed = randomSeed()) {
    const ctx = art.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('This browser cannot draw on a canvas.');
    this.#art = art;
    this.#ctx = ctx;
    this.#probe = viewportProbe;
    this.#rng = createRng(seed);
    this.#drift = createDrift(this.#rng);
  }

  start(): void {
    this.resize();
    this.#cursor = {
      x: this.#rng() * this.#viewport.width,
      y: this.#rng() * this.#viewport.height,
    };

    window.addEventListener('resize', () => this.resize());
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) {
      this.#art.addEventListener(type, this.#onPointer);
    }

    this.#lastFrame = performance.now();
    requestAnimationFrame(this.#frame);
  }

  resize(): void {
    const viewport = this.#measure();
    this.#viewport = viewport;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = Math.max(this.#size.width, viewport.width);
    const height = Math.max(this.#size.height, viewport.layoutHeight);
    if (dpr !== this.#dpr || width !== this.#size.width || height !== this.#size.height) {
      this.#resizeSurface(width, height, dpr);
    }
  }

  /** Paint everything black again. */
  clear(): void {
    const ctx = this.#ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.#art.width, this.#art.height);
    ctx.restore();
    this.#ink.clear();
  }

  setDissolving(on: boolean): void {
    this.#dissolving = on;
    if (on) this.#noteInput();
  }

  /** Move the painting point from the keyboard. */
  nudge(dx: number, dy: number): void {
    const { width, height } = this.#viewport;
    this.#cursor = {
      x: Math.min(Math.max(this.#cursor.x + dx, 0), width),
      y: Math.min(Math.max(this.#cursor.y + dy, 0), height),
    };
    this.#noteInput();
  }

  /** The current screen as a PNG. */
  toBlob(): Promise<Blob> {
    const { width, layoutHeight } = this.#viewport;
    const out = document.createElement('canvas');
    out.width = Math.round(width * this.#dpr);
    out.height = Math.round(layoutHeight * this.#dpr);
    const ctx = out.getContext('2d');
    if (!ctx) return Promise.reject(new Error('This browser cannot draw on a canvas.'));
    ctx.drawImage(this.#art, 0, 0);
    return new Promise((resolve, reject) =>
      out.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))),
        'image/png',
      ),
    );
  }

  #frame = (now: number): void => {
    requestAnimationFrame(this.#frame);
    this.#pending += Math.min(Math.max(now - this.#lastFrame, 0), MAX_STEPS_PER_FRAME * STEP_MS);
    this.#lastFrame = now;
    // Step at a fixed 60 Hz so the picture builds up at the same pace on 30, 60 and 120 Hz screens.
    while (this.#pending >= STEP_MS) {
      this.#step(now);
      this.#pending -= STEP_MS;
    }
  };

  #step(now: number): void {
    const { width, height } = this.#viewport;
    if (this.#isIdle(now)) {
      this.#cursor = this.#drift(this.#cursor, STEP_MS / 1000, { width, height });
    }

    const ctx = this.#ctx;
    const rowWidth = this.#size.width;
    const brushes: BrushFrame[] = [];
    const paint = (id: number, { x, y }: Point) => {
      const blue = blueAt(x, width);
      const circle = paintRow(ctx, this.#rng, y, blue, rowWidth);
      brushes.push({ id, x, y, blue, change: this.#ink.paint(y), circle });
    };
    if (this.#touches.size > 0) {
      for (const [id, touch] of this.#touches) paint(id, touch);
    } else {
      paint(CURSOR_ID, this.#cursor);
    }

    if (this.#dissolving) {
      this.#scratch ??= document.createElement('canvas');
      blurInPlace(ctx, this.#scratch, SKETCH.dissolve.blurRadius * this.#dpr);
      scatter(ctx, this.#rng, this.#dissolve);
      this.#ink.dissolve();
    }

    this.onStep({
      brushes,
      dissolving: this.#dissolving,
      fullness: this.#ink.fullness(height),
      width,
      height,
    });
  }

  #isIdle(now: number): boolean {
    return (
      !this.#reducedMotion.matches &&
      this.#touches.size === 0 &&
      now - this.#lastInput > SKETCH.idleAfterMs
    );
  }

  #onPointer = (event: PointerEvent): void => {
    const point = { x: event.clientX, y: event.clientY };
    const id = event.pointerId;

    switch (event.type) {
      case 'pointerdown':
        if (event.pointerType !== 'mouse') {
          this.#art.setPointerCapture(id);
          this.#touches.set(id, point);
        }
        this.#cursor = point;
        break;
      case 'pointermove':
        if (this.#touches.has(id)) {
          this.#touches.set(id, point);
          this.#cursor = point;
        } else if (event.pointerType !== 'touch') {
          // A mouse or pen paints by hovering, like Processing on the desktop.
          this.#cursor = point;
        }
        break;
      default:
        this.#touches.delete(id);
    }
    this.#noteInput();
  };

  #noteInput(): void {
    this.#lastInput = performance.now();
    this.onInput();
  }

  #measure(): Viewport {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const large = Math.round(this.#probe.getBoundingClientRect().height);
    return { width, height, layoutHeight: Math.max(height, large) };
  }

  #resizeSurface(width: number, height: number, dpr: number): void {
    const canvas = this.#art;
    let snapshot: HTMLCanvasElement | null = null;
    if (canvas.width > 0 && this.#size.width > 0) {
      snapshot = document.createElement('canvas');
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext('2d')?.drawImage(canvas, 0, 0);
    }
    const previous = this.#size;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = this.#ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (snapshot) {
      ctx.drawImage(snapshot, 0, 0, Math.round(previous.width * dpr), Math.round(previous.height * dpr));
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.#dpr = dpr;
    this.#size = { width, height };
    this.#ink.resize(height);
  }
}
