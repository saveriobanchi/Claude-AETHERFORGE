import { type Image, Renderer, type RenderOpts } from './render';
import type { Model } from './sdf';
import { type Floor, columnPiece, hashDepth, topPiece } from './models/terrain';

/** Island layout helpers shared by the preview and the game. */
export function edgeMask(has: (x: number, y: number) => boolean, x: number, y: number): number {
  return (has(x + 1, y) ? 0 : 1) | (has(x, y + 1) ? 0 : 2) | (has(x - 1, y) ? 0 : 4) | (has(x, y - 1) ? 0 : 8);
}

export function gapDist(has: (x: number, y: number) => boolean, x: number, y: number): number {
  for (let r = 1; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (!has(x + dx, y + dy)) return r - 1;
    }
  }
  return 4;
}

export const DEPTHS = [1, 1.8, 2.6, 3.4, 4.2, 5, 5.8, 6.6];
export const nearestDepth = (d: number) => DEPTHS.reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a));

/** Composite an island and some objects into one image (preview only). */
export function composeIsland(tiles: [number, number, Floor][], objects: [number, number, () => Model][], R = 3, base: RenderOpts = {}): Image {
  const set = new Map(tiles.map(([x, y, f]) => [`${x},${y}`, f]));
  const has = (x: number, y: number) => set.has(`${x},${y}`);
  const cache = new Map<string, Image>();
  const piece = (key: string, make: () => Image) => { let i = cache.get(key); if (!i) { i = make(); cache.set(key, i); } return i; };
  type Draw = { img: Image; x: number; y: number; order: number };
  const draws: Draw[] = [];
  for (const [x, y, f] of tiles) {
    const v = (Math.abs(x * 7 + y * 13) % 3);
    const d = nearestDepth(hashDepth(gapDist(has, x, y), x, y));
    const mask = edgeMask(has, x, y);
    const col = piece(`c${d}:${v}`, () => new Renderer(columnPiece(d, v), { ...base, R, shadow: false }).render());
    const tk = `t${f}:${mask}:${v % 2}`;
    const top = piece(tk, () => { const t = topPiece(f, mask, v % 2); return new Renderer(t.m, { ...base, R, shadow: false, clip: t.clip, outline: 0 }).render(); });
    const o = (x + y) * 10 + x * 0.01;
    draws.push({ img: col, x, y, order: o }, { img: top, x, y, order: o + 0.001 });
  }
  for (const [x, y, make] of objects) draws.push({ img: new Renderer(make(), { ...base, R }).render(), x, y, order: 1e6 + (x + y) * 10 });
  draws.sort((a, b) => a.order - b.order);
  // canvas bounds
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of draws) {
    const sx = (d.x - d.y) * 32 * R - d.img.ax, sy = (d.x + d.y) * 16 * R - d.img.ay;
    x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx + d.img.w); y1 = Math.max(y1, sy + d.img.h);
  }
  const w = Math.ceil(x1 - x0), h = Math.ceil(y1 - y0);
  const data = new Uint8ClampedArray(w * h * 4);
  for (const d of draws) {
    const ox = Math.round((d.x - d.y) * 32 * R - d.img.ax - x0), oy = Math.round((d.x + d.y) * 16 * R - d.img.ay - y0);
    const im = d.img;
    for (let yy = 0; yy < im.h; yy++) for (let xx = 0; xx < im.w; xx++) {
      const s = (yy * im.w + xx) * 4, a = im.data[s + 3] / 255;
      if (!a) continue;
      const t = ((oy + yy) * w + ox + xx) * 4;
      const ta = data[t + 3] / 255, na = a + ta * (1 - a);
      for (let c = 0; c < 3; c++) data[t + c] = (im.data[s + c] * a + data[t + c] * ta * (1 - a)) / na;
      data[t + 3] = na * 255;
    }
  }
  return { w, h, data, ax: -x0, ay: -y0 };
}
