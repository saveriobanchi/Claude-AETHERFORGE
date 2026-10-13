import type { Tile } from '../../core/state';
import { P } from './palette';
import { type RGBA, PixelCanvas, bayer, hash2, mix, noise2, rgb, shadeRamp } from './pixel';

export const TILE_W = 64;
export const TILE_H = 32;
export const CHUNK = 8;
export const CHUNK_DEPTH = 360; // extra pixels below for undersides
export const CHUNK_W = (CHUNK * 2 - 1) * 32 + 64 + 2;
export const CHUNK_H = (CHUNK * 2 - 2) * 16 + 32 + CHUNK_DEPTH;

export type TileLookup = (x: number, y: number) => Tile | undefined;

/** World-screen position of a tile centre. */
export function tileCenter(x: number, y: number): [number, number] {
  return [(x - y) * 32, (x + y) * 16];
}

/** Chunk canvas top-left in world-screen coordinates. */
export function chunkOrigin(cx: number, cy: number): [number, number] {
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  return [(x0 - (y0 + CHUNK - 1)) * 32 - 32 - 1, (x0 + y0) * 16 - 16];
}

/** How much land lies behind a corner along the view diagonal (drives underside depth). */
function thickness(get: TileLookup, x: number, y: number): number {
  let n = 0;
  for (let i = 1; i <= 7; i++) if (get(x - i, y - i)) n++; else break;
  let m = 0;
  for (let i = 1; i <= 7; i++) if (get(x - i, y) && get(x, y - i)) m++; else break;
  return n * 0.7 + m * 0.5;
}

function cornerDepth(get: TileLookup, cx: number, cy: number): number {
  // corner (cx, cy) is shared by tiles (cx-1,cy-1),(cx,cy-1),(cx-1,cy),(cx,cy)
  const t = Math.max(thickness(get, cx - 1, cy - 1), thickness(get, cx, cy - 1), thickness(get, cx - 1, cy));
  return 10 + Math.min(92, t * 13) + noise2(cx * 0.9, cy * 0.9, 77) * 12;
}

// ───────────────────────── tops ─────────────────────────

function grassTop(t: Tile, u: number, v: number, wx: number, wy: number, get: TileLookup, bloom: boolean): RGBA {
  const n = noise2(wx / 12, wy / 6, 3) * 0.6 + noise2(wx / 5, wy / 2.5, 9) * 0.4;
  let l = 0.6 + (n > 0.64 ? 0.07 : n < 0.36 ? -0.07 : 0);
  // rim light on exposed back edges, slight darkening on exposed front edges
  const backL = !get(t.x - 1, t.y), backR = !get(t.x, t.y - 1);
  const frontR = !get(t.x + 1, t.y), frontL = !get(t.x, t.y + 1);
  const eu0 = u * 32, ev0 = v * 32, eu1 = (1 - u) * 32, ev1 = (1 - v) * 32;
  if ((backL && eu0 < 1.1) || (backR && ev0 < 1.1)) l += 0.28;
  else if ((backL && eu0 < 2.4) || (backR && ev0 < 2.4)) l += 0.1;
  if ((frontR && eu1 < 1.2) || (frontL && ev1 < 1.2)) l += 0.16;
  const h = hash2(wx, wy, t.seed & 7);
  const base = shadeRamp(P.grass, l, wx, wy, 0.08);
  // blades: a lighter tip above a darker root
  if (h > 0.965) return P.grass[Math.min(5, 4 + (h > 0.99 ? 1 : 0))];
  if (hash2(wx, wy + 1, t.seed & 7) > 0.965) return P.grass[2];
  // flowers
  const fh = hash2(Math.floor(wx / 2), Math.floor(wy / 2), 41);
  const fl = bloom ? 0.975 : 0.995;
  if (fh > fl && noise2(wx / 20, wy / 12, 13) > 0.55) {
    const fc = P.flower[Math.floor(hash2(Math.floor(wx / 2), Math.floor(wy / 2), 42) * P.flower.length)];
    return (wx + wy) % 2 ? fc : mix(fc, rgb(0xffffff), 0.3);
  }
  return base;
}

function stoneTop(t: Tile, u: number, v: number, wx: number, wy: number, get: TileLookup): RGBA {
  // 2×2 slabs per tile, grout between, worn edges
  const su = u * 2, sv = v * 2;
  const iu = Math.floor(su), iv = Math.floor(sv);
  const fu = su - iu, fv = sv - iv;
  const g = 0.055;
  const seed = hash2(t.x * 2 + iu, t.y * 2 + iv, 17);
  if (fu < g || fv < g) return shadeRamp(P.flag, 0.22, wx, wy, 0);
  let l = 0.62 + (seed - 0.5) * 0.22 + (noise2(wx / 6, wy / 4, 21) - 0.5) * 0.12;
  if (fu < g + 0.07 || fv < g + 0.07) l += 0.12;
  if (fu > 1 - 0.07 || fv > 1 - 0.07) l -= 0.1;
  const backL = !get(t.x - 1, t.y), backR = !get(t.x, t.y - 1);
  if ((backL && u * 32 < 1.1) || (backR && v * 32 < 1.1)) l += 0.25;
  // moss in cracks near grass
  const mossy = noise2(wx / 9, wy / 6, 31) > 0.72 && hash2(wx, wy, 33) > 0.6;
  if (mossy && (fu < g + 0.1 || fv < g + 0.1)) return shadeRamp(P.moss, 0.6, wx, wy, 0.5);
  return shadeRamp(P.flag, l, wx, wy, 0.4);
}

function skyTop(t: Tile, u: number, v: number, wx: number, wy: number, get: TileLookup): RGBA {
  const n = noise2(wx / 10, wy / 5, 51);
  const vein = Math.abs(noise2(wx / 26, wy / 13, 53) - 0.5) < 0.016 && noise2(wx / 40, wy / 20, 57) > 0.45;
  let l = 0.62 + n * 0.2;
  const backL = !get(t.x - 1, t.y), backR = !get(t.x, t.y - 1);
  if ((backL && u * 32 < 1.1) || (backR && v * 32 < 1.1)) l += 0.25;
  if (vein) return bayer(wx, wy) > 0.3 ? P.aether[4] : P.aether[5];
  const iu = Math.floor(u * 2), iv = Math.floor(v * 2);
  if ((u * 2 - iu) < 0.04 || (v * 2 - iv) < 0.04) return shadeRamp(P.stone, 0.45, wx, wy, 0);
  return mix(shadeRamp(P.stone, l, wx, wy, 0.5), P.aether[4], 0.12);
}

// ───────────────────────── faces / underside ─────────────────────────

/** Chunky boulder texture: jittered cells, lit from the upper left, dark cracks. */
function boulder(wx: number, wy: number, seed: number): { l: number; crack: boolean } {
  const sx = wx / 11 + noise2(wx / 9, wy / 9, seed + 7) * 0.6, sy = wy / 6.5;
  const ix = Math.floor(sx), iy = Math.floor(sy);
  let best = 9, second = 9, bx = 0, by = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i + hash2(ix + i, iy + j, seed), cy = iy + j + hash2(ix + i, iy + j, seed + 1);
    const d = (sx - cx) * (sx - cx) + (sy - cy) * (sy - cy);
    if (d < best) { second = best; best = d; bx = sx - cx; by = sy - cy; } else if (d < second) second = d;
  }
  const edge = Math.sqrt(second) - Math.sqrt(best);
  return { l: -bx * 0.3 - by * 0.45, crack: edge < 0.07 };
}

function faceColor(floor: Tile['floor'], z: number, depth: number, side: 'left' | 'right', wx: number, wy: number): RGBA {
  const lit = side === 'left' ? 0.06 : -0.12;
  const deep = z / Math.max(1, depth);
  if (floor === 'grass') {
    if (z < 2) return shadeRamp(P.grass, 0.38 + lit, wx, wy, 0.4);
    if (z < 3 && hash2(wx, 7) > 0.4) return shadeRamp(P.grass, 0.18 + lit, wx, wy, 0.4);
  } else if (floor === 'stone') {
    if (z < 4) return shadeRamp(P.flag, (z < 1 ? 0.55 : 0.4) + lit, wx, wy, 0.3);
  } else if (z < 4) {
    return mix(shadeRamp(P.stone, 0.5 + lit, wx, wy, 0.3), P.aether[3], 0.25);
  }
  if (z < 10) {
    const band = noise2(wx / 7, z / 2.5, 61);
    return shadeRamp(P.soil, 0.62 + lit + (band - 0.5) * 0.35 - (z < 4 ? 0.12 : 0), wx, wy, 0.5);
  }
  // boulders, darker and hazier with depth
  const b = boulder(wx, wy + z, floor === 'sky' ? 211 : 201);
  let l = 0.58 + lit + b.l * 0.5 - deep * 0.5;
  if (b.crack) l -= 0.32;
  const r = floor === 'sky' ? P.rock : (deep < 0.3 && noise2(wx / 9, (wy + z) / 6, 69) > 0.62 ? P.soil : P.rock);
  let col = shadeRamp(r, l, wx, wy, 0.25);
  if (floor === 'sky') {
    if (hash2(wx, wy + z, 71) > 0.988) return P.aether[5];
    col = mix(col, P.aether[1], 0.28);
  }
  // atmospheric haze toward the bottom
  return mix(col, rgb(0x2c6470), Math.max(0, deep - 0.45) * 0.55);
}

/**
 * Draw one exposed front face of tile t. side 'left' = the +y edge
 * (left vertex → bottom vertex), 'right' = the +x edge (right → bottom).
 */
function drawFace(c: PixelCanvas, t: Tile, side: 'left' | 'right', ox: number, oy: number, get: TileLookup): void {
  const [sx, sy] = tileCenter(t.x, t.y);
  const cx = sx - ox, cy = sy - oy;
  // edge endpoints in canvas space and corner depths
  const a: [number, number] = side === 'left' ? [cx - 32, cy] : [cx + 32, cy];
  const b: [number, number] = [cx, cy + 16];
  const da = side === 'left' ? cornerDepth(get, t.x, t.y + 1) : cornerDepth(get, t.x + 1, t.y);
  const db = cornerDepth(get, t.x + 1, t.y + 1);
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
  for (let x = x0; x < x1; x++) {
    const s = (x + 0.5 - a[0]) / (b[0] - a[0]);
    const top = a[1] + (b[1] - a[1]) * s;
    const wx = x + ox;
    let depth = da + (db - da) * s;
    depth += (noise2(wx / 3, t.seed & 15, 81) - 0.5) * 6 + (hash2(wx, 83) > 0.8 ? -2 : 0);
    // stalactite tips
    if (noise2(wx / 4.5, 87) > 0.72) depth += (noise2(wx / 4.5, 87) - 0.72) * 60;
    const ytop = Math.floor(top);
    const ybot = Math.floor(top + depth);
    for (let y = ytop; y <= ybot; y++) {
      if (c.alpha(x, y) === 255 && y < ytop + 1) continue;
      const z = y - top;
      let col = faceColor(t.floor, Math.max(0, z), depth, side, wx, y + oy);
      if (y >= ybot - 1) col = mix(col, rgb(0x0e0c16), 0.45);
      c.set(x, y, col);
    }
    // hanging roots and vines
    const hv = hash2(wx, t.seed & 255, 91);
    if (t.floor !== 'sky' && hv > 0.93) {
      const len = 5 + Math.floor(hash2(wx, 92) * 16);
      const vine = hash2(wx, 93) > 0.45;
      let vx = x;
      for (let k = 0; k < len; k++) {
        const y = ybot + 1 + k;
        if (k > 2 && hash2(wx, k, 94) > 0.8) vx += hash2(wx, k, 95) > 0.5 ? 1 : -1;
        const fade = k > len - 3;
        if (vine) {
          c.set(vx, y, fade ? P.leaf[1] : P.leaf[2]);
          if (k % 3 === 1) c.set(vx + (k % 2 ? 1 : -1), y, P.leaf[3]);
        } else c.set(vx, y, fade ? P.soil[1] : P.soil[2]);
      }
    } else if (t.floor === 'sky' && hv > 0.95) {
      // drifting aether motes beneath skystone
      c.set(x, ybot + 3 + Math.floor(hash2(wx, 97) * 8), P.aether[4]);
    }
  }
}

/** Rasterise one terrain chunk. Returns null when the chunk has no tiles. */
export function renderChunk(get: TileLookup, chunkX: number, chunkY: number, bloom = false): PixelCanvas | null {
  const tiles: Tile[] = [];
  for (let y = chunkY * CHUNK; y < chunkY * CHUNK + CHUNK; y++) {
    for (let x = chunkX * CHUNK; x < chunkX * CHUNK + CHUNK; x++) {
      const t = get(x, y);
      if (t) tiles.push(t);
    }
  }
  if (!tiles.length) return null;
  const c = new PixelCanvas(CHUNK_W, CHUNK_H);
  const [ox, oy] = chunkOrigin(chunkX, chunkY);
  tiles.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
  for (const t of tiles) {
    if (!get(t.x, t.y + 1)) drawFace(c, t, 'left', ox, oy, get);
    if (!get(t.x + 1, t.y)) drawFace(c, t, 'right', ox, oy, get);
  }
  // tops: exact per-pixel partition of the iso plane
  const ymax = (CHUNK * 2 - 2) * 16 + 32 + 1;
  for (let py = 0; py < ymax; py++) {
    for (let px = 0; px < CHUNK_W; px++) {
      const wx = px + ox, wy = py + oy;
      const fx = (wx + 0.5) / 64 + (wy + 0.5) / 32;
      const fy = (wy + 0.5) / 32 - (wx + 0.5) / 64;
      const tx = Math.floor(fx + 0.5), ty = Math.floor(fy + 0.5);
      if (tx < chunkX * CHUNK || tx >= chunkX * CHUNK + CHUNK || ty < chunkY * CHUNK || ty >= chunkY * CHUNK + CHUNK) continue;
      const t = get(tx, ty);
      if (!t) continue;
      const u = fx + 0.5 - tx, v = fy + 0.5 - ty;
      let col: RGBA;
      if (t.floor === 'grass') col = grassTop(t, u, v, wx, wy, get, bloom);
      else if (t.floor === 'stone') col = stoneTop(t, u, v, wx, wy, get);
      else col = skyTop(t, u, v, wx, wy, get);
      c.set(px, py, col);
    }
  }
  return c;
}
