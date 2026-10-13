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
  const base = lin(hex), seamC = lin(darken(hex, 0.55));
  const pick = (h: { lx: number; ly: number; lz: number }, a: string) => (a === 'x' ? h.lx : a === 'y' ? h.ly : h.lz);
  const seam = (along: number, acr: number) => {
    const b = acr / w, f = b - Math.floor(b), board = Math.floor(b);
    const jl = 0.5 + hash3(board, 3, 9) * 0.5;
    const g = (along + hash3(board, 1, 2) * 3) / jl, gf = g - Math.floor(g);
    return Math.min(smoothstep(0, 0.07, f), smoothstep(0, 0.012, gf) * smoothstep(1, 0.988, gf));
  };
  return mat((h, out) => {
    const al = pick(h, axis), ac = pick(h, across);
    const board = Math.floor(ac / w);
    const tone = 0.92 + hash3(board, 7, 1) * 0.16;
    lerp3(out, seamC, base, seam(al, ac));
    out[0] *= tone; out[1] *= tone; out[2] *= tone;
  }, { bump: (x, y, z) => { const al = axis === 'x' ? x : axis === 'y' ? y : z, ac = across === 'x' ? x : across === 'y' ? y : z; return seam(al, ac) * 0.006; }, bumpAmp: 1, ...o });
}

/** Smooth wood for posts, beams and logs. */
export function log(hex: number, o: MatOpts = {}): Mat {
  return flat(hex, o, 0.06, 3);
}

export function bark(hex = 0x7a5236): Mat {
  const base = lin(hex), dark = lin(darken(hex, 0.7));
  return mat((h, out) => {
    const a = Math.atan2(h.y, h.x);
    const s = Math.sin(a * 7 + h.z * 3 + noise3(h.x * 3, h.y * 3, h.z * 2) * 2);
    lerp3(out, dark, base, smoothstep(-0.6, 0.2, s));
  });
}

/** Cut-stone masonry: clean blocks, mortar lines, per-block tone. */
export function masonry(hex = 0xb2a898, course = 0.13, blockLen = 0.22, o: MatOpts = {}): Mat {
  const base = lin(hex), mortar = lin(darken(hex, 0.55));
  const joint = (x: number, y: number, z: number) => {
    const row = Math.floor(z / course), fz = z / course - row;
    const along = (x + y) / blockLen + (row % 2) * 0.5;
    const fa = along - Math.floor(along);
    return Math.min(smoothstep(0, 0.08, fz), smoothstep(0, 0.05, fa) * smoothstep(1, 0.95, fa));
  };
  return mat((h, out) => {
    const row = Math.floor(h.lz / course);
    const along = Math.floor((h.lx + h.ly) / blockLen + (row % 2) * 0.5);
    const tone = 0.9 + hash3(row, along, 5) * 0.18;
    lerp3(out, mortar, base, joint(h.lx, h.ly, h.lz));
    out[0] *= tone; out[1] *= tone; out[2] *= tone;
  }, { bump: (x, y, z) => joint(x, y, z) * 0.008, bumpAmp: 1, ...o });
}

export function brick(hex = 0xb85c3c): Mat {
  return masonry(hex, 0.07, 0.15);
}

/** Stylised rock: big faceted chunks with a tone per facet, moss on top-facing parts. */
export function rock(hex = 0xa08a74, mossy = 0.7): Mat {
  const base = lin(hex), dark = lin(darken(hex, 0.78)), moss = lin(0x6f9e3c);
  return mat((h, out) => {
    voronoi(h.x * 3.2, h.y * 3.2, h.z * 2.2);
    lerp3(out, dark, base, 0.55 + cell.id * 0.45);
    const band = Math.sin(h.z * 9 + noise3(h.x * 1.5, h.y * 1.5, 0) * 2) > 0.55 ? 0.9 : 1;
    out[0] *= band; out[1] *= band; out[2] *= band;
    if (mossy > 0) lerp3(out, out, moss, smoothstep(0.55, 0.8, h.gz + noise3(h.x * 4, h.y * 4, h.z * 4) * 0.25) * mossy);
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
export function foliage(hex = 0x5f9c3a, hi = 0x9ccc54, seed = 0): Mat {
  const base = lin(hex), light = lin(hi), deep = lin(0x2f6448);
  return mat((h, out) => {
    const n = noise3(h.x * 2.5 + seed, h.y * 2.5, h.z * 2.5);
    lerp3(out, deep, base, clamp(0.75 + n * 0.5));
    lerp3(out, out, light, clamp(h.gz * 0.7 + n * 0.3 - 0.15) * 0.55);
  }, { sss: 0.6 });
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
export function shingles(hex = 0xc4603c, row = 0.07): Mat {
  const base = lin(hex), dark = lin(darken(hex, 0.6));
  const f = (x: number, z: number) => {
    const r = Math.floor(z / row), fz = z / row - r;
    const col = x / 0.1 + (r % 2) * 0.5, fc = col - Math.floor(col);
    return { r, c: Math.floor(col), edge: Math.min(smoothstep(0, 0.18, fz), smoothstep(0, 0.06, fc)) };
  };
  return mat((h, out) => {
    const q = f(h.lx, h.lz);
    const tone = 0.92 + hash3(q.r, q.c, 4) * 0.16;
    lerp3(out, dark, base, q.edge);
    out[0] *= tone; out[1] *= tone; out[2] *= tone;
  }, { bump: (_x, _y, z) => { const r = z / row; return (r - Math.floor(r)) * 0.01; }, bumpAmp: 1 });
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
  leafDark: foliage(0x4e8a36, 0x86b84a, 3),
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
  berry: flat(0xd8424a, { spec: 0.6, pow: 40 }, 0.03),
};
