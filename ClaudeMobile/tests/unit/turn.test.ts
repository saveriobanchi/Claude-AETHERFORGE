import { describe, expect, it } from 'vitest';
import { Canvas } from '../../src/render/blocks/iso';

describe('turning a model', () => {
  it('rotates points a quarter turn at a time about the footprint centre', () => {
    const c = new Canvas(1, 1, 0, 0);
    const p: [number, number, number] = [0.9, 0.5, 0.2];
    const seen = [0, 1, 2, 3].map((t) => { c.turn = t; return c.rp(p).map((v) => +v.toFixed(3)).join(); });
    expect(new Set(seen).size).toBe(4);
    expect(seen[0]).toBe('0.9,0.5,0.2');
    expect(seen[2]).toBe('0.1,0.5,0.2');
    c.turn = 4;
    expect(c.rp(p)).toEqual(p);
  });
});
