/** Offsets for the fallback blur: four shifted copies approximate a small box blur. */
const FALLBACK_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Processing's `filter(BLUR)`: blurs everything painted so far. `scratch` holds a
 * copy of the canvas so it can be drawn back through the blur. Browsers without
 * `ctx.filter` (Safari before 18) get a close approximation.
 */
export function blurInPlace(
  ctx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  radius: number,
): void {
  const { canvas } = ctx;
  if (scratch.width !== canvas.width || scratch.height !== canvas.height) {
    scratch.width = canvas.width;
    scratch.height = canvas.height;
  }
  const copy = scratch.getContext('2d');
  if (!copy) return;
  copy.globalCompositeOperation = 'copy';
  copy.drawImage(canvas, 0, 0);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (typeof ctx.filter === 'string') {
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(scratch, 0, 0);
  } else {
    ctx.globalAlpha = 0.2;
    for (const [dx, dy] of FALLBACK_OFFSETS) ctx.drawImage(scratch, dx * radius, dy * radius);
  }
  ctx.restore();
}
