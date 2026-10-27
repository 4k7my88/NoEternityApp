import { describe, expect, it } from 'vitest';
import { SKETCH } from './config';
import {
  blueAt,
  clampChannel,
  createDissolveState,
  drawTitle,
  paintRow,
  scatter,
  titleLayout,
  warmChannel,
  type PaintContext,
  type TextContext,
} from './paint';
import { createRng } from './random';

type Call = [method: string, ...args: unknown[]];

/** Records what the painting code asks of a canvas. */
function recorder(): PaintContext & TextContext & { calls: Call[]; fills: string[] } {
  const calls: Call[] = [];
  const fills: string[] = [];
  const log =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push([method, ...args]);
    };
  let fillStyle: string | CanvasGradient | CanvasPattern = '#000';
  return {
    calls,
    fills,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value) {
      fillStyle = value;
      fills.push(String(value));
    },
    font: '',
    textBaseline: 'alphabetic',
    beginPath: log('beginPath'),
    arc: log('arc'),
    fill: log('fill'),
    rect: log('rect'),
    save: log('save'),
    restore: log('restore'),
    translate: log('translate'),
    rotate: log('rotate'),
    fillText: log('fillText'),
  };
}

const count = (calls: Call[], method: string) => calls.filter(([m]) => m === method).length;

describe('colour', () => {
  it('clamps and truncates like Processing', () => {
    expect(clampChannel(-3)).toBe(0);
    expect(clampChannel(127.9)).toBe(127);
    expect(clampChannel(555)).toBe(255);
  });

  it('draws red and green from random(10, 555), so they max out over half the time', () => {
    const rng = createRng(1);
    const samples = Array.from({ length: 20_000 }, () => warmChannel(rng));
    const maxed = samples.filter((v) => v === 255).length / samples.length;
    // (555 - 255) / (555 - 10) ≈ 0.55
    expect(maxed).toBeGreaterThan(0.53);
    expect(maxed).toBeLessThan(0.57);
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(SKETCH.channelMin);
  });

  it('turns blue up with the pointer and saturates part-way across', () => {
    expect(blueAt(0, 1000)).toBe(0);
    expect(blueAt(150, 1000)).toBe(127);
    expect(blueAt(300, 1000)).toBe(255);
    expect(blueAt(900, 1000)).toBe(255);
    expect(blueAt(50, 0)).toBe(0);
  });
});

describe('paintRow (the original one())', () => {
  it('lays circles 10px apart across the full width, at the pointer height', () => {
    const ctx = recorder();
    paintRow(ctx, createRng(7), 240, 200, 100);

    const arcs = ctx.calls.filter(([m]) => m === 'arc');
    // Centres 0, 10, … 110: the last one still overlaps the right edge (110 - 15 < 100).
    expect(arcs.map(([, x]) => x)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110]);
    for (const [, , y, radius] of arcs) {
      expect(y).toBe(240);
      expect(radius).toBe(SKETCH.diameter / 2);
    }
    expect(count(ctx.calls, 'fill')).toBe(arcs.length);
  });

  it('gives each circle its own random red and green with the shared blue and alpha 40', () => {
    const ctx = recorder();
    paintRow(ctx, createRng(3), 10, 77, 300);

    const parsed = ctx.fills.map((f) => f.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/));
    expect(parsed.every(Boolean)).toBe(true);
    for (const match of parsed) {
      expect(Number(match![3])).toBe(77);
      expect(Number(match![4])).toBeCloseTo(40 / 255, 3);
    }
    expect(new Set(ctx.fills).size).toBeGreaterThan(ctx.fills.length / 2);
  });
});

describe('scatter (the original CLASS.display())', () => {
  it('runs the same loops: 133 turned lines of 85 black squares, filled once', () => {
    const ctx = recorder();
    const state = createDissolveState();
    scatter(ctx, createRng(5), state);

    expect(count(ctx.calls, 'translate')).toBe(133);
    expect(count(ctx.calls, 'rotate')).toBe(133);
    expect(count(ctx.calls, 'rect')).toBe(133 * 85);
    expect(count(ctx.calls, 'fill')).toBe(1);
    expect(ctx.fills).toEqual(['#000']);
    expect(ctx.calls[0]![0]).toBe('save');
    expect(ctx.calls.at(-1)![0]).toBe('restore');

    const first = ctx.calls.find(([m]) => m === 'rotate')!;
    expect(first[1]).toBeCloseTo(Math.sin(10));
    for (const [method, x, y, w, h] of ctx.calls) {
      if (method !== 'rect') continue;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(500);
      expect([y, w, h].every((v) => typeof v === 'number')).toBe(true);
    }
  });

  it('keeps turning from where it left off, frame after frame', () => {
    const state = createDissolveState();
    scatter(recorder(), createRng(1), state);
    expect(state.angle).toBeCloseTo(10 + 133 * 0.1);
    scatter(recorder(), createRng(1), state);
    expect(state.angle).toBeCloseTo(10 + 266 * 0.1);
  });
});

describe('title', () => {
  it('puts the baseline at (width/7, height/3) like the original', () => {
    const layout = titleLayout(1400, 900);
    expect(layout.x).toBeCloseTo(200);
    expect(layout.y).toBeCloseTo(300);
  });

  it('matches the 2015 promo proportions and never gets unreadably small', () => {
    expect(titleLayout(1024, 500).size).toBe(92);
    expect(titleLayout(2560, 600).size).toBe(120);
    expect(titleLayout(200, 300).size).toBe(SKETCH.titleMinSize);
  });

  it('draws "no Eternity" in black on the baseline', () => {
    const ctx = recorder();
    const layout = titleLayout(700, 700);
    drawTitle(ctx, layout);
    expect(ctx.font).toBe(layout.font);
    expect(ctx.fills).toEqual(['#000']);
    expect(ctx.calls).toContainEqual(['fillText', 'no Eternity', layout.x, layout.y]);
  });
});
