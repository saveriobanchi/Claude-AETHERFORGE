import type { Tile } from '../../core/state';
import { PixelCanvas, hash2, noise2 } from '../art/pixel';
import { CHUNK, CHUNK_H, CHUNK_W, chunkOrigin, type TileLookup } from '../art/terrain';
import { M } from './mats';
import { type Mat, Raster, stamp } from './vox';

/**
 * Block terrain. Every tile is a 16×16-voxel block column: a textured top
 * (grass / paving / skystone), then a stepped underside of whole cubes whose
 * depth follows how much island lies behind it — so islands hang like
 * inverted, blocky mountains. Seams, ores, moss, roots and vines give the
 * cubes their character.
 */

const N = 16; // voxels per tile edge (one block)

/** Underside depth of a tile column, in whole blocks: shallow at the rim, deep in the core. */
export function columnBlocks(get: TileLookup, x: number, y: number): number {
  // distance to the nearest gap (Chebyshev rings)
  let dist = 4;
  for (let r = 1; r <= 4 && dist === 4; r++) {
    for (let dy = -r; dy <= r && dist === 4; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (!get(x + dx, y + dy)) { dist = r - 1; break; }
    }
  }
  const n = noise2(x * 0.9, y * 0.9, 77);
  const jag = hash2(x * 7 + 3, y * 11 - 5, 79);
  return Math.max(1, Math.min(9, Math.round(1.6 + dist * 1.9 + (n - 0.5) * 1.6 + (jag > 0.7 ? 1 : jag < 0.2 ? -1 : 0))));
}

interface Surf { mat: Mat; t: number }

function topVoxel(t: Tile, gi: number, gj: number, li: number, lj: number, get: TileLookup, bloom: boolean): Surf {
  if (t.floor === 'grass') {
    const n = noise2(gi / 6, gj / 6, 3);
    let tw = (hash2(gi, gj, 5) - 0.5) * 0.22 + (n - 0.5) * 0.24;
    // a slightly lighter rim where the island ends
    const backL = !get(t.x - 1, t.y) && li === 0, backR = !get(t.x, t.y - 1) && lj === 0;
    if (backL || backR) tw += 0.16;
    if (bloom && hash2(gi, gj, 9) > 0.93) return { mat: [M.flowerY, M.flowerP, M.flowerW][Math.floor(hash2(gi, gj, 8) * 3)], t: 0 };
    return { mat: M.grass, t: tw };
  }
  if (t.floor === 'stone') {
    // cobbled paving: irregular stones with dark mortar
    const ci = Math.floor((gi + (Math.floor(gj / 4) % 2) * 2) / 4), cj = Math.floor(gj / 4);
    const mi = (gi + (Math.floor(gj / 4) % 2) * 2) % 4, mj = gj % 4;
    if (mi === 0 || mj === 0) return { mat: M.cobble, t: -0.32 + hash2(gi, gj, 2) * 0.06 };
    return { mat: M.cobble, t: (hash2(ci, cj, 4) - 0.5) * 0.3 + (mi === 1 || mj === 1 ? 0.1 : 0) - (mi === 3 || mj === 3 ? 0.06 : 0) };
  }
  // skystone: pale tiles with glowing aether veins
  const vein = Math.abs(noise2(gi / 9, gj / 9, 53) - 0.5) < 0.03 && noise2(gi / 14, gj / 14, 57) > 0.42;
  if (vein) return { mat: M.aether, t: 0 };
  if (li === 0 || lj === 0) return { mat: M.skystone, t: -0.2 };
  return { mat: M.skystone, t: (hash2(Math.floor(gi / 8), Math.floor(gj / 8), 6) - 0.5) * 0.12 + (noise2(gi / 4, gj / 4, 7) - 0.5) * 0.12 };
}

/** Side voxel of a column at depth k (k = -1 is the top layer, going down). `a` = position along the face. */
function sideVoxel(t: Tile, k: number, a: number, ga: number): Surf {
  const depth = -1 - k; // 0 at the top
  const block = Math.floor(depth / N);
  const inBlock = depth % N;
  const seam = inBlock === N - 1 || a === N - 1 ? -0.16 : inBlock === 0 && block > 0 ? 0.07 : a === 0 ? 0.05 : 0;
  const n = hash2(ga, k, 13 + t.seed % 7);
  if (block === 0) {
    if (t.floor === 'grass') {
      // grass lip with drips, then dirt
      const drip = 2 + Math.floor(hash2(ga, 21) * 3) + (hash2(ga, 22) > 0.8 ? 2 : 0);
      if (inBlock < drip) return { mat: M.grass, t: 0.04 - inBlock * 0.06 + (n - 0.5) * 0.12 };
      return { mat: M.dirt, t: (n - 0.5) * 0.24 + seam + (hash2(ga, k, 31) > 0.94 ? -0.18 : 0) };
    }
    if (t.floor === 'stone') {
      if (inBlock < 3) return { mat: M.cobble, t: 0.1 - inBlock * 0.08 + (n - 0.5) * 0.1 };
      return { mat: M.dirt, t: (n - 0.5) * 0.22 + seam };
    }
    if (inBlock < 3) return { mat: M.skystone, t: 0.08 };
    return { mat: M.skystone, t: (n - 0.5) * 0.14 + seam - 0.1 };
  }
  // deeper blocks: stone with strata, ores, moss and the odd dirt block
  const bseed = hash2(Math.floor(ga / N) * 7 + block, t.x * 3 + t.y, 41);
  if (t.floor === 'sky') {
    if (hash2(ga, k, 71) > 0.97) return { mat: M.aether, t: 0 };
    return { mat: M.skystone, t: (n - 0.5) * 0.16 + seam - 0.14 - block * 0.03 };
  }
  if (bseed < 0.18 && block === 1) return { mat: M.dirt, t: (n - 0.5) * 0.22 + seam - 0.06 };
  // moss creeping down from the grass
  const mossy = noise2(ga / 5, k / 4, 61) > 0.62 && block <= 2;
  if (mossy) return { mat: M.moss, t: (n - 0.5) * 0.2 + seam };
  // ore specks in some blocks
  if (bseed > 0.82 && hash2(ga, k, 73) > 0.86) return { mat: bseed > 0.93 ? M.crystal : M.copper, t: 0.1 };
  const strata = noise2(ga / 11, k / 3.5, 63);
  const crack = hash2(Math.floor(ga / 3), Math.floor(k / 2), 75) > 0.93 ? -0.2 : 0;
  return { mat: M.stone, t: (strata - 0.5) * 0.24 + (n - 0.5) * 0.14 + seam + crack - block * 0.035 };
}

/** Rasterise one chunk of block terrain in the same layout as the old renderer. */
export function renderVoxChunk(get: TileLookup, chunkX: number, chunkY: number, bloom = false): PixelCanvas | null {
  const tiles: Tile[] = [];
  for (let y = chunkY * CHUNK; y < chunkY * CHUNK + CHUNK; y++)
    for (let x = chunkX * CHUNK; x < chunkX * CHUNK + CHUNK; x++) { const t = get(x, y); if (t) tiles.push(t); }
  if (!tiles.length) return null;
  const c = new PixelCanvas(CHUNK_W, CHUNK_H);
  const R = new Raster(c);
  const [ox, oy] = chunkOrigin(chunkX, chunkY);
  // screen position (in chunk canvas) of the top vertex of global voxel (gi, gj, k)
  const scr = (gi: number, gj: number, k: number): [number, number] => {
    const u = gi * 2 - 16, v = gj * 2 - 16, z = (k + 1) * 2;
    return [u - v - ox, (u + v) / 2 - z - oy];
  };
  const blocksOf = new Map<number, number>();
  const blocks = (x: number, y: number) => {
    const k = x * 4096 + y;
    let b = blocksOf.get(k);
    if (b === undefined) { b = columnBlocks(get, x, y); blocksOf.set(k, b); }
    return b;
  };

  for (const t of tiles) {
    const B = blocks(t.x, t.y);
    const bottom = -B * N; // lowest voxel layer index
    // ── left face (+v / +j side)
    const nL = get(t.x, t.y + 1);
    const nLb = nL ? -blocks(t.x, t.y + 1) * N : 0;
    if (!nL || nLb > bottom) {
      const kTop = nL ? nLb - 1 : -1;
      const gj = t.y * N + N - 1;
      for (let li = 0; li < N; li++) {
        const gi = t.x * N + li;
        // ragged bottom edge: some columns stop a voxel or two early
        const rag = hash2(gi, t.y, 3) > 0.7 ? 1 + Math.floor(hash2(gi, t.y, 4) * 2) : 0;
        for (let k = kTop; k >= bottom + rag; k--) {
          const s = sideVoxel(t, k, li, gi);
          const [sx, sy] = scr(gi, gj, k);
          const shadeY = k === bottom + rag ? -0.12 : 0;
          stamp(R, sx, sy, gi + gj + k, s.mat, NaN, s.mat.l + s.t + shadeY, NaN);
        }
        hangers(R, scr, t, gi, gj, bottom + rag, li, 'l');
      }
    }
    // ── right face (+u / +i side)
    const nR = get(t.x + 1, t.y);
    const nRb = nR ? -blocks(t.x + 1, t.y) * N : 0;
    if (!nR || nRb > bottom) {
      const kTop = nR ? nRb - 1 : -1;
      const gi = t.x * N + N - 1;
      for (let lj = 0; lj < N; lj++) {
        const gj = t.y * N + lj;
        const rag = hash2(t.x, gj, 3) > 0.7 ? 1 + Math.floor(hash2(t.x, gj, 4) * 2) : 0;
        for (let k = kTop; k >= bottom + rag; k--) {
          const s = sideVoxel(t, k, lj, gj);
          const [sx, sy] = scr(gi, gj, k);
          const shadeY = k === bottom + rag ? -0.12 : 0;
          stamp(R, sx, sy, gi + gj + k, s.mat, NaN, NaN, s.mat.l + s.t - 0.2 + shadeY);
        }
        hangers(R, scr, t, gi, gj, bottom + rag, lj, 'r');
      }
    }
    // ── top surface and little 3D details on grass
    for (let lj = 0; lj < N; lj++) for (let li = 0; li < N; li++) {
      const gi = t.x * N + li, gj = t.y * N + lj;
      const s = topVoxel(t, gi, gj, li, lj, get, bloom);
      const [sx, sy] = scr(gi, gj, -1);
      // exposed edges also show a sliver of side so the block reads as a cube
      const edgeL = lj === N - 1 && !get(t.x, t.y + 1), edgeR = li === N - 1 && !get(t.x + 1, t.y);
      stamp(R, sx, sy, gi + gj - 1, s.mat, s.mat.l + s.t + 0.16, edgeL ? s.mat.l + s.t - 0.04 : NaN, edgeR ? s.mat.l + s.t - 0.24 : NaN);
      if (t.floor === 'grass') decor(R, scr, t, gi, gj, li, lj, bloom);
    }
  }
  return c;
}

/** Grass blades, flowers and pebbles on top of grass blocks. */
function decor(R: Raster, scr: (i: number, j: number, k: number) => [number, number], t: Tile, gi: number, gj: number, li: number, lj: number, bloom: boolean): void {
  if (li === 0 || lj === 0 || li === N - 1 || lj === N - 1) return;
  const h = hash2(gi, gj, 101);
  const put = (k: number, m: Mat, l: number) => { const [sx, sy] = scr(gi, gj, k); stamp(R, sx, sy, gi + gj + k, m, m.l + l + 0.16, m.l + l, m.l + l - 0.2); };
  const flowerRate = bloom ? 0.03 : 0.007;
  if (h < flowerRate) {
    put(0, M.grass, 0.05);
    const fm = [M.flowerY, M.flowerP, M.flowerW, M.flowerB][Math.floor(hash2(gi, gj, 102) * 4)];
    put(1, fm, 0);
  } else if (h < flowerRate + 0.05) {
    put(0, M.grass, 0.12 + hash2(gi, gj, 103) * 0.1);
    if (hash2(gi, gj, 104) > 0.55) put(1, M.grassLight, 0.12);
  } else if (h > 0.996 && t.seed % 3 === 0) {
    put(0, M.stone, 0.12);
  }
}

/** Roots, vines and dripping moss hanging below a column's bottom edge. */
function hangers(R: Raster, scr: (i: number, j: number, k: number) => [number, number], t: Tile, gi: number, gj: number, kBottom: number, a: number, side: 'l' | 'r'): void {
  if (t.floor === 'sky') {
    if (hash2(gi + gj, kBottom, 211) > 0.94) {
      const [sx, sy] = scr(gi, gj, kBottom - 3 - Math.floor(hash2(gi, gj, 212) * 6));
      stamp(R, sx, sy, gi + gj + kBottom - 4, M.aether, 0.85, NaN, NaN);
    }
    return;
  }
  const h = hash2(gi * 3 + gj, t.y * 5 + t.x, 201);
  if (h < 0.06) {
    // hanging vine with leaves
    const len = 6 + Math.floor(hash2(gi, gj, 202) * 18);
    for (let q = 1; q <= len; q++) {
      const k = kBottom - q;
      const [sx, sy] = scr(gi, gj, k);
      const leafy = q % 3 === 1;
      const m = leafy ? M.leaf : M.moss;
      stamp(R, sx, sy, gi + gj + k, m, NaN, side === 'l' ? m.l + 0.05 : NaN, side === 'r' ? m.l - 0.12 : NaN);
    }
  } else if (h < 0.1) {
    // root tendril
    const len = 3 + Math.floor(hash2(gi, gj, 203) * 9);
    for (let q = 1; q <= len; q++) {
      const k = kBottom - q;
      const [sx, sy] = scr(gi, gj, k);
      stamp(R, sx, sy, gi + gj + k, M.bark, NaN, side === 'l' ? M.bark.l : NaN, side === 'r' ? M.bark.l - 0.15 : NaN);
    }
  } else if (h < 0.13 && a % 2 === 0) {
    // stone stalactite nub
    for (let q = 1; q <= 2 + Math.floor(hash2(gi, gj, 204) * 3); q++) {
      const k = kBottom - q;
      const [sx, sy] = scr(gi, gj, k);
      stamp(R, sx, sy, gi + gj + k, M.stone, NaN, side === 'l' ? M.stone.l - 0.1 : NaN, side === 'r' ? M.stone.l - 0.28 : NaN);
    }
  }
}
