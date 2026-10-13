import { MAT, leafDisp } from '../mats';
import { hash3 } from '../noise';
import { type Mat, Model, sdRoof } from '../sdf';

/** Reusable building parts in tile units (footprint ±0.5, z up). */

export type V3 = [number, number, number];

/** Stone footing slab; `h` thick, `hw` half-width. */
export function plinth(m: Model, hw = 0.46, h = 0.05, mat: Mat = MAT.stone): void {
  m.box([0, 0, h / 2], [hw, hw, h / 2], mat, 0.015);
}

/** Wooden deck floor on a low stone rim. */
export function deckBase(m: Model, hw = 0.46): void {
  m.box([0, 0, 0.03], [hw, hw, 0.03], MAT.stone, 0.012);
  m.box([0, 0, 0.068], [hw - 0.03, hw - 0.03, 0.008], MAT.deck, 0.004);
}

/** Square post standing on z0 up to z1. */
export function post(m: Model, x: number, y: number, z0: number, z1: number, r = 0.032, mat: Mat = MAT.post): void {
  m.box([x, y, (z0 + z1) / 2], [r, r, (z1 - z0) / 2], mat, Math.min(0.01, r * 0.3));
}

/** Horizontal beam between two points (square section). */
export function beam(m: Model, a: V3, b: V3, r = 0.026, mat: Mat = MAT.beamX): void {
  m.capsule(a, b, r, mat);
}

/** Gable roof: ridge along `axis`, centred at c (eave height c[2]), with ridge beam and gable boards. */
export function gable(m: Model, c: V3, len: number, width: number, rise: number, axis: 'x' | 'y' = 'x', mat: Mat = MAT.roof): void {
  const rot: V3 | undefined = axis === 'y' ? [0, 0, Math.PI / 2] : undefined;
  m.add(sdRoof(len, width, rise / 2, 0), mat, [c[0], c[1], c[2] + rise / 2], [len, width, rise / 2], { rot });
  const ridge: V3 = [c[0], c[1], c[2] + rise + 0.01];
  const d: V3 = axis === 'x' ? [len + 0.02, 0, 0] : [0, len + 0.02, 0];
  m.capsule([ridge[0] - d[0], ridge[1] - d[1], ridge[2]], [ridge[0] + d[0], ridge[1] + d[1], ridge[2]], 0.022, MAT.beamX);
}

/** Lantern: glowing cage under a little iron cap. `hang` adds a bracket arm. */
export function lantern(m: Model, p: V3, s = 1): void {
  m.box([p[0], p[1], p[2]], [0.028 * s, 0.028 * s, 0.038 * s], MAT.lamp, 0.006);
  m.cone([p[0], p[1], p[2] + 0.052 * s], 0.042 * s, 0.01 * s, 0.016 * s, MAT.ironDark);
  m.box([p[0], p[1], p[2] - 0.044 * s], [0.034 * s, 0.034 * s, 0.006 * s], MAT.ironDark, 0.003);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box([p[0] + dx * 0.028 * s, p[1] + dy * 0.028 * s, p[2]], [0.005 * s, 0.005 * s, 0.04 * s], MAT.ironDark, 0.002);
}

/** Lantern on a wooden post with a hook arm. Returns the lamp position. */
export function lampPost(m: Model, x: number, y: number, h = 0.62): V3 {
  post(m, x, y, 0, h, 0.022);
  m.capsule([x, y, h - 0.02], [x, y + 0.09, h - 0.02], 0.012, MAT.beamY);
  const p: V3 = [x, y + 0.09, h - 0.1];
  m.capsule([p[0], p[1], h - 0.02], [p[0], p[1], p[2] + 0.06], 0.004, MAT.ironDark);
  lantern(m, p);
  return p;
}

export function barrel(m: Model, p: V3, r = 0.09, h = 0.22, mat: Mat = MAT.barrel): void {
  m.add((x, y, z) => {
    const t = z / (h / 2);
    const rr = r * (1 + 0.12 * (1 - t * t));
    const d = Math.sqrt(x * x + y * y) - rr;
    return Math.max(d, Math.abs(z) - h / 2);
  }, mat, [p[0], p[1], p[2] + h / 2], [r * 1.15, r * 1.15, h / 2]);
  for (const k of [0.18, 0.82]) m.torus([p[0], p[1], p[2] + h * k], r * 1.08, 0.008, MAT.ironDark);
  m.cyl([p[0], p[1], p[2] + h], r * 0.95, 0.006, MAT.barrelTop);
}

export function crate(m: Model, p: V3, s = 0.12, rot = 0): void {
  m.box([p[0], p[1], p[2] + s], [s, s, s], MAT.crate, 0.012, { rot: [0, 0, rot] });
  // cross braces on the visible faces
  const c = Math.cos(rot), sn = Math.sin(rot);
  for (const [fx, fy] of [[1, 0], [0, 1]]) {
    const nx = fx * c - fy * sn, ny = fx * sn + fy * c;
    const ox = p[0] + nx * (s + 0.004), oy = p[1] + ny * (s + 0.004);
    const tx = -ny, ty = nx;
    m.capsule([ox - tx * s * 0.85, oy - ty * s * 0.85, p[2] + 0.02], [ox + tx * s * 0.85, oy + ty * s * 0.85, p[2] + s * 2 - 0.02], 0.009, MAT.beamX);
  }
}

export function sack(m: Model, p: V3, s = 1, mat: Mat = MAT.burlap): void {
  m.blob([[p[0], p[1], p[2] + 0.06 * s, 0.07 * s], [p[0], p[1], p[2] + 0.12 * s, 0.05 * s]], 0.04 * s, mat);
  m.torus([p[0], p[1], p[2] + 0.145 * s], 0.025 * s, 0.008 * s, MAT.rope);
}

export function chimney(m: Model, p: V3, h: number, w = 0.07): void {
  m.box([p[0], p[1], p[2] + h / 2], [w, w, h / 2], MAT.brick, 0.008);
  m.box([p[0], p[1], p[2] + h + 0.015], [w + 0.015, w + 0.015, 0.018], MAT.stoneDark, 0.006);
  m.box([p[0], p[1], p[2] + h + 0.02], [w - 0.02, w - 0.02, 0.03], MAT.soot, 0.004);
}

/** Toothed gear in a plane perpendicular to `axis`. */
export function gear(m: Model, c: V3, r: number, th: number, axis: 'x' | 'y' | 'z', rot: number, teeth = 10, mat: Mat = MAT.brass): void {
  const tooth = r * 0.16;
  const shape = (x: number, y: number, z: number) => {
    const a = Math.atan2(y, x) + rot;
    const rr = r + tooth * (Math.cos(a * teeth) > 0 ? 1 : 0);
    const d = Math.sqrt(x * x + y * y);
    const ring = Math.max(d - rr, Math.abs(z) - th);
    // spokes cut-outs
    const inner = d < r * 0.72 && d > r * 0.25 && Math.cos((a - rot) * 4 + rot * 4) < 0.3 ? Math.max(r * 0.25 - d, d - r * 0.72) : -1;
    return inner > 0 ? Math.max(ring, inner) : ring;
  };
  const rotv: V3 | undefined = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : undefined;
  m.add(shape, mat, c, axis === 'x' ? [th, r + tooth, r + tooth] : axis === 'y' ? [r + tooth, th, r + tooth] : [r + tooth, r + tooth, th], { rot: rotv });
  m.cyl(c, r * 0.18, th + 0.008, MAT.ironDark, axis);
}

export function pipe(m: Model, pts: V3[], r = 0.022, mat: Mat = MAT.copper): void {
  for (let i = 0; i < pts.length - 1; i++) m.capsule(pts[i], pts[i + 1], r, mat);
  for (const p of pts.slice(1, -1)) m.sphere(p, r * 1.35, mat);
}

export function logPile(m: Model, p: V3, n = 3, len = 0.16, axis: 'x' | 'y' = 'x'): void {
  let k = 0;
  for (let row = 0; k < n; row++) {
    for (let i = 0; i < 3 - row && k < n; i++, k++) {
      const off = (i - (2 - row) / 2) * 0.075;
      const c: V3 = axis === 'x' ? [p[0], p[1] + off, p[2] + 0.036 + row * 0.064] : [p[0] + off, p[1], p[2] + 0.036 + row * 0.064];
      m.cyl(c, 0.036, len, axis === 'x' ? MAT.logX : MAT.logY, axis);
      m.cyl(axis === 'x' ? [c[0] + len, c[1], c[2]] : [c[0], c[1] + len, c[2]], 0.033, 0.003, MAT.logEnd, axis);
    }
  }
}

export function plankStack(m: Model, p: V3, n = 4, len = 0.2, axis: 'x' | 'y' = 'x'): void {
  for (let i = 0; i < n; i++) {
    const h: V3 = axis === 'x' ? [len, 0.06, 0.012] : [0.06, len, 0.012];
    m.box([p[0] + (axis === 'y' ? (i % 2) * 0.01 : 0), p[1] + (axis === 'x' ? (i % 2) * 0.01 : 0), p[2] + 0.013 + i * 0.026], h, axis === 'x' ? MAT.oak : MAT.oakY, 0.004);
  }
}

export function fence(m: Model, a: V3, b: V3, posts = 3): void {
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1);
    post(m, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0, 0.2, 0.018);
  }
  for (const z of [0.08, 0.16]) m.capsule([a[0], a[1], z], [b[0], b[1], z], 0.011, MAT.beamX);
}

/** Little leafy bush, optionally flowering. */
export function bush(m: Model, p: V3, r = 0.09, seed = 1, flowers?: Mat): void {
  m.blob([[p[0], p[1], p[2] + r * 0.7, r], [p[0] + r * 0.7, p[1] - r * 0.3, p[2] + r * 0.5, r * 0.75], [p[0] - r * 0.6, p[1] + r * 0.4, p[2] + r * 0.45, r * 0.7]], r * 0.4, MAT.leafDark, { disp: leafDisp(r * 0.25, seed), dispAmp: r * 0.25 });
  if (flowers) for (let i = 0; i < 5; i++) m.sphere([p[0] + (hash3(i, seed, 1) - 0.5) * r * 1.6, p[1] + (hash3(i, seed, 2) - 0.5) * r * 1.4, p[2] + r * (0.8 + hash3(i, seed, 3) * 0.7)], r * 0.13, flowers);
}

/** Moss/ivy creeping over a surface point. */
export function ivy(m: Model, pts: V3[], r = 0.025, seed = 0): void {
  for (let i = 0; i < pts.length - 1; i++) m.capsule(pts[i], pts[i + 1], r * 0.35, MAT.vine);
  pts.forEach((p, i) => m.sphere(p, r * (0.7 + hash3(i, seed, 1) * 0.6), MAT.vine));
}
