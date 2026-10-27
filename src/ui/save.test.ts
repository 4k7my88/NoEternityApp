import { describe, expect, it } from 'vitest';
import { artworkFileName } from './save';

describe('artworkFileName', () => {
  it('stamps the local date and time, zero-padded', () => {
    expect(artworkFileName(new Date(2026, 0, 5, 7, 3, 9))).toBe('no-eternity-20260105-070309.png');
    expect(artworkFileName(new Date(2015, 10, 23, 21, 45, 30))).toBe('no-eternity-20151123-214530.png');
  });
});
