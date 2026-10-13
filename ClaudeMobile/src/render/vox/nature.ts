import { hash2, noise2 } from '../art/pixel';
import type { SpriteDef } from '../art/sprite';
import { M } from './mats';
import { Vol, type Mat, render, outlineDark } from './vox';
import { PixelCanvas } from '../art/pixel';

/** Render a volume whose footprint centre is the volume centre into a sprite frame. */
export function bake(vol: Vol, footprint: number, opts: { outline?: boolean; ao?: number } = {}): { c: PixelCanvas; ax: number; ay: number } {
  // canvas big enough for the whole volume
  const w = (vol.w + vol.d) * 2 + 4;
  const h = (vol.w + vol.d) + vol.h * 2 + 6;
  const c = new PixelCanvas(w, h);
  const ox = Math.round(w / 2 + (vol.w - vol.d)), oy = h - 3 - Math.round((vol.w + vol.d) / 2);
  render(vol, c, { ox, oy, ao: opts.ao ?? 0.075, outline: false });
  if (opts.outline !== false) outlineDark(c, 0.55);
  void footprint;
  return trim(c, ox, oy);
}

/** Crop transparent margins, returning the new anchor. */
export function trim(c: PixelCanvas, ax: number, ay: number): { c: PixelCanvas; ax: number; ay: number } {
  let x0 = c.w, y0 = c.h, x1 = -1, y1 = -1;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.alpha(x, y)) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  if (x1 < 0) return { c: new PixelCanvas(1, 1), ax: 0, ay: 0 };
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(c.w - 1, x1 + 1); y1 = Math.min(c.h - 1, Math.max(y1 + 1, ay));
  const out = new PixelCanvas(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.set(x - x0, y - y0, c.get(x, y));
  return { c: out, ax: ax - x0, ay: ay - y0 };
}

/** Bake several animation frames; all frames share one canvas box so anchors match. */
export function bakeFrames(make: (f: number) => Vol, n: number, opts: { outline?: boolean; ao?: number } = {}): { frames: PixelCanvas[]; ax: number; ay: number } {
  const raw = Array.from({ length: n }, (_, f) => {
    const vol = make(f);
    const w = (vol.w + vol.d) * 2 + 4;
    const h = (vol.w + vol.d) + vol.h * 2 + 6;
    const c = new PixelCanvas(w, h);
    const ox = Math.round(w / 2 + (vol.w - vol.d)), oy = h - 3 - Math.round((vol.w + vol.d) / 2);
    render(vol, c, { ox, oy, ao: opts.ao ?? 0.075 });
    if (opts.outline !== false) outlineDark(c, 0.55);
    return { c, ox, oy };
  });
  // union bounds
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (const { c, oy } of raw) for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.alpha(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y, oy); }
  if (x1 < 0) return { frames: raw.map(() => new PixelCanvas(1, 1)), ax: 0, ay: 0 };
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1);
  const frames = raw.map(({ c }) => {
    const out = new PixelCanvas(x1 - x0 + 2, y1 - y0 + 2);
    for (let y = y0; y <= Math.min(c.h - 1, y1 + 1); y++) for (let x = x0; x <= Math.min(c.w - 1, x1 + 1); x++) out.set(x - x0, y - y0, c.get(x, y));
    return out;
  });
  return { frames, ax: raw[0].ox - x0, ay: raw[0].oy - y0 };
}

/** Fluffy leaf cluster: noisy sphere with clumped light/dark patches and a ragged edge. */
export function leafBlob(v: Vol, ci: number, cj: number, ck: number, r: number, mat: Mat, seed: number, squash = 0.8): void {
  v.sphere(ci, cj, ck, r, mat, (i, j, k, d) => {
    if (d > 0.82 && hash2(i * 3 + k, j * 5 - k, seed) > 0.55) return null;
    const n = noise2(i / 2.4 + k * 0.3, j / 2.4 - k * 0.2, seed);
    // volumetric light: lit from above and the +v side, self-shadowed underneath
    const dz = (k + 0.5 - ck) / (r * squash), dj = (j + 0.5 - cj) / r, di = (i + 0.5 - ci) / r;
    const vol = dz * 0.26 + dj * 0.1 - di * 0.1;
    return (n - 0.5) * 0.3 + vol + (hash2(i, j + k * 7, seed + 1) > 0.92 ? 0.16 : 0);
  }, squash);
}

export interface TreeOpts { trunkH: number; trunkR: number; canopy: [number, number, number, number][]; seed: number; leaf?: Mat; lean?: number; roots?: boolean; buds?: number; budMat?: Mat; lanterns?: boolean }

/** A tree volume centred in a (w×w×h) box. */
export function treeVol(w: number, h: number, o: TreeOpts, sway = 0): Vol {
  const v = new Vol(w, w, h);
  const c = w / 2;
  const lean = o.lean ?? 0.6;
  // trunk with bark texture, tapering
  for (let k = 0; k <= o.trunkH; k++) {
    const t = k / o.trunkH;
    const r = o.trunkR * (1 - t * 0.35) + (k < 3 ? (3 - k) * 0.5 : 0);
    const cx = c + lean * t * t * 2, cy = c - lean * t * t;
    v.cyl(cx, cy, k, k, r, M.bark, (i, j, _k, a) => (Math.cos(a * 5 + k * 0.4) > 0.6 ? -0.12 : 0.04) + (hash2(i, j + k, o.seed) > 0.85 ? -0.1 : 0));
  }
  // root flares
  if (o.roots !== false) {
    for (let r = 0; r < 5; r++) {
      const a = (r / 5) * Math.PI * 2 + o.seed;
      const len = o.trunkR + 2.5 + hash2(r, o.seed) * 2;
      v.line([c, c, 2], [c + Math.cos(a) * len, c + Math.sin(a) * len, 0], M.bark, 0.9, -0.05);
    }
  }
  // branches up into the canopy
  const top: [number, number, number] = [c + lean * 2, c - lean, o.trunkH];
  for (const [bi, bj, bk] of o.canopy) {
    v.line([c + lean, c - lean * 0.5, o.trunkH * 0.7], [c + bi * 0.6, c + bj * 0.6, bk * 0.85], M.bark, 1.1, 0.02);
  }
  void top;
  // canopy blobs (sway shifts the upper blobs a little)
  const leaf = o.leaf ?? M.leaf;
  o.canopy.forEach(([bi, bj, bk, br], n) => {
    const sw = sway * (bk / h) * 1.2;
    leafBlob(v, c + bi + sw, c + bj - sw * 0.5, bk, br, n % 3 === 2 ? M.leafDark : leaf, o.seed + n);
  });
  // buds / blossoms / fruit on the canopy surface
  if (o.buds) {
    for (let n = 0; n < o.buds; n++) {
      const blob = o.canopy[n % o.canopy.length];
      const a = hash2(n, o.seed, 5) * Math.PI * 2, e = (hash2(n, o.seed, 6) - 0.2) * 1.2;
      const r = blob[3] * 0.92;
      v.set(c + blob[0] + Math.cos(a) * r * Math.cos(e), c + blob[1] + Math.sin(a) * r * Math.cos(e), blob[2] + Math.sin(e) * r * 0.8 + 1, o.budMat ?? M.flowerW);
    }
  }
  // hanging lanterns
  if (o.lanterns) {
    for (const [bi, bj] of [[-7, 2], [6, -3]]) {
      const li = c + bi, lj = c + bj, lk = o.trunkH - 2;
      v.line([li, lj, lk + 6], [li, lj, lk + 2], M.iron, 0.4);
      v.box(li - 1, lj - 1, lk - 2, li + 1, lj + 1, lk + 1, M.lamp);
      v.box(li - 1, lj - 1, lk + 2, li + 1, lj + 1, lk + 2, M.ironDark);
    }
  }
  return v;
}

export function treeSprite(): SpriteDef {
  const variants: Record<string, PixelCanvas[]> = {};
  let ax = 0, ay = 0;
  for (let stock = 0; stock <= 5; stock++) {
    const b = bakeFrames((f) => treeVol(40, 64, {
      trunkH: 20, trunkR: 2.4, seed: 11, buds: stock * 4, lean: 0.5,
      canopy: [[-6, 1, 26, 7.5], [5, -2, 27, 7.5], [0, 4, 30, 7], [-2, -5, 33, 7.5], [3, 2, 37, 6.5], [-4, 0, 40, 5.5]],
    }, [0, 1, 0, -1][f]), 4);
    variants['s' + stock] = b.frames;
    ax = b.ax; ay = b.ay;
  }
  return { frames: variants.s5, ax, ay, fps: 2, variants };
}

export function elderTreeSprite(): SpriteDef {
  const b = bakeFrames((f) => treeVol(64, 96, {
    trunkH: 30, trunkR: 4.2, seed: 23, buds: 16, budMat: M.amber, lean: 0.8, lanterns: true,
    canopy: [[-11, 3, 36, 11], [10, -4, 37, 11], [0, 7, 42, 10], [-4, -9, 46, 11], [7, 5, 51, 9.5], [-8, -1, 55, 9], [2, -3, 60, 8], [13, 4, 44, 7]],
  }, [0, 1, 0, -1][f]), 4);
  return { frames: b.frames, ax: b.ax, ay: b.ay, fps: 2, lights: [[-14, -24, 0xffc060, 18], [12, -26, 0xffc060, 18]] };
}
