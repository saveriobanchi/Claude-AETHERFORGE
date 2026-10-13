import { cell, clamp, fbm, hash3, lin, mix, noise3, smoothstep, voronoi } from './noise';
import type { Hit, Mat, RGB } from './sdf';

/**
 * Illustrated materials: clean authored colours, gentle large-scale tone
 * shifts and only structural detail (plank seams, stone joints, shingle
 * rows). The renderer's two-tone shading and drawn lines do the rest.
 */

let nextId = 1;
type ColorFn = (h: Hit, out: RGB) => void;
type MatOpts = Partial<Omit<Mat, 'id' | 'color'>>;

export function mat(color: ColorFn, o: MatOpts = {}): Mat {
  return { id: nextId++, color, spec: 0, pow: 24, ...o };
}

const set = (out: RGB, c: RGB, k = 1) => { out[0] = c[0] * k; out[1] = c[1] * k; out[2] = c[2] * k; };
const lerp3 = (out: RGB, a: RGB, b: RGB, t: number) => { out[0] = mix(a[0], b[0], t); out[1] = mix(a[1], b[1], t); out[2] = mix(a[2], b[2], t); };

/** Lighten a hex colour toward warm cream. */
export function lighten(hex: number, k: number): number {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const f = (c: number, t: number) => Math.round(c + (t - c) * k);
  return (f(r, 0xff) << 16) | (f(g, 0xf0) << 8) | f(b, 0xc8);
}

/** Darken a hex colour toward a deep warm violet. */
export function darken(hex: number, k: number): number {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const f = (c: number, t: number) => Math.round(c * k + t * (1 - k) * 0.6);
  return (f(r, 0x3a) << 16) | (f(g, 0x24) << 8) | f(b, 0x3a);
}

/** Flat colour with a soft, large-scale tone drift. */
export function flat(hex: number, o: MatOpts = {}, vary = 0.05, scale = 2.5): Mat {
  const c = lin(hex);
  return mat((h, out) => set(out, c, 1 + noise3(h.x * scale, h.y * scale, h.z * scale) * vary), o);
}

/** Two-colour vertical gradient (lighter toward the top). */
export function gradient(lo: number, hi: number, z0: number, z1: number, o: MatOpts = {}): Mat {
  const a = lin(lo), b = lin(hi);
  return mat((h, out) => lerp3(out, a, b, clamp((h.z - z0) / (z1 - z0))), o);
}

/** Planks: boards along `axis`, `w` wide across `across`, with clean seams and per-board tone. */
export function planks(hex: number, axis: 'x' | 'y' | 'z' = 'x', w = 0.11, across: 'x' | 'y' | 'z' = 'z', o: MatOpts = {}): Mat {
  const base = lin(hex), seamC = lin(darken(hex, 0.45)), grainC = lin(darken(hex, 0.78)), hiC = lin(lighten(hex, 0.18));
  const pick = (h: { lx: number; ly: number; lz: number }, a: string) => (a === 'x' ? h.lx : a === 'y' ? h.ly : h.lz);
  const seam = (along: number, acr: number) => {
    const b = acr / w, f = b - Math.floor(b), board = Math.floor(b);
    const jl = 0.45 + hash3(board, 3, 9) * 0.5;
    const g = (along + hash3(board, 1, 2) * 3) / jl, gf = g - Math.floor(g);
    return Math.min(smoothstep(0, 0.09, f), smoothstep(0, 0.015, gf) * smoothstep(1, 0.985, gf));
  };
  return mat((h, out) => {
    const al = pick(h, axis), ac = pick(h, across);
    const board = Math.floor(ac / w);
    const tone = 0.86 + hash3(board, 7, 1) * 0.26;
    // grain: thin wavy streaks along the board
    const gr = Math.sin((ac + noise3(al * 4, board, 1) * 0.02) * 260 + board * 5);
    lerp3(out, base, grainC, smoothstep(0.55, 0.95, gr) * 0.6);
    // top edge of each board catches light
    const fb = ac / w - board;
    lerp3(out, out, hiC, smoothstep(0.75, 0.95, fb) * 0.5);
    lerp3(out, seamC, out, seam(al, ac));
    // knots and nail heads
    if (voronoi(al * 9 + board * 3.1, board * 1.7, 2) < 0.07) lerp3(out, out, seamC, 0.6);
    out[0] *= tone; out[1] *= tone; out[2] *= tone;
  }, { bump: (x, y, z) => { const al = axis === 'x' ? x : axis === 'y' ? y : z, ac = across === 'x' ? x : across === 'y' ? y : z; return seam(al, ac) * 0.008; }, bumpAmp: 1, ...o });
}

/** Smooth wood for posts, beams and logs. */
export function log(hex: number, o: MatOpts = {}): Mat {
  const base = lin(hex), dark = lin(darken(hex, 0.7));
  return mat((h, out) => {
    const s = Math.sin(Math.atan2(h.ly, h.lx) * 9 + noise3(h.lx * 6, h.ly * 6, h.lz * 6) * 2.5);
    lerp3(out, base, dark, smoothstep(0.5, 1, s) * 0.55);
  }, o);
}

export function bark(hex = 0x6e4a30): Mat {
  const base = lin(hex), dark = lin(darken(hex, 0.55)), hi = lin(lighten(hex, 0.2)), moss = lin(0x5a7a32);
  return mat((h, out) => {
    const a = Math.atan2(h.y, h.x);
    const r = Math.sin(a * 11 + h.z * 4 + noise3(h.x * 6, h.y * 6, h.z * 3) * 3);
    lerp3(out, base, dark, smoothstep(0.35, 0.9, r));
    lerp3(out, out, hi, smoothstep(-0.95, -0.6, r) * 0.5);
    lerp3(out, out, moss, smoothstep(0.3, 0.7, noise3(h.x * 5, h.y * 5, h.z * 5) + h.gz * 0.3) * 0.45 * smoothstep(0.6, 0.1, h.z));
  }, { bump: (x, y, z) => Math.sin(Math.atan2(y, x) * 11 + z * 4) * 0.01, bumpAmp: 1 });
}

/** Cut-stone masonry: clean blocks, mortar lines, per-block tone. */
export function masonry(hex = 0x9a8c7c, course = 0.13, blockLen = 0.22, o: MatOpts = {}): Mat {
  const base = lin(hex), mortar = lin(darken(hex, 0.42)), hi = lin(lighten(hex, 0.15)), moss = lin(0x5f8a34);
  const joint = (x: number, y: number, z: number) => {
    const row = Math.floor(z / course), fz = z / course - row;
    const along = (x + y) / blockLen + (row % 2) * 0.5 + hash3(row, 4, 4) * 0.4;
    const fa = along - Math.floor(along);
    return Math.min(smoothstep(0, 0.1, fz), smoothstep(0, 0.05, fa) * smoothstep(1, 0.95, fa));
  };
  return mat((h, out) => {
    const row = Math.floor(h.lz / course);
    const along = Math.floor((h.lx + h.ly) / blockLen + (row % 2) * 0.5 + hash3(row, 4, 4) * 0.4);
    const tone = 0.84 + hash3(row, along, 5) * 0.3;
    const j = joint(h.lx, h.ly, h.lz);
    set(out, base, tone * (0.95 + noise3(h.x * 12, h.y * 12, h.z * 12) * 0.06));
    // chipped top edge highlight and a few cracks
    const fz = h.lz / course - row;
    lerp3(out, out, hi, smoothstep(0.8, 0.95, fz) * 0.5);
    if (Math.abs(noise3(h.x * 14 + along, h.y * 14, h.z * 14)) < 0.03) lerp3(out, out, mortar, 0.7);
    lerp3(out, mortar, out, j);
    // moss creeping in the joints near the ground
    lerp3(out, out, moss, (1 - j) * smoothstep(0.1, 0.5, noise3(h.x * 6, h.y * 6, h.z * 6) + 0.3 - h.lz) * 0.8);
  }, { bump: (x, y, z) => joint(x, y, z) * 0.01, bumpAmp: 1, ...o });
}

export function brick(hex = 0xb85c3c): Mat {
  return masonry(hex, 0.07, 0.15);
}

/** Stylised rock: big faceted chunks with a tone per facet, moss on top-facing parts. */
export function rock(hex = 0x9c8a78, mossy = 0.7): Mat {
  const base = lin(hex), dark = lin(darken(hex, 0.6)), hi = lin(lighten(hex, 0.18)), moss = lin(0x5c8a34), mossHi = lin(0x8ab84a);
  return mat((h, out) => {
    const f1 = voronoi(h.x * 4, h.y * 4, h.z * 3);
    const edge = cell.f2 - f1;
    const id = cell.id;
    lerp3(out, dark, base, 0.6 + id * 0.4);
    lerp3(out, out, hi, smoothstep(0.4, 0.9, h.gz * 0.5 + noise3(h.x * 20, h.y * 20, h.z * 20) * 0.5) * 0.4);
    lerp3(out, out, dark, smoothstep(0.08, 0.0, edge) * 0.8);
    const speck = noise3(h.x * 45, h.y * 45, h.z * 45);
    if (speck > 0.45) lerp3(out, out, hi, 0.35); else if (speck < -0.5) lerp3(out, out, dark, 0.35);
    if (mossy > 0) {
      const m = smoothstep(0.45, 0.75, h.gz + noise3(h.x * 5, h.y * 5, h.z * 5) * 0.35) * mossy;
      const mc: RGB = [0, 0, 0];
      lerp3(mc, moss, mossHi, clamp(0.5 + noise3(h.x * 40, h.y * 40, h.z * 40)));
      lerp3(out, out, mc, m);
    }
  }, { bump: (x, y, z) => { const f = voronoi(x * 4, y * 4, z * 3); return Math.min(0.02, (cell.f2 - f) * 0.06) + noise3(x * 25, y * 25, z * 25) * 0.003; }, bumpAmp: 1 });
}

/** Big cut-stone cliff blocks: two blocks per tile face per course, cracks, moss on ledges. */
export function stoneBlock(hex = 0x9a8e80, mossy = 0.8): Mat {
  const base = lin(hex), dark = lin(darken(hex, 0.5)), hi = lin(lighten(hex, 0.2)), moss = lin(0x4f7e30), mossHi = lin(0x86b444);
  return mat((h, out) => {
    const fz = (h.lz + 0.21) / 0.42;
    const along = (h.lx - h.ly) * 1.9 + 7.3;
    const fa = along - Math.floor(along);
    const id = hash3(Math.floor(along), Math.floor(h.z * 2.4), 3);
    set(out, base, 0.82 + id * 0.3);
    lerp3(out, out, hi, smoothstep(0.75, 0.98, fz) * 0.45);
    const speck = noise3(h.x * 50, h.y * 50, h.z * 50);
    if (speck > 0.4) lerp3(out, out, hi, 0.3); else if (speck < -0.45) lerp3(out, out, dark, 0.35);
    if (Math.abs(noise3(h.x * 10 + id * 9, h.y * 10, h.z * 10)) < 0.035) lerp3(out, out, dark, 0.8);
    lerp3(out, out, dark, (1 - smoothstep(0, 0.04, fa) * smoothstep(1, 0.96, fa)) * 0.85);
    const m = smoothstep(0.5, 0.8, h.gz + noise3(h.x * 6, h.y * 6, h.z * 6) * 0.3) + smoothstep(0.92, 1, fz) * smoothstep(0.1, 0.5, noise3(h.x * 8, h.y * 8, h.z * 3)) * 0.8;
    const mc: RGB = [0, 0, 0];
    lerp3(mc, moss, mossHi, clamp(0.5 + noise3(h.x * 40, h.y * 40, h.z * 40)));
    lerp3(out, out, mc, clamp(m) * mossy);
  });
}

/** Low-frequency displacement for rocks: chunky, not gritty. */
export const rockDisp = (amp: number, f = 3) => (x: number, y: number, z: number) => (voronoi(x * f, y * f, z * f * 0.8) - 0.45) * amp + noise3(x * f * 0.6, y * f * 0.6, z * f * 0.6) * amp * 0.5;

export function metal(hex: number, o: MatOpts = {}): Mat {
  return flat(hex, { spec: 0.9, pow: 50, ...o }, 0.04, 3);
}
export const copper = () => flat(0xd2804a, { spec: 0.9, pow: 50 }, 0.05);
export const gold = () => flat(0xf0bc4c, { spec: 1, pow: 60 }, 0.04);
export const brass = () => flat(0xcc9e4c, { spec: 0.9, pow: 50 }, 0.04);
export const iron = () => metal(0x707884);
export const ironDark = () => metal(0x4a4f5a, { spec: 0.6 });

/** Foliage: soft colour masses lit from above. */
export function foliage(hex = 0x4a8a34, hi = 0x9cc850, seed = 0): Mat {
  const base = lin(hex), light = lin(hi), deep = lin(0x173a34), mid = lin(darken(hex, 0.62));
  return mat((h, out) => {
    // leaf clusters: each cluster has its own tone and a lit upper rim
    const f1 = voronoi(h.x * 11 + seed, h.y * 11, h.z * 11);
    const id = cell.id, edge = cell.f2 - f1;
    lerp3(out, mid, base, 0.45 + id * 0.55);
    lerp3(out, out, light, clamp(h.gz * 0.9 + (id - 0.5) * 0.6 - 0.25) * 0.55);
    lerp3(out, out, deep, smoothstep(0.12, 0.0, edge) * 0.85);
    // individual leaves
    const leaf = noise3(h.x * 60 + seed, h.y * 60, h.z * 60);
    if (leaf > 0.35) lerp3(out, out, light, 0.3); else if (leaf < -0.4) lerp3(out, out, deep, 0.3);
  }, { sss: 0.22, bump: (x, y, z) => -voronoi(x * 11 + seed, y * 11, z * 11) * 0.02, bumpAmp: 1 });
}

/** Leaf displacement: rounded lumps so canopies read as clusters of leaves. */
export const leafDisp = (amp: number, seed = 0) => (x: number, y: number, z: number) => (voronoi(x * 6.5 + seed, y * 6.5, z * 6.5) - 0.5) * amp;

export function grass(): Mat {
  const a = lin(0x6aa53e), b = lin(0x8cc052);
  return mat((h, out) => lerp3(out, a, b, clamp(0.5 + noise3(h.x * 1.5, h.y * 1.5, 0.5) * 0.8)), { sss: 0.3 });
}

export function soil(): Mat {
  return flat(0x8a5e3c, {}, 0.06, 3);
}

export function cloth(hex = 0xeadcbc): Mat {
  return flat(hex, { sss: 0.3 }, 0.03, 3);
}

/** Roof shingles: rows along local x stacked by local z. */
export function shingles(hex = 0xc4603c, row = 0.06): Mat {
  const base = lin(hex), dark = lin(darken(hex, 0.45)), hi = lin(lighten(hex, 0.15)), moss = lin(0x6e8a3a);
  const f = (x: number, z: number) => {
    const r = Math.floor(z / row), fz = z / row - r;
    const col = x / 0.08 + (r % 2) * 0.5, fc = col - Math.floor(col);
    return { r, c: Math.floor(col), fz, edge: Math.min(smoothstep(0, 0.22, fz), smoothstep(0, 0.07, fc)) };
  };
  return mat((h, out) => {
    const q = f(h.lx, h.lz);
    const tone = 0.84 + hash3(q.r, q.c, 4) * 0.3;
    set(out, base, tone);
    lerp3(out, out, hi, smoothstep(0.7, 1, q.fz) * 0.4);
    lerp3(out, dark, out, q.edge);
    lerp3(out, out, moss, smoothstep(0.35, 0.7, noise3(h.x * 6, h.y * 6, h.z * 6)) * 0.4);
  }, { bump: (_x, _y, z) => { const r = z / row; return (r - Math.floor(r)) * 0.012; }, bumpAmp: 1 });
}

export function water(): Mat {
  const deep = lin(0x2f8cb4), shallow = lin(0x6cc8dc), foam = lin(0xe8f8fa);
  return mat((h, out) => {
    lerp3(out, deep, shallow, clamp(0.5 + noise3(h.x * 3, h.y * 3, h.t * 2) * 0.6));
    lerp3(out, out, foam, smoothstep(0.7, 0.85, noise3(h.x * 9, h.y * 9, h.t * 4)) * 0.7);
  }, { spec: 0.9, pow: 60, refl: 0.3 });
}

export function glass(hex = 0xbfe6ee): Mat {
  return flat(hex, { spec: 1.2, pow: 90, refl: 0.4 }, 0.02);
}

/** Emissive helpers (radiance in linear units; > 1 blooms). */
export function glow(hex: number, power = 2.2, flicker = 0, o: MatOpts = {}): Mat {
  const c = lin(hex);
  return mat((_h, out) => set(out, c, 0.9), {
    ...o,
    emit: (h, out) => {
      const f = flicker ? 1 + noise3(h.x * 8, h.y * 8, h.t * 6 + h.z * 3) * flicker : 1;
      set(out, c, power * f * 0.5);
    },
  });
}

export function fire(): Mat {
  const hot = lin(0xfff0a8), mid = lin(0xffa040), deep = lin(0xe0502a);
  return mat((_h, out) => set(out, deep, 0.6), {
    emit: (h, out) => {
      const n = fbm(h.x * 6, h.y * 6, h.z * 4 - h.t * 6.28, 2) * 0.5 + 0.5;
      const t = clamp(n * 1.2 - h.lz * 1.5 + 0.3);
      lerp3(out, deep, mid, clamp(t * 2));
      if (t > 0.5) lerp3(out, out, hot, (t - 0.5) * 2);
      out[0] *= 2.2; out[1] *= 2.2; out[2] *= 2.2;
    },
  });
}

export function crystal(hex = 0x7cc8ff): Mat {
  const c = lin(hex), core = lin(0xeaf8ff);
  return mat((h, out) => lerp3(out, c, core, clamp(0.3 + h.gz * 0.4)), {
    spec: 1.2, pow: 60,
    emit: (h, out) => { const k = 0.8 + 0.3 * Math.sin(h.t * 6.28 + h.z * 4); set(out, c, 0.7 * k); },
  });
}

export function plaster(hex = 0xf0e2c4): Mat {
  return flat(hex, {}, 0.03, 3);
}

/** Shared palette. */
export const MAT = {
  oak: planks(0xc08a52, 'x', 0.1, 'z'),
  oakY: planks(0xc08a52, 'y', 0.1, 'z'),
  deck: planks(0xcf9a5c, 'x', 0.09, 'y'),
  deckY: planks(0xcf9a5c, 'y', 0.09, 'x'),
  darkWood: planks(0x8a5a36, 'x', 0.12, 'z'),
  post: log(0x8e5e38),
  beamX: log(0x80522f),
  beamY: log(0x80522f),
  logX: log(0xa8723f),
  logY: log(0xa8723f),
  bark: bark(),
  stone: masonry(),
  stoneDark: masonry(0x8e8679),
  skystone: masonry(0xd4dce6, 0.15, 0.26),
  brick: brick(),
  rock: rock(),
  rockBare: rock(0xa08a74, 0),
  iron: iron(),
  ironDark: ironDark(),
  copper: copper(),
  brass: brass(),
  gold: gold(),
  leaf: foliage(),
  leafDark: foliage(0x3e7a34, 0x80b048, 3),
  grass: grass(),
  soil: soil(),
  cloth: cloth(),
  redCloth: cloth(0xc0483a),
  roof: shingles(),
  roofSlate: shingles(0x4f7aa0),
  water: water(),
  glass: glass(),
  fire: fire(),
  lamp: glow(0xffd27a, 2.6, 0.1),
  aether: glow(0x7ad8ff, 2.2, 0.15),
  crystal: crystal(),
  plaster: plaster(),
  rope: flat(0xd2b07a, {}, 0.04),
  clay: flat(0xd08a58, {}, 0.05),
  ink: flat(0x3a2c34, {}),
  amber: glow(0xffb444, 2, 0.1),
  star: glow(0xffe68a, 2.4, 0.2),
  flowerY: flat(0xffd450, { sss: 0.3 }, 0.03),
  flowerW: flat(0xfff6ea, { sss: 0.3 }, 0.03),
  flowerP: flat(0xf08ab4, { sss: 0.3 }, 0.03),
  flowerB: flat(0x8ea8f4, { sss: 0.3 }, 0.03),
  blade: flat(0x5f9e38, { sss: 0.5 }, 0.05),
  bladeLight: flat(0x92c652, { sss: 0.5 }, 0.05),
  blossom: flat(0xfff2f0, { sss: 0.4 }, 0.03),
  shaving: flat(0xf0c890, {}, 0.04),
  logEnd: flat(0xe8c48c, {}, 0.04),
  blade3: flat(0xc8d0d8, { spec: 1, pow: 60 }, 0.02),
  towerStone: masonry(0xd6cbb6, 0.12, 0.2),
  window: glow(0xffd88a, 1.6, 0.05),
  sail: flat(0xf4ead4, { sss: 0.4 }, 0.03),
  barrel: planks(0x9a6438, 'z', 0.06, 'x'),
  barrelTop: flat(0x7a4e2c, {}, 0.05),
  crate: planks(0xb07a44, 'x', 0.08, 'z'),
  burlap: flat(0xc8a878, { sss: 0.2 }, 0.08, 9),
  soot: flat(0x2a2224, {}, 0.05),
  compost: mat((h, out) => { const n = noise3(h.x * 40, h.y * 40, h.z * 40); set(out, lin(0x4a3424), 0.85 + n * 0.3); if (n > 0.45) set(out, lin(0x7a8a3a)); }),
  autumn: foliage(0xb86a2a, 0xe8a844, 5),
  mesh: mat((h, out) => { const g = (Math.abs(Math.sin(h.lx * 160)) < 0.25 || Math.abs(Math.sin(h.ly * 160)) < 0.25) ? 1 : 0; set(out, lin(g ? 0x9aa2aa : 0x3a3430)); }),
  pebble: mat((h, out) => { voronoi(h.x * 40, h.y * 40, h.z * 40); set(out, lin(0x8e8478), 0.7 + cell.id * 0.5); }),
  net: mat((h, out) => { const u = (h.x - h.y) * 50, v = h.z * 50; const g = Math.abs(Math.sin(u)) < 0.3 || Math.abs(Math.sin(v)) < 0.3; set(out, lin(g ? 0xe8dcc0 : 0x6a8a9a), g ? 1 : 0.5); }, { sss: 0.3 }),
  waterDrop: flat(0x9ad8f0, { spec: 1, pow: 60 }, 0.02),
  burlapDark: flat(0xa0805a, { sss: 0.2 }, 0.08, 9),
  logWall: planks(0x8e5e36, 'x', 0.07, 'z'),
  roofGreen: shingles(0x4e7a5a),
  roofBlue: shingles(0x4a6a96),
  millstone: masonry(0x9a958c, 0.5, 0.6),
  leather: flat(0x7a4a30, {}, 0.08, 8),
  glassDark: flat(0x2c4250, { spec: 1, pow: 80, refl: 0.4 }, 0.03),
  mist: glow(0x9ad8ff, 1.4, 0.3),
  cloud: flat(0xf4f6fa, { sss: 0.5 }, 0.03),
  flask: glow(0x7ad0ff, 1.8, 0.2, { spec: 1, pow: 60 }),
  darkPost: log(0x5a3c26),
  molten: glow(0xffb03a, 2.4, 0.3),
  ingotHot: glow(0xff8a3a, 1.6, 0.1),
  spark: glow(0xffd070, 3, 0.2),
  nest: planks(0x8a6a40, 'z', 0.03, 'x'),
  grain: flat(0xe8c060, {}, 0.05),
  seedHead: flat(0xe8d49a, { sss: 0.3 }, 0.05),
  ironOre: flat(0x6a7488, { spec: 0.8, pow: 40 }, 0.05),
  foam: flat(0xeaf8fa, {}, 0.02),
  starShard: crystal(0xffd86a),
  cliffRock: stoneBlock(0x8a7c70, 0.6),
  fall: mat((h, out) => { const s2 = Math.sin(h.lx * 90 + noise3(h.lx * 20, h.lz * 4 - h.t * 6, 0) * 3); set(out, lin(s2 > 0.4 ? 0xf4fcff : 0x8ad0ee)); }, { emit: (_h, out) => { out[0] = 0.05; out[1] = 0.1; out[2] = 0.14; } }),
  sand: mat((h, out) => { const n = noise3(h.x * 50, h.y * 50, h.z * 50); set(out, lin(0xe2c48a), 0.9 + n * 0.2); }),
  charcoal: flat(0x2e2a2c, { spec: 0.5, pow: 30 }, 0.1, 20),
  brickSolid: flat(0xb85c3c, {}, 0.06, 10),
  paper: flat(0xf2e6c8, {}, 0.03),
  vine: foliage(0x3a6e2c, 0x6c9c3c, 11),
  berry: flat(0xd8424a, { spec: 0.6, pow: 40 }, 0.03),
};
