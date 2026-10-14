import { type Canvas, type Face } from '../iso';
import { Paint, type TexLib } from '../tex';

export type Floor = 'grass' | 'stone' | 'sky';

const h = (a: number, b: number, c = 0) => {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/** Hanging vine strip texture (16×48), painted in the pack's greens. */
function vineTex(L: TexLib, seed: number): Paint {
  const key = 'gen/vine' + seed;
  const p = new Paint(16, 48);
  const leaf = [0x3d6b2c, 0x4f8a32, 0x6aa63c, 0x86bf4a];
  for (let s = 0; s < 3; s++) {
    let x = 2 + Math.floor(h(s, seed, 1) * 12);
    const len = 14 + Math.floor(h(s, seed, 2) * 32);
    for (let y = 0; y < len; y++) {
      if (h(y, s, seed) > 0.75) x += h(y, s, seed + 1) > 0.5 ? 1 : -1;
      x = Math.max(1, Math.min(14, x));
      p.set(x, y, leaf[0]);
      if (y % 3 === 0) { p.set(x - 1, y, leaf[2]); p.set(x + 1, y, leaf[1]); }
      if (y % 5 === 2) { p.set(x + 1, y + 1, leaf[3]); p.set(x - 1, y + 1, leaf[1]); }
    }
  }
  L.put(key, p);
  return p;
}

/** Tile column: the floor block at z ∈ [−1, 0] and `depth − 1` blocks under it. */
export function column(c: Canvas, L: TexLib, floor: Floor, depth: number, v: number, x = 0, y = 0, sunk = 0): void {
  const top: Record<Floor, [string, string]> = {
    grass: ['a/grass_top', 'a/grass_side'],
    stone: ['a/limestone_bricks', 'a/limestone_bricks'],
    sky: ['a/marble_bricks', 'a/marble_bricks2'],
  };
  const [tt, ts] = top[floor];
  const face = (n: string, tint?: [number, number, number]): Face => ({ tex: L.get(n), tint });
  // gentle meadow colour drift across the island so tiles don't repeat
  const g = floor === 'grass' ? (h(Math.floor(x / 2), Math.floor(y / 2), 5) - 0.5) * 0.12 : 0;
  const tint: [number, number, number] = [1 + g * 0.6, 1 + g * 0.2, 1 - g];
  c.box([x, y, -1], [x + 1, y + 1, -sunk], face(sunk ? 'a/dirt' : tt, tint), face(ts, tint), face(ts, tint), 1, Math.floor(h(x, y, 77) * 4));
  for (let k = 1; k < depth; k++) {
    const z = -1 - k;
    let n: string;
    if (floor !== 'grass' && k === 1) n = 'a/dirt';
    else if (k <= (floor === 'grass' ? 1 : 1)) n = 'a/dirt';
    else if (k === 2) n = h(x, y, v) > 0.5 ? 'b/old_dirt' : 'a/dirt';
    else {
      const r = h(x * 7 + k, y * 3 + v, 11);
      n = k > 4 ? (r > 0.7 ? 'a/basalt' : 'a/slate') : r > 0.86 ? 'a/stone_generic_ore_nuggets' : r > 0.78 ? 'a/stone_generic_ore_crystalline' : r > 0.45 ? 'b/stone' : 'b/andesite';
    }
    c.box([x, y, z], [x + 1, y + 1, z + 1], face(n), face(n), face(n), 1);
  }
  // overgrown rim: grass tufts leaning over the two visible edges
  if (floor === 'grass' && !sunk) {
    const tuft = ['grass', 'grass2', 'grass3', 'fern2', 'sedge'];
    for (let i = 0; i < 4; i++) {
      const t = 0.12 + h(x, y, i + 30) * 0.76;
      const side = i % 2;
      const p: [number, number, number] = side === 0 ? [x + t, y + 0.97, 0] : [x + 0.97, y + t, 0];
      if (h(x, y, i + 40) < 0.4) continue;
      c.sprite(p, { tex: L.get('a/plants/' + tuft[Math.floor(h(x, y, i + 50) * tuft.length)]) }, 1, 2, 0.2);
    }
  }
  // vines and roots hanging over the two visible faces
  if (floor === 'grass') {
    for (let side = 0; side < 2; side++) {
      if (h(x * 5 + side, y * 9, v) < 0.45) continue;
      const vt = vineTex(L, Math.floor(h(x, y, side + v) * 6));
      const len = Math.min(depth, 1 + Math.floor(h(x, y, side) * 2.5));
      if (side === 0) c.quad([x, y + 1.01, 0], [1, 0, 0], [0, 0, -len * 1.5], { tex: vt, uv: [0, 0, 16, 48] }, [0.86, 0.84, 0.86], 1, 0.01);
      else c.quad([x + 1.01, y + 1, 0], [0, -1, 0], [0, 0, -len * 1.5], { tex: vt, uv: [0, 0, 16, 48] }, [0.66, 0.66, 0.76], 1, 0.01);
    }
  }
}

export const PLANTS = ['grass', 'grass2', 'grass3', 'fern', 'aster', 'dandelion', 'forget_me_not', 'lupine', 'oxeye_daisy', 'orchid_ground', 'pimpernel', 'mushroom_red', 'mushroom_brown', 'goldenrod', 'sedge', 'horsetail'];

/** A small cluster of plant sprites on the ground around (cx, cy). */
export function plants(c: Canvas, L: TexLib, cx: number, cy: number, seed: number, n = 3): void {
  for (let i = 0; i < n; i++) {
    const name = PLANTS[Math.floor(h(seed, i, 3) * PLANTS.length)];
    c.sprite([cx + (h(seed, i, 4) - 0.5) * 0.5, cy + (h(seed, i, 5) - 0.5) * 0.5, 0], { tex: L.get('a/plants/' + name) }, 2);
  }
}

/** Animated water face (16×16), painted in the pack's blues; frame f scrolls the ripples. */
export function waterTex(L: TexLib, f: number, falling = false): Paint {
  const key = `gen/water${falling ? 'f' : ''}${f}`;
  const p = new Paint();
  const pal = [0x2a5a9a, 0x3a78b8, 0x4a92cc, 0x6ab2e0, 0xb8e6f4, 0xffffff];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const yy = falling ? (y - f * 4 + 64) % 16 : y;
    const n = h(falling ? x : (x + f) % 16, yy, 3);
    let i = falling ? (x % 5 === 1 ? 3 : x % 5 === 3 ? 2 : 1) : 2;
    if (n > 0.86) i = 4; else if (n > 0.7) i = 3; else if (n < 0.15) i = 1;
    if (falling && h(x, yy, 9) > 0.93) i = 5;
    p.set(x, y, pal[i]);
  }
  L.put(key, p);
  return p;
}

/** A pond tile: a sunken grass block filled with water, a grassy lip around it. */
export function pond(c: Canvas, L: TexLib, x: number, y: number, depth: number, f = 0): void {
  column(c, L, 'grass', depth, 0, x, y, 0.1875);
  const w = { tex: waterTex(L, f) };
  c.quad([x, y, -0.09], [1, 0, 0], [0, 1, 0], w, [1.02, 1.02, 1.06], 7, 0, true);
  const lip = { tex: L.get('a/grass_top') };
  c.box([x, y, -0.1875], [x + 1, y + 0.125, 0], lip, { tex: L.get('a/grass_side') }, { tex: L.get('a/grass_side') }, 1);
  c.box([x, y, -0.1875], [x + 0.125, y + 1, 0], lip, { tex: L.get('a/grass_side') }, { tex: L.get('a/grass_side') }, 1);
}

/** Waterfall pouring off the +y edge of tile (x, y) down `len` blocks: layered sheets, foam at lip and edges. */
export function waterfall(c: Canvas, L: TexLib, x: number, y: number, len: number, f = 0): void {
  const sheet = { tex: waterTex(L, f, true) };
  c.quad([x + 0.2, y + 1.04, -0.2], [0.6, 0, 0], [0, 0, -len], { ...sheet, uv: [0, 0, 10, len * 16] }, [1.0, 1.0, 1.04], 8, 0.05);
  c.quad([x + 0.28, y + 1.07, -0.25], [0.44, 0, 0], [0, 0, -len * 0.9], { tex: waterTex(L, (f + 2) % 4, true), uv: [3, 5, 11, 5 + len * 16] }, [1.08, 1.1, 1.12], 8, 0.06);
  const foam = new Paint(16, 4);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) if (h(i, j, f) > 0.35 - j * 0.1) foam.set(i, j, j < 2 ? 0xffffff : 0xd8f0f8);
  c.quad([x + 0.16, y + 1.08, -0.16], [0.68, 0, 0], [0, 0, -0.18], { tex: foam }, [1, 1, 1], 8, 0.08);
}
