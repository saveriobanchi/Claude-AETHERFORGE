import { hash2, PixelCanvas, rgb } from '../art/pixel';
import type { ItemId } from '../../core/content/items';
import { pack } from '../artpack';
import { M } from './mats';
import { bakeFrames, leafBlob } from './nature';
import { type Mat, Vol } from './vox';

/**
 * Item icons as tiny voxel objects (an 8×8 footprint, ~32 px). The UI shows
 * them at full size; belts use a box-filtered 16 px copy.
 */
const N = 8;
const c = N / 2;

type Build = (v: Vol) => void;

const ingot = (m: Mat): Build => (v) => {
  v.box(1, 2, 0, 6, 5, 1, m, (i, j, k) => (k === 1 ? 0.12 : 0) + (i === 1 || j === 2 ? -0.06 : 0));
  v.box(2, 3, 2, 5, 4, 2, m, () => 0.2);
};
const grit = (m: Mat, seed: number): Build => (v) => {
  for (let q = 0; q < 14; q++) {
    const i = 1 + Math.floor(hash2(q, 1, seed) * 6), j = 1 + Math.floor(hash2(q, 2, seed) * 6);
    const h = Math.max(0, 2 - Math.floor(Math.hypot(i + 0.5 - c, j + 0.5 - c) / 1.6));
    v.set(i, j, h, q % 3 ? m : M.stone, (hash2(q, 3, seed) - 0.5) * 0.4);
  }
  v.sphere(c, c, 0, 2.6, M.stone, (i, j, k) => (hash2(i, j + k, seed) > 0.6 ? null : -0.08), 0.6);
};
const pile = (m: Mat, seed: number, r = 3.4): Build => (v) => {
  v.sphere(c, c, 0, r, m, (i, j, k) => (hash2(i * 3 + k, j, seed) - 0.5) * 0.35, 0.75);
};
const gem = (m: Mat, h = 7, r = 2.6): Build => (v) => {
  for (let k = 0; k <= h; k++) {
    const t = k / h;
    const rr = r * (t < 0.35 ? t / 0.35 : (1 - t) / 0.65) + 0.3;
    v.cyl(c, c, k, k, rr, m, (i) => (i < c ? 0.12 : -0.04));
  }
};

const ICONS: Record<ItemId, Build> = {
  wood: (v) => {
    v.cylU(0, 7, 4, 2.5, 2.4, M.log, (_i, _j, _k, a) => Math.cos(a * 4) * 0.05);
    for (let j = 2; j <= 6; j++) for (let k = 0; k <= 5; k++) if (Math.hypot(j + 0.5 - 4, k + 0.5 - 2.5) < 2.4) v.set(7, j, k, M.sand, Math.hypot(j + 0.5 - 4, k + 0.5 - 2.5) % 1.2 < 0.5 ? -0.15 : 0.05);
  },
  leaf: (v) => {
    leafBlob(v, 3.5, 4.5, 2, 2.6, M.leaf, 5, 0.8);
    leafBlob(v, 5, 3, 3, 2.3, M.leafDark, 6, 0.8);
    leafBlob(v, 3, 2.5, 4, 2, M.leaf, 7, 0.8);
  },
  sapling: (v) => {
    v.sphere(c, c, 0, 2.8, M.dirt, () => 0, 0.5);
    v.box(3, 3, 1, 3, 3, 4, M.wood);
    leafBlob(v, 3, 3, 5.5, 2.4, M.leaf, 3, 0.8);
  },
  fiber: (v) => {
    for (let q = 0; q < 7; q++) { const i = 1 + q, h = 3 + (q % 3); for (let k = 0; k < h; k++) v.set(i - (k > 3 ? 1 : 0), 3 + (q % 2), k, M.grassLight, k * 0.05); }
  },
  twine: (v) => {
    for (let k = 0; k <= 5; k++) v.cyl(c, c, k, k, 2.6, M.cloth, (_i, _j, kk, a) => (Math.cos(a * 2 + kk * 1.5) > 0.4 ? 0.12 : -0.08), 1);
  },
  plank: (v) => {
    v.box(0, 2, 0, 7, 5, 0, M.plank, (i, j) => (j === 2 || j === 5 ? -0.08 : 0.04) + (i % 4 === 0 ? -0.06 : 0));
    v.box(0, 2, 1, 7, 5, 1, M.plank, (_i, j) => (j === 2 ? -0.06 : 0.1));
  },
  loam: pile(M.dirt, 1),
  pebble: (v) => {
    for (const [i, j, r] of [[2.6, 2.6, 2.3], [5.4, 4.2, 2], [3, 5.6, 1.7], [5.6, 1.6, 1.5]] as [number, number, number][]) v.sphere(i, j, 0, r, M.stone, (ii, jj) => (hash2(ii, jj) - 0.5) * 0.2, 0.9);
  },
  stone: (v) => v.box(1, 1, 0, 6, 6, 4, M.stone, (i, j, k) => (k === 4 ? 0.06 : 0) + ((i + j + k) % 4 === 0 ? -0.1 : 0) + (hash2(i, j + k, 2) - 0.5) * 0.2),
  dew: (v) => {
    for (let k = 0; k <= 6; k++) { const r = k < 3 ? 1.6 + k * 0.6 : 3 * (1 - (k - 3) / 4); v.cyl(c, c, k, k, Math.max(0.6, r), M.water, (i) => (i < c ? 0.15 : -0.02)); }
    v.set(3, 3, 4, M.snow);
  },
  clay: (v) => v.box(1, 1, 0, 6, 6, 3, M.clay, (i, j, k) => (k === 3 ? 0.06 : 0) + Math.sin(i + j * 0.7) * 0.05),
  charcoal: (v) => {
    for (const [i, j, k] of [[1, 2, 0], [4, 1, 0], [2, 4, 0], [3, 2, 2]] as [number, number, number][]) v.box(i, j, k, i + 2, j + 2, k + 1, M.ink, (ii, jj, kk) => (hash2(ii, jj + kk) > 0.75 ? 1.2 : 0.1));
  },
  brick: (v) => {
    v.box(0, 2, 0, 7, 5, 2, M.brick, (i, j, k) => (k === 2 ? 0.08 : 0) + (i === 0 || j === 2 ? -0.06 : 0) + (hash2(i, j + k) - 0.5) * 0.14);
  },
  copper_grit: grit(M.copper, 4),
  copper: ingot(M.copper),
  gear: (v) => {
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const dx = i + 0.5 - c, dy = j + 0.5 - c, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (d > 3.8 || (d > 3 && Math.cos(a * 8) < 0) || d < 1) continue;
      v.set(i, j, 0, M.copper, d > 3 ? -0.04 : 0.06);
      if (d < 3) v.set(i, j, 1, M.copper, 0.14);
    }
  },
  wire: (v) => {
    for (let q = 0; q < 26; q++) { const a = q * 0.75; v.set(c + Math.cos(a) * 2.6, c + Math.sin(a) * 2.6, q / 5, M.copper, Math.cos(a) * 0.12); }
  },
  gravel: pile(M.stone, 6, 3.6),
  sand: pile(M.sand, 7, 3.6),
  iron_grit: grit(M.iron, 8),
  iron: ingot(M.iron),
  glass: (v) => v.box(1, 1, 0, 6, 6, 4, M.glass, (i, j, k) => (i === 1 || j === 1 || k === 4 || i === 6 || j === 6 ? 0.1 : null)),
  plate: (v) => {
    v.box(0, 0, 0, 7, 7, 0, M.iron, (i, j) => ((i === 1 || i === 6) && (j === 1 || j === 6) ? 0.3 : 0));
    v.box(0, 0, 1, 7, 7, 1, M.iron, (i, j) => ((i === 1 || i === 6) && (j === 1 || j === 6) ? 0.3 : 0.08));
  },
  mechanism: (v) => {
    v.box(1, 1, 0, 6, 6, 3, M.brass, (i, j, k) => (k === 3 ? 0.08 : (i + j) % 3 === 0 ? -0.08 : 0));
    v.gearV(4, 7, 2, 1.8, M.copper, 0.3, 6);
    v.box(2, 2, 4, 3, 3, 4, M.iron);
  },
  lens: (v) => {
    v.cylV(3, 4, 4, 4, 3.4, M.brass);
    v.cylV(3, 4, 4, 4, 2.6, M.glass, (i) => (i < 4 ? 0.18 : 0));
  },
  mist: (v) => {
    for (const [i, j, k, r] of [[3, 4, 2, 2.6], [5, 3, 3, 2.2], [3, 2, 4, 1.8]] as [number, number, number, number][]) v.sphere(i, j, k, r, M.aether, (ii, jj, kk) => (hash2(ii, jj + kk) > 0.8 ? null : 0.05));
  },
  aether: (v) => {
    v.sphere(c, c, 3.5, 3, M.aether, (i, _j, k) => (i < c ? 0.12 : 0) + (k > 4 ? 0.1 : -0.05));
    v.set(3, 3, 6, M.snow);
  },
  stardust: (v) => {
    pile(M.star, 3, 2.6)(v);
    for (const [i, j, k] of [[1, 6, 4], [6, 1, 5], [6, 6, 3]] as [number, number, number][]) v.set(i, j, k, M.star, 0.3);
  },
  crystal: gem(M.crystal),
  skystone: (v) => v.box(1, 1, 0, 6, 6, 4, M.skystone, (i, j, k) => ((i * 3 + j * 5 + k * 2) % 7 === 0 ? 0.5 : (hash2(i, j + k, 3) - 0.5) * 0.18)),
  amber: (v) => {
    v.sphere(c, c, 2.5, 2.8, M.amber, (i, _j, k) => (i < c ? 0.1 : 0) + (k > 3 ? 0.08 : 0), 0.9);
    v.set(4, 4, 2, M.ink);
  },
  sunmetal: (v) => {
    ingot(M.gold)(v);
    v.set(3, 3, 2, M.lamp); v.set(4, 3, 2, M.lamp);
  },
  cell: (v) => {
    for (let k = 0; k <= 6; k++) v.cyl(c, c, k, k, 2.4, k === 0 || k === 6 ? M.brass : M.glass, () => (k === 6 ? 0.1 : 0), k === 0 || k === 6 ? 0 : 1);
    v.cyl(c, c, 1, 5, 1.5, M.aether);
  },
  coil: (v) => {
    for (let q = 0; q < 40; q++) { const a = q * 0.6; v.set(c + Math.cos(a) * 2.6, c + Math.sin(a) * 2.6, q / 6, M.gold, Math.cos(a) * 0.12); }
    v.cyl(c, c, 0, 6, 1, M.lamp);
  },
  core: (v) => {
    v.sphere(c, c, 3.5, 3.4, M.crystal, (i, j, k) => (Math.abs(i - j) < 1 || Math.abs(k - 3.5) < 0.6 ? 0.3 : i < c ? 0.08 : -0.04));
    v.set(c, c, 7, M.star);
  },
};

const big = new Map<ItemId, PixelCanvas>();
const small = new Map<ItemId, PixelCanvas>();

/** 32×32 icon. */
export function voxIcon(item: ItemId): PixelCanvas {
  let out = big.get(item) ?? pack.icons.get(item);
  if (!out) {
    const b = bakeFrames(() => { const v = new Vol(N, N, N); ICONS[item](v); return v; }, 1, { ao: 0.05 });
    const f = b.frames[0];
    out = new PixelCanvas(32, 32);
    const dx = Math.round((32 - f.w) / 2), dy = Math.round((32 - f.h) / 2);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.alpha(x, y)) out.set(x + dx, y + dy, f.get(x, y));
    big.set(item, out);
  }
  return out;
}

/** 16×16 icon, box-filtered from the 32 px one (premultiplied). */
export function voxIconSmall(item: ItemId): PixelCanvas {
  let out = small.get(item) ?? pack.iconsSmall.get(item);
  if (!out) {
    const s = voxIcon(item);
    out = new PixelCanvas(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let q = 0; q < 4; q++) {
        const p = s.get(x * 2 + (q & 1), y * 2 + (q >> 1));
        const al = (p & 255) / 255;
        r += (p >>> 24) * al; g += ((p >>> 16) & 255) * al; b += ((p >>> 8) & 255) * al; a += al;
      }
      if (a < 0.6) continue;
      out.set(x, y, rgb((Math.round(r / a) << 16) | (Math.round(g / a) << 8) | Math.round(b / a)));
    }
    small.set(item, out);
  }
  return out;
}
