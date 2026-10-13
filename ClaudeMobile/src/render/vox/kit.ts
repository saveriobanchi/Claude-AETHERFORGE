import { hash2 } from '../art/pixel';
import { M } from './mats';
import { type Mat, Vol } from './vox';

/**
 * Reusable voxel parts. Coordinates: i → +u (screen down-right), j → +v
 * (screen down-left), k up. A tile footprint is 16×16. `F` is the margin so a
 * model can overhang its tile (volumes are (16+2F)² wide, centred).
 */

export function vol(h: number, pad = 0, size = 1): Vol {
  return new Vol(16 * size + pad * 2, 16 * size + pad * 2, h);
}

/** Footprint helper: local tile coords → volume coords for a padded volume. */
export const at = (pad: number) => (n: number) => n + pad;

/** Stone base slab with bevelled top edge. */
export function plinth(v: Vol, p: number, h = 2, m: Mat = M.cobble, size = 1): void {
  const e = 16 * size - 1;
  v.box(p, p, 0, p + e, p + e, h - 1, m, (i, j, k) => {
    const li = i - p, lj = j - p;
    const edge = li === 0 || lj === 0 || li === e || lj === e;
    const block = (Math.floor(li / 4) + Math.floor(lj / 4) + k) % 2;
    return (edge ? -0.1 : 0) + (block ? 0.05 : -0.03) + (hash2(i, j + k, 9) - 0.5) * 0.12;
  });
}

/** Wooden box built of planks running along `dir` ('u' | 'v' | 'k'), with dark edge trim. */
export function planks(v: Vol, i0: number, j0: number, k0: number, i1: number, j1: number, k1: number, dir: 'u' | 'v' | 'k' = 'k', m: Mat = M.plank, trim: Mat | null = M.woodDark): void {
  v.box(i0, j0, k0, i1, j1, k1, m, (i, j, k) => {
    const edges = (i === i0 || i === i1 ? 1 : 0) + (j === j0 || j === j1 ? 1 : 0) + (k === k0 || k === k1 ? 1 : 0);
    if (trim && edges >= 2) return 0;
    const along = dir === 'k' ? k - k0 : dir === 'u' ? i - i0 : j - j0;
    const board = Math.floor(along / 3);
    const seam = along % 3 === 0 ? -0.14 : 0;
    return seam + (hash2(board, 3, Math.floor((i + j) / 5)) - 0.5) * 0.16 + (hash2(i, j, k) > 0.93 ? -0.1 : 0);
  });
  if (trim) {
    // re-paint edges with trim material
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const edges = (i === i0 || i === i1 ? 1 : 0) + (j === j0 || j === j1 ? 1 : 0) + (k === k0 || k === k1 ? 1 : 0);
      if (edges >= 2) v.set(i, j, k, trim, (hash2(i, j, k) - 0.5) * 0.1);
    }
  }
}

/** Solid bricks with mortar lines. */
export function bricks(v: Vol, i0: number, j0: number, k0: number, i1: number, j1: number, k1: number, m: Mat = M.brick): void {
  v.box(i0, j0, k0, i1, j1, k1, m, (i, j, k) => {
    const row = Math.floor((k - k0) / 2);
    const off = row % 2 ? 2 : 0;
    const a = (i + j + off) % 4;
    if ((k - k0) % 2 === 1 || a === 0) return -0.24;
    return (hash2(Math.floor((i + j + off) / 4), row, 3) - 0.5) * 0.24;
  });
}

/** Stone blocks. */
export function stones(v: Vol, i0: number, j0: number, k0: number, i1: number, j1: number, k1: number, m: Mat = M.stone): void {
  v.box(i0, j0, k0, i1, j1, k1, m, (i, j, k) => {
    const row = Math.floor((k - k0) / 3);
    const off = row % 2 ? 3 : 0;
    const a = (i + j + off) % 5;
    if ((k - k0) % 3 === 2 || a === 0) return -0.2;
    return (hash2(Math.floor((i + j + off) / 5), row, 7) - 0.5) * 0.22 + 0.04;
  });
}

/** Vertical post (square). */
export function post(v: Vol, i: number, j: number, k0: number, k1: number, m: Mat = M.wood, w = 1): void {
  v.box(i, j, k0, i + w - 1, j + w - 1, k1, m, (_i, _j, k) => (k % 4 === 0 ? -0.06 : 0.02));
}

/** Hanging lantern centred at (i, j) with its body bottom at k. */
export function lantern(v: Vol, i: number, j: number, k: number): void {
  v.box(i - 1, j - 1, k, i + 1, j + 1, k + 2, M.lamp);
  v.box(i - 1, j - 1, k + 3, i + 1, j + 1, k + 3, M.ironDark);
  v.set(i, j, k + 4, M.ironDark);
  v.set(i, j, k - 1, M.ironDark);
}

/** Gable roof running along u, from i0..i1, over j0..j1, eaves at k. Shingle texture. */
export function roofU(v: Vol, i0: number, i1: number, j0: number, j1: number, k: number, m: Mat = M.red, rise = 1): void {
  const half = (j1 - j0) / 2;
  for (let s = 0; s <= Math.ceil(half); s++) {
    const kk = k + Math.round(s * rise);
    for (let i = i0; i <= i1; i++) {
      const shade = (i + s) % 3 === 0 ? -0.12 : 0;
      v.set(i, j0 + s, kk, m, shade + 0.04);
      v.set(i, j1 - s, kk, m, shade - 0.02);
    }
  }
}

/** Gable roof running along v. */
export function roofV(v: Vol, j0: number, j1: number, i0: number, i1: number, k: number, m: Mat = M.red, rise = 1): void {
  const half = (i1 - i0) / 2;
  for (let s = 0; s <= Math.ceil(half); s++) {
    const kk = k + Math.round(s * rise);
    for (let j = j0; j <= j1; j++) {
      const shade = (j + s) % 3 === 0 ? -0.12 : 0;
      v.set(i0 + s, j, kk, m, shade - 0.02);
      v.set(i1 - s, j, kk, m, shade + 0.04);
    }
  }
}

/** Barrel standing upright. */
export function barrel(v: Vol, ci: number, cj: number, k0: number, h: number, r: number, m: Mat = M.wood): void {
  for (let k = k0; k <= k0 + h; k++) {
    const t = (k - k0) / h;
    const rr = r * (0.85 + Math.sin(t * Math.PI) * 0.15);
    const band = k === k0 + 1 || k === k0 + h - 1 || k === k0 + Math.round(h / 2);
    v.cyl(ci, cj, k, k, rr, band ? M.ironDark : m, (_i, _j, _k, a) => (band ? 0 : Math.cos(a * 6) > 0.7 ? -0.12 : 0));
  }
}

/** Small cube crate with cross bracing. */
export function crate(v: Vol, i0: number, j0: number, k0: number, n: number): void {
  planks(v, i0, j0, k0, i0 + n - 1, j0 + n - 1, k0 + n - 1, 'u');
  for (let q = 0; q < n; q++) {
    v.set(i0 + q, j0 + n - 1, k0 + q, M.woodDark);
    v.set(i0 + n - 1, j0 + q, k0 + q, M.woodDark);
  }
}

/** Iron rivet band around a box at height k. */
export function band(v: Vol, i0: number, j0: number, i1: number, j1: number, k: number, m: Mat = M.ironDark): void {
  for (let i = i0; i <= i1; i++) { v.set(i, j0, k, m); v.set(i, j1, k, m); }
  for (let j = j0; j <= j1; j++) { v.set(i0, j, k, m); v.set(i1, j, k, m); }
}

/** A chimney with a sooty cap. */
export function chimney(v: Vol, i: number, j: number, k0: number, k1: number): void {
  bricks(v, i, j, k0, i + 2, j + 2, k1);
  v.box(i - 0, j - 0, k1 + 1, i + 2, j + 2, k1 + 1, M.ironDark);
  v.set(i + 1, j + 1, k1 + 1, null);
}

/** Pile of small items (ore, logs…) as a mound. */
export function pile(v: Vol, ci: number, cj: number, k0: number, r: number, m: Mat, seed = 1): void {
  v.sphere(ci, cj, k0, r, m, (i, j, k) => (hash2(i * 3 + k, j * 5, seed) - 0.5) * 0.4, 0.6);
}

export { M };
