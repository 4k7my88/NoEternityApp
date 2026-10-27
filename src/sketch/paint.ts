import { SKETCH } from './config';
import { random, type Rng } from './random';

/** The slice of the 2D canvas API the painting code uses, so tests can pass a recorder. */
export type PaintContext = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'beginPath' | 'arc' | 'fill' | 'rect' | 'save' | 'restore' | 'translate' | 'rotate'
>;
export type TextContext = Pick<
  CanvasRenderingContext2D,
  'font' | 'textBaseline' | 'fillStyle' | 'fillText' | 'save' | 'restore'
>;

const TAU = Math.PI * 2;
const ALPHA = +(SKETCH.alpha / 255).toFixed(4);

/** Processing clamps colour components to 0–255 and truncates them to integers. */
export function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.floor(value)));
}

/** Red or green: `random(10, 555)`, clamped. */
export function warmChannel(rng: Rng): number {
  return clampChannel(random(rng, SKETCH.channelMin, SKETCH.channelMax));
}

/** Blue follows the pointer's horizontal position; see `SKETCH.blueFullAt`. */
export function blueAt(x: number, width: number): number {
  if (width <= 0) return 0;
  return clampChannel((x / (width * SKETCH.blueFullAt)) * 255);
}

/**
 * The original `one()`: a row of translucent circles across the screen at `y`,
 * each with its own random red and green.
 */
export function paintRow(
  ctx: PaintContext,
  rng: Rng,
  y: number,
  blue: number,
  rowWidth: number,
): void {
  const radius = SKETCH.diameter / 2;
  for (let x = 0; x - radius < rowWidth; x += SKETCH.spacing) {
    const red = warmChannel(rng);
    const green = warmChannel(rng);
    ctx.fillStyle = `rgba(${red},${green},${blue},${ALPHA})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }
}

export interface DissolveState {
  angle: number;
}

export function createDissolveState(): DissolveState {
  return { angle: SKETCH.dissolve.startAngle };
}

/**
 * The black squares from `CLASS.display()`. The transforms pile up on purpose, as in
 * the original: each line of squares is turned and pushed further along, so the
 * pattern snakes across the screen and changes every frame. The blur that came
 * before it is `blurInPlace`.
 */
export function scatter(ctx: PaintContext, rng: Rng, state: DissolveState): void {
  const d = SKETCH.dissolve;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  for (let i = d.outerFrom; i < d.outerTo; i += d.outerStep) {
    ctx.translate(i, d.offset);
    ctx.rotate(Math.sin(state.angle));
    state.angle += d.angleStep;
    for (let j = d.innerFrom; j < d.innerTo; j += d.innerStep) {
      ctx.rect(random(rng, 0, d.spread), i, d.size, d.size);
    }
  }
  ctx.fill();
  ctx.restore();
}

export interface TitleLayout {
  x: number;
  y: number;
  size: number;
  font: string;
}

export function titleLayout(width: number, height: number): TitleLayout {
  const size = Math.max(
    SKETCH.titleMinSize,
    Math.round(Math.min(width * SKETCH.titleSizeOfWidth, height * SKETCH.titleSizeOfHeight)),
  );
  return {
    x: width * SKETCH.titleX,
    y: height * SKETCH.titleY,
    size,
    font: `${size}px ${SKETCH.titleFont}`,
  };
}

/** `text("no Eternity", x, y)` in black, with `y` as the baseline like Processing. */
export function drawTitle(ctx: TextContext, layout: TitleLayout): void {
  ctx.save();
  ctx.font = layout.font;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.fillText(SKETCH.title, layout.x, layout.y);
  ctx.restore();
}
