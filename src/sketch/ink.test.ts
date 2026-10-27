import { describe, expect, it } from 'vitest';
import { InkMap } from './ink';

describe('InkMap', () => {
  it('reports a full change when painting on black, then less as paint builds up', () => {
    const ink = new InkMap(400);
    const changes = Array.from({ length: 30 }, () => ink.paint(200));
    expect(changes[0]).toBeCloseTo(1);
    for (let i = 1; i < changes.length; i++) expect(changes[i]).toBeLessThan(changes[i - 1]!);
    // A brush held still saturates its band within a fraction of a second, as on screen.
    expect(changes[10]).toBeLessThan(0.05);
    expect(ink.at(200)).toBeGreaterThan(0.99);
    expect(ink.at(200)).toBeLessThanOrEqual(1);
  });

  it('only paints within the circles’ reach of the row', () => {
    const ink = new InkMap(400);
    ink.paint(200);
    expect(ink.at(200)).toBeGreaterThan(0.3);
    expect(ink.at(190)).toBeGreaterThan(0);
    expect(ink.at(190)).toBeLessThan(ink.at(200));
    expect(ink.at(150)).toBe(0);
    expect(ink.at(250)).toBe(0);
  });

  it('sees black again after dissolving or clearing', () => {
    const ink = new InkMap(400);
    for (let i = 0; i < 20; i++) ink.paint(100);
    expect(ink.paint(100)).toBeLessThan(0.01);

    for (let i = 0; i < 60; i++) ink.dissolve();
    expect(ink.paint(100)).toBeGreaterThan(0.3);

    ink.clear();
    expect(ink.paint(100)).toBeCloseTo(1);
  });

  it('measures how full the visible picture is', () => {
    const ink = new InkMap(400);
    expect(ink.fullness(400)).toBe(0);
    for (let y = 0; y <= 400; y += 8) for (let i = 0; i < 20; i++) ink.paint(y);
    expect(ink.fullness(400)).toBeGreaterThan(0.95);

    const half = new InkMap(400);
    for (let y = 0; y < 200; y += 8) for (let i = 0; i < 20; i++) half.paint(y);
    expect(half.fullness(400)).toBeGreaterThan(0.45);
    expect(half.fullness(400)).toBeLessThan(0.6);
  });

  it('keeps its paint when the surface grows, and ignores rows off the edge', () => {
    const ink = new InkMap(100);
    ink.paint(50);
    const before = ink.at(50);
    ink.resize(800);
    expect(ink.at(50)).toBe(before);
    expect(ink.paint(700)).toBeCloseTo(1);

    expect(() => ink.paint(-500)).not.toThrow();
    expect(ink.paint(5000)).toBe(0);
    expect(new InkMap().fullness(100)).toBe(0);
  });
});
