import { P } from './palette';
import { type RGBA, type Shade, bayer, hash2, noise2, rgb, shadeRamp, mix } from './pixel';

/** Base lightness per face so all materials share the same light. */
export const LIGHT = { top: 0.82, left: 0.58, right: 0.36 };
export type FaceKind = keyof typeof LIGHT;

export function flat(r: RGBA[], f: FaceKind, dither = 0.6): Shade {
  return (_s, _t, x, y) => shadeRamp(r, LIGHT[f], x, y, dither);
}

/** Horizontal planks with seams and per-plank tone variation. */
export function planks(f: FaceKind, boards = 4, seed = 1, r = P.wood, vertical = false): Shade {
  return (s, t, x, y) => {
    const a = vertical ? s : t;
    const b = vertical ? t : s;
    const k = Math.floor(a * boards);
    const local = a * boards - k;
    let l = LIGHT[f] + (hash2(k, seed) - 0.5) * 0.18;
    if (local < 1 / (boards * 3) + 0.04) l -= 0.3; // seam
    else if (local < 0.3) l += 0.06;
    if (hash2(k, Math.floor(b * 6), seed) > 0.86 && local > 0.4 && local < 0.6) l -= 0.15; // knot / grain
    return shadeRamp(r, l, x, y, 0.4);
  };
}

/** Running-bond brick/stone blocks. */
export function blocks(f: FaceKind, rows: number, cols: number, r: RGBA[], seed = 3, mortar?: RGBA): Shade {
  return (s, t, x, y) => {
    const row = Math.floor(t * rows);
    const off = row % 2 ? 0.5 / cols : 0;
    const cs = (s + off) * cols;
    const col = Math.floor(cs);
    const ls = cs - col, lt = t * rows - row;
    const gapS = 0.9 / Math.max(6, 64 / cols), gapT = 1.2 / Math.max(4, 32 / rows);
    if (ls < gapS || lt < gapT) return mortar ?? shadeRamp(r, LIGHT[f] - 0.42, x, y, 0);
    let l = LIGHT[f] + (hash2(col, row, seed) - 0.5) * 0.2;
    if (lt < gapT + 0.12) l += 0.08;
    return shadeRamp(r, l, x, y, 0.5);
  };
}

/** Riveted metal plate. */
export function metal(f: FaceKind, r = P.iron, rivets = true): Shade {
  return (s, t, x, y) => {
    let l = LIGHT[f] + (s < 0.08 || t < 0.08 ? 0.12 : 0) - (s > 0.92 || t > 0.92 ? 0.12 : 0);
    if (rivets && ((s > 0.1 && s < 0.18) || (s > 0.82 && s < 0.9)) && ((t > 0.1 && t < 0.18) || (t > 0.82 && t < 0.9))) l += 0.25;
    return shadeRamp(r, l, x, y, 0.3);
  };
}

export function glassShade(f: FaceKind, glow = 0): Shade {
  return (s, t, x, y) => {
    let l = LIGHT[f] * 0.9 + glow;
    const d = s + t;
    if (d > 0.35 && d < 0.5) l += 0.35;
    if (d > 0.62 && d < 0.68) l += 0.25;
    return shadeRamp(P.glass, l, x, y, 0.3);
  };
}

export function noisy(r: RGBA[], f: FaceKind, scale = 0.25, amp = 0.25, seed = 5): Shade {
  return (_s, _t, x, y) => shadeRamp(r, LIGHT[f] + (noise2(x * scale, y * scale, seed) - 0.5) * amp * 2, x, y, 0.6);
}

export function thatch(f: FaceKind): Shade {
  return (s, t, x, y) => {
    const l = LIGHT[f] + (hash2(Math.floor(s * 24), Math.floor(t * 5)) - 0.5) * 0.3 + (Math.floor(t * 5) % 2 ? -0.06 : 0.04);
    return shadeRamp(P.cream.length ? [rgb(0x6a4a24), rgb(0x8f6a32), rgb(0xb88d44), rgb(0xd9b15e), rgb(0xf0d488)] : P.wood, l, x, y, 0.4);
  };
}

export function emissive(c: RGBA, x: number, y: number, phase = 0): RGBA {
  return bayer(x, y) < 0.5 + 0.3 * Math.sin(phase) ? c : mix(c, rgb(0xffffff), 0.3);
}
