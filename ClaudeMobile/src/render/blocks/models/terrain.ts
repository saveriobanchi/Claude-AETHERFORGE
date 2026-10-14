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
export function column(c: Canvas, L: TexLib, floor: Floor, depth: number, v: number, x = 0, y = 0): void {
  const top: Record<Floor, [string, string]> = {
    grass: ['a/grass_top', 'a/grass_side'],
    stone: ['a/limestone_bricks', 'a/limestone_bricks'],
    sky: ['a/marble_bricks', 'a/marble_bricks2'],
  };
  const [tt, ts] = top[floor];
  const face = (n: string): Face => ({ tex: L.get(n) });
  c.box([x, y, -1], [x + 1, y + 1, 0], face(tt), face(ts), face(ts), 1);
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
