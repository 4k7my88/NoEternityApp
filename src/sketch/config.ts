/**
 * Every tunable of the artwork lives here. The defaults mirror the original
 * Processing sketch in `archive/noEternity/noEternity.pde` and `CLASS.pde`;
 * the comment on each value says where it comes from.
 *
 * Distances are CSS pixels, so the piece looks the same on every screen density.
 */
export const SKETCH = {
  title: 'no Eternity',

  /** `for (int i = 0; i < 10000; i += 10)`: gap between circle centres in a row. */
  spacing: 10,
  /** `ellipse(i, mouseY, 30, 30)`: circle diameter. */
  diameter: 30,
  /** `fill(r, g, b, 40)`: opacity out of 255. Never clearing the canvas makes it build up. */
  alpha: 40,
  /** `random(10, 555)` for red and green. Anything over 255 clamps, so a channel is maxed ~55% of the time. */
  channelMin: 10,
  channelMax: 555,
  /**
   * Blue was `mouseX` in raw device pixels, so it maxed out about a quarter to a third of
   * the way across a 2015 phone. This keeps that feel on any width: blue reaches 255 at
   * this fraction of the screen width.
   */
  blueFullAt: 0.3,

  /** `text("no Eternity", displayWidth/7, displayHeight/3)`: the baseline position. */
  titleX: 1 / 7,
  titleY: 1 / 3,
  /** The 2015 promo art used the 90–100px font at ~1024px wide; scale it with the screen. */
  titleSizeOfWidth: 0.09,
  titleSizeOfHeight: 0.2,
  titleMinSize: 24,
  titleFont: '"Times New Roman", Times, "Liberation Serif", "Noto Serif", serif',

  /** Processing's default frame rate. The simulation runs at this rate on any display. */
  stepsPerSecond: 60,

  /** CLASS.display(): `a = 10`, `angle = 0.1`, loops over i and j, `rect(random(500), i, 5, 5)`. */
  dissolve: {
    startAngle: 10,
    angleStep: 0.1,
    outerFrom: 5,
    outerTo: 270,
    outerStep: 2,
    innerFrom: 100,
    innerTo: 270,
    innerStep: 2,
    offset: 100,
    spread: 500,
    size: 5,
    /** `filter(BLUR)`: Processing's default blur radius is 1px. */
    blurRadius: 1,
  },

  /** Screen saver: with no input for this long, an invisible hand keeps painting. */
  idleAfterMs: 6000,
  /** Drift speed of that hand, in CSS px per second. */
  driftSpeed: { x: 55, y: 38 },
} as const;
