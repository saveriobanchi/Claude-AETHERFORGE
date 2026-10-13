import { PixelCanvas, type RGBA, hash2, bayer, mix, rgb } from '../art/pixel';

/**
 * Voxel art engine. Objects are built from small cubes (2 iso units = one
 * "texel", 16 per tile edge, like a 16×16 block texture) and rendered with a
 * 4×4 isometric stamp, a depth buffer, per-face light, ambient occlusion and
 * rim highlights. Everything in the world shares this one texel density.
 */

export const V = 2; // voxel edge in iso units (and in vertical pixels)

export interface Mat {
  ramp: RGBA[];
  /** base lightness 0..1 */
  l: number;
  /** random per-voxel variation amplitude */
  v?: number;
  /** ignores light and AO */
  glow?: boolean;
  /** extra dithering */
  d?: number;
}

/** Light: top brightest, the +v face (screen-left) mid, the +u face (screen-right) dark. */
const FACE = { top: 0.16, left: 0, right: -0.2 };

export class Vol {
  readonly w: number;
  readonly d: number;
  readonly h: number;
  /** material id + 1 (0 = empty) */
  readonly m: Uint8Array;
  /** per-voxel lightness tweak (-128..127 → ×1/100) */
  readonly t: Int8Array;
  mats: Mat[] = [];
  private matIds = new Map<Mat, number>();

  constructor(w: number, d: number, h: number) {
    this.w = w;
    this.d = d;
    this.h = h;
    this.m = new Uint8Array(w * d * h);
    this.t = new Int8Array(w * d * h);
  }

  private idx(i: number, j: number, k: number): number {
    return (k * this.d + j) * this.w + i;
  }

  inside(i: number, j: number, k: number): boolean {
    return i >= 0 && j >= 0 && k >= 0 && i < this.w && j < this.d && k < this.h;
  }

  mat(m: Mat): number {
    let id = this.matIds.get(m);
    if (id === undefined) {
      id = this.mats.length + 1;
      this.mats.push(m);
      this.matIds.set(m, id);
    }
    return id;
  }

  set(i: number, j: number, k: number, m: Mat | null, tweak = 0): void {
    i = Math.round(i); j = Math.round(j); k = Math.round(k);
    if (!this.inside(i, j, k)) return;
    const n = this.idx(i, j, k);
    if (!m) { this.m[n] = 0; return; }
    this.m[n] = this.mat(m);
    this.t[n] = Math.max(-127, Math.min(127, Math.round(tweak * 100)));
  }

  solid(i: number, j: number, k: number): boolean {
    return this.inside(i, j, k) && this.m[this.idx(i, j, k)] !== 0;
  }

  getMat(i: number, j: number, k: number): Mat | null {
    if (!this.inside(i, j, k)) return null;
    const id = this.m[this.idx(i, j, k)];
    return id ? this.mats[id - 1] : null;
  }

  tweak(i: number, j: number, k: number): number {
    return this.t[this.idx(i, j, k)] / 100;
  }

  // ───────────────────────── primitives ─────────────────────────

  /** Inclusive box. `tex` returns a lightness tweak (or null to skip a voxel). */
  box(i0: number, j0: number, k0: number, i1: number, j1: number, k1: number, m: Mat, tex?: (i: number, j: number, k: number) => number | null): void {
    for (let k = Math.round(k0); k <= Math.round(k1); k++)
      for (let j = Math.round(j0); j <= Math.round(j1); j++)
        for (let i = Math.round(i0); i <= Math.round(i1); i++) {
          const t = tex ? tex(i, j, k) : 0;
          if (t === null) continue;
          this.set(i, j, k, m, t);
        }
  }

  /** Vertical cylinder centred at (ci, cj). */
  cyl(ci: number, cj: number, k0: number, k1: number, r: number, m: Mat, tex?: (i: number, j: number, k: number, a: number) => number | null, hollow = 0): void {
    for (let k = Math.round(k0); k <= Math.round(k1); k++)
      for (let j = Math.floor(cj - r - 1); j <= Math.ceil(cj + r + 1); j++)
        for (let i = Math.floor(ci - r - 1); i <= Math.ceil(ci + r + 1); i++) {
          const dx = i + 0.5 - ci, dy = j + 0.5 - cj, d = Math.hypot(dx, dy);
          if (d > r || (hollow && d < r - hollow)) continue;
          const t = tex ? tex(i, j, k, Math.atan2(dy, dx)) : 0;
          if (t === null) continue;
          this.set(i, j, k, m, t);
        }
  }

  /** Cylinder lying along the i (u) axis — logs, rollers, axles. */
  cylU(i0: number, i1: number, cj: number, ck: number, r: number, m: Mat, tex?: (i: number, j: number, k: number, a: number) => number | null): void {
    for (let i = Math.round(i0); i <= Math.round(i1); i++)
      for (let k = Math.floor(ck - r - 1); k <= Math.ceil(ck + r + 1); k++)
        for (let j = Math.floor(cj - r - 1); j <= Math.ceil(cj + r + 1); j++) {
          const dy = j + 0.5 - cj, dz = k + 0.5 - ck;
          if (Math.hypot(dy, dz) > r) continue;
          const t = tex ? tex(i, j, k, Math.atan2(dz, dy)) : 0;
          if (t === null) continue;
          this.set(i, j, k, m, t);
        }
  }

  /** Cylinder lying along the j (v) axis. */
  cylV(j0: number, j1: number, ci: number, ck: number, r: number, m: Mat, tex?: (i: number, j: number, k: number, a: number) => number | null): void {
    for (let j = Math.round(j0); j <= Math.round(j1); j++)
      for (let k = Math.floor(ck - r - 1); k <= Math.ceil(ck + r + 1); k++)
        for (let i = Math.floor(ci - r - 1); i <= Math.ceil(ci + r + 1); i++) {
          const dx = i + 0.5 - ci, dz = k + 0.5 - ck;
          if (Math.hypot(dx, dz) > r) continue;
          const t = tex ? tex(i, j, k, Math.atan2(dz, dx)) : 0;
          if (t === null) continue;
          this.set(i, j, k, m, t);
        }
  }

  sphere(ci: number, cj: number, ck: number, r: number, m: Mat, tex?: (i: number, j: number, k: number, d: number) => number | null, squash = 1): void {
    for (let k = Math.floor(ck - r * squash - 1); k <= Math.ceil(ck + r * squash + 1); k++)
      for (let j = Math.floor(cj - r - 1); j <= Math.ceil(cj + r + 1); j++)
        for (let i = Math.floor(ci - r - 1); i <= Math.ceil(ci + r + 1); i++) {
          const dx = i + 0.5 - ci, dy = j + 0.5 - cj, dz = (k + 0.5 - ck) / squash;
          const d = Math.hypot(dx, dy, dz) / r;
          if (d > 1) continue;
          const t = tex ? tex(i, j, k, d) : 0;
          if (t === null) continue;
          this.set(i, j, k, m, t);
        }
  }

  /** Thick 3D line (beams, ropes, spokes). */
  line(a: [number, number, number], b: [number, number, number], m: Mat, r = 0.5, tweak = 0): void {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(1, Math.ceil(len * 2));
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
      if (r <= 0.5) this.set(Math.floor(x), Math.floor(y), Math.floor(z), m, tweak);
      else this.sphere(x, y, z, r, m, () => tweak);
    }
  }

  /** Cone/pyramid roof: square (pyr) or round. */
  cone(ci: number, cj: number, k0: number, k1: number, r0: number, r1: number, m: Mat, square = false, tex?: (i: number, j: number, k: number) => number | null): void {
    for (let k = Math.round(k0); k <= Math.round(k1); k++) {
      const t = (k - k0) / Math.max(1, k1 - k0);
      const r = r0 + (r1 - r0) * t;
      for (let j = Math.floor(cj - r - 1); j <= Math.ceil(cj + r + 1); j++)
        for (let i = Math.floor(ci - r - 1); i <= Math.ceil(ci + r + 1); i++) {
          const dx = i + 0.5 - ci, dy = j + 0.5 - cj;
          const inside = square ? Math.max(Math.abs(dx), Math.abs(dy)) <= r : Math.hypot(dx, dy) <= r;
          if (!inside) continue;
          const tw = tex ? tex(i, j, k) : 0;
          if (tw === null) continue;
          this.set(i, j, k, m, tw);
        }
    }
  }

  /** A gear in the vertical plane facing +v (visible on the left face). */
  gearV(ci: number, j: number, ck: number, r: number, m: Mat, rot: number, teeth = 8, hub?: Mat): void {
    for (let k = Math.floor(ck - r - 2); k <= Math.ceil(ck + r + 2); k++)
      for (let i = Math.floor(ci - r - 2); i <= Math.ceil(ci + r + 2); i++) {
        const dx = i + 0.5 - ci, dz = k + 0.5 - ck;
        const d = Math.hypot(dx, dz), a = Math.atan2(dz, dx) + rot;
        const tooth = Math.cos(a * teeth) > 0.25 ? 1.3 : 0;
        if (d > r + tooth) continue;
        if (d < r * 0.35) { this.set(i, j, k, hub ?? m, 0.2); continue; }
        if (d > r * 0.55 && d < r * 0.8 && Math.cos(a * 4) < -0.2) continue; // spokes gap
        this.set(i, j, k, m, d > r ? -0.1 : 0.05);
      }
  }

  /** Same gear in the plane facing +u (visible on the right face). */
  gearU(i: number, cj: number, ck: number, r: number, m: Mat, rot: number, teeth = 8, hub?: Mat): void {
    for (let k = Math.floor(ck - r - 2); k <= Math.ceil(ck + r + 2); k++)
      for (let j = Math.floor(cj - r - 2); j <= Math.ceil(cj + r + 2); j++) {
        const dy = j + 0.5 - cj, dz = k + 0.5 - ck;
        const d = Math.hypot(dy, dz), a = Math.atan2(dz, dy) + rot;
        const tooth = Math.cos(a * teeth) > 0.25 ? 1.3 : 0;
        if (d > r + tooth) continue;
        if (d < r * 0.35) { this.set(i, j, k, hub ?? m, 0.2); continue; }
        if (d > r * 0.55 && d < r * 0.8 && Math.cos(a * 4) < -0.2) continue;
        this.set(i, j, k, m, d > r ? -0.1 : 0.05);
      }
  }

  /** Copy (stamp) another volume into this one at an offset. */
  paste(src: Vol, oi: number, oj: number, ok: number): void {
    for (let k = 0; k < src.h; k++) for (let j = 0; j < src.d; j++) for (let i = 0; i < src.w; i++) {
      const m = src.getMat(i, j, k);
      if (m) this.set(i + oi, j + oj, k + ok, m, src.tweak(i, j, k));
    }
  }
}

// ───────────────────────── rendering ─────────────────────────

export interface RenderOpts {
  /** pixel position of the volume's ground centre (centre of i,j footprint at k=0) */
  ox: number;
  oy: number;
  /** ambient occlusion strength */
  ao?: number;
  /** darken lower voxels slightly (ambient falloff) */
  heightShade?: number;
  /** rim-light strength on exposed top edges */
  rim?: number;
  /** add a selective dark outline around the silhouette */
  outline?: boolean;
}

/** Writes a single face pixel through a depth test. */
export class Raster {
  readonly c: PixelCanvas;
  readonly z: Int32Array;
  constructor(c: PixelCanvas) {
    this.c = c;
    this.z = new Int32Array(c.w * c.h).fill(-2147483648);
  }
  put(x: number, y: number, depth: number, col: RGBA): void {
    if (x < 0 || y < 0 || x >= this.c.w || y >= this.c.h) return;
    const n = y * this.c.w + x;
    if (depth < this.z[n]) return;
    this.z[n] = depth;
    this.c.set(x, y, col);
  }
}

/** Stamp pixel offsets (relative to the voxel's top vertex) per face. */
const STAMP_TOP: [number, number][] = [[-1, 0], [0, 0], [-1, 1], [0, 1]];
const STAMP_LEFT: [number, number][] = [[-2, 1], [-2, 2], [-1, 2], [-1, 3]];
const STAMP_RIGHT: [number, number][] = [[1, 1], [1, 2], [0, 2], [0, 3]];

export function shade(m: Mat, l: number, x: number, y: number): RGBA {
  const r = m.ramp;
  const v = l * (r.length - 1) + (bayer(x, y) - 0.5) * (m.d ?? 0.35);
  return r[Math.max(0, Math.min(r.length - 1, Math.round(v)))];
}

/**
 * Draw one voxel's visible faces. `sx, sy` = screen position of the voxel's
 * top vertex. `lt/ll/lr` = final lightness for each face (or NaN to skip).
 */
export function stamp(R: Raster, sx: number, sy: number, depth: number, m: Mat, lt: number, ll: number, lr: number): void {
  if (!Number.isNaN(lt)) for (const [dx, dy] of STAMP_TOP) R.put(sx + dx, sy + dy, depth, shade(m, lt, sx + dx, sy + dy));
  if (!Number.isNaN(ll)) for (const [dx, dy] of STAMP_LEFT) R.put(sx + dx, sy + dy, depth, shade(m, ll, sx + dx, sy + dy));
  if (!Number.isNaN(lr)) for (const [dx, dy] of STAMP_RIGHT) R.put(sx + dx, sy + dy, depth, shade(m, lr, sx + dx, sy + dy));
}

/** Screen position of the top vertex of voxel (i,j,k) for a volume centred on (ox, oy). */
export function voxelScreen(i: number, j: number, k: number, w: number, d: number, ox: number, oy: number): [number, number] {
  const u = (i - w / 2) * V, v = (j - d / 2) * V, z = (k + 1) * V;
  return [Math.round(ox + (u - v)), Math.round(oy + (u + v) / 2 - z)];
}

export function render(vol: Vol, c: PixelCanvas, o: RenderOpts): void {
  const R = new Raster(c);
  const ao = o.ao ?? 0.07;
  const hs = o.heightShade ?? 0.12;
  const rim = o.rim ?? 0.1;
  const s = (i: number, j: number, k: number) => vol.solid(i, j, k);
  for (let k = 0; k < vol.h; k++) {
    for (let j = 0; j < vol.d; j++) {
      for (let i = 0; i < vol.w; i++) {
        const m = vol.getMat(i, j, k);
        if (!m) continue;
        const top = !s(i, j, k + 1), left = !s(i, j + 1, k), right = !s(i + 1, j, k);
        if (!top && !left && !right) continue;
        const [sx, sy] = voxelScreen(i, j, k, vol.w, vol.d, o.ox, o.oy);
        const base = m.l + vol.tweak(i, j, k) + (m.v ? (hash2(i * 7 + k, j * 13 - k, 3) - 0.5) * m.v : 0);
        const hfall = m.glow ? 0 : -hs * (1 - Math.min(1, k / 24));
        let lt = NaN, ll = NaN, lr = NaN;
        if (top) {
          let occ = 0;
          if (!m.glow) {
            occ += (s(i - 1, j, k + 1) ? 1 : 0) + (s(i, j - 1, k + 1) ? 1 : 0) + (s(i + 1, j, k + 1) ? 0.6 : 0) + (s(i, j + 1, k + 1) ? 0.6 : 0);
            occ += (s(i - 1, j - 1, k + 1) ? 0.5 : 0);
            // shadow from overhangs straight above
            for (let q = 2; q < 14; q++) if (s(i, j, k + q)) { occ += 1.6; break; }
          }
          const edge = !s(i - 1, j, k) || !s(i, j - 1, k) ? rim : 0;
          lt = base + (m.glow ? 0 : FACE.top + edge - occ * ao) + hfall;
        }
        if (left) {
          let occ = 0;
          if (!m.glow) occ = (s(i, j + 1, k - 1) ? 0.5 : 0) + (s(i - 1, j + 1, k) ? 0.8 : 0) + (s(i, j + 1, k + 1) ? 0.6 : 0);
          ll = base + (m.glow ? -0.04 : FACE.left - occ * ao) + hfall;
        }
        if (right) {
          let occ = 0;
          if (!m.glow) occ = (s(i + 1, j, k - 1) ? 0.5 : 0) + (s(i + 1, j - 1, k) ? 0.8 : 0) + (s(i + 1, j, k + 1) ? 0.6 : 0);
          lr = base + (m.glow ? -0.08 : FACE.right - occ * ao) + hfall;
        }
        stamp(R, sx, sy, i + j + k, m, lt, ll, lr);
      }
    }
  }
  if (o.outline) outlineDark(c);
}

/** Selective outline: transparent pixels touching the silhouette get a darkened neighbour colour. */
export function outlineDark(c: PixelCanvas, amount = 0.62): void {
  const out: [number, number, RGBA][] = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (c.alpha(x, y)) continue;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const n = c.get(x + dx, y + dy);
      if ((n & 255) > 200) { out.push([x, y, mix(n, rgb(0x140c12), amount)]); break; }
    }
  }
  for (const [x, y, col] of out) c.set(x, y, col);
}

/** Make a canvas for an n×n-tile footprint, `h` px tall, and its render origin. */
export function voxCanvas(size: number, h: number, pad = 0): { c: PixelCanvas; ox: number; oy: number } {
  const w = 64 * size + pad * 2;
  const c = new PixelCanvas(w, h);
  return { c, ox: w / 2, oy: h - 16 * size };
}

/** Volume for an n×n-tile footprint (16 voxels per tile edge), `h` voxels tall. */
export function tileVol(size: number, h: number): Vol {
  return new Vol(16 * size, 16 * size, h);
}
