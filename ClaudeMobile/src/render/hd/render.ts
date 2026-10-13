import { clamp } from './noise';
import { linToOklab, oklabToLin, posterize } from './color';
import type { Hit, Mat, Model, Prim, RGB } from './sdf';

/**
 * Offline sphere-tracing renderer for HD sprites. It reproduces the game's
 * projection exactly: screen = ((x−y)·32, (x+y)·16 − z·32) · R pixels, so the
 * view ray is −(1,1,1). Lighting: warm low sun from the upper left, cool sky
 * dome, warm ground bounce, soft shadows, SDF ambient occlusion, Blinn
 * highlights, a soft rim and emissive bloom. Output is premultiplied-free
 * 8-bit RGBA with the footprint centre as anchor.
 */

export interface Light {
  sun: [number, number, number];
  sunCol: RGB;
  sky: RGB;
  bounce: RGB;
  rim: RGB;
}

const smoothstep01 = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const n3 = (x: number, y: number, z: number): [number, number, number] => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };

export const LIGHT: Light = {
  sun: n3(-0.4, 0.45, 0.8),
  sunCol: [1.12, 1.04, 0.9],   // lit-side multiplier on albedo
  sky: [0.55, 0.56, 0.78],     // shade-side multiplier: cool lavender
  bounce: [0.32, 0.25, 0.17],
  rim: [1.0, 0.82, 0.55],
};

/** Light rig for pixel-art mode (linear multipliers). */
/** Ground shadows in pixel mode fall almost straight down, as in hand-made sprites. */
const GROUND_SUN = n3(-0.22, 0.26, 0.94);

export const PIX = {
  sun: [1.95, 1.5, 0.98],
  sky: [0.34, 0.36, 0.62],
  bounce: [0.34, 0.27, 0.16],
  rim: [1.0, 0.72, 0.45],
};

export interface RenderOpts {
  R?: number;          // pixels per 1× pixel
  shadow?: boolean;    // bake a contact/cast shadow onto the ground plane
  shadowAlpha?: number;
  light?: Light;
  t?: number;          // animation phase for materials
  /** Force canvas bounds (world px at 1×, relative to anchor) so frames share a box. */
  box?: [number, number, number, number];
  glow?: number;       // emissive bloom strength
  ground?: number;     // z of the shadow-receiving plane
  outline?: number;    // darken silhouette edge (0..1)
  aa?: number;         // subsamples per edge pixel side (2 → 4 samples)
  /** Pixel-art mode: physically lit, one sample per pixel, posterised palette, selective outlines. */
  pixel?: boolean;
  /** Keep only surface points for which this returns true (others are see-through). */
  clip?: (x: number, y: number, z: number) => boolean;
}

export interface Image { w: number; h: number; data: Uint8ClampedArray; ax: number; ay: number }

const V = 1 / Math.sqrt(3);

export class Renderer {
  private prims: Prim[];
  private hitPrim: Prim | null = null;
  private tmp = new Float64Array(3);
  private o: Required<Omit<RenderOpts, 'box' | 'clip'>> & { box?: [number, number, number, number]; clip?: (x: number, y: number, z: number) => boolean };
  private bb: number[];

  constructor(m: Model, o: RenderOpts = {}) {
    this.prims = m.prims;
    this.o = { R: 3, shadow: true, shadowAlpha: 0.42, light: LIGHT, t: 0, glow: 1, ground: 0, outline: 0.85, aa: 2, pixel: false, ...o };
    this.bb = m.bounds();
  }

  /** Scene distance; remembers the closest primitive. */
  map(x: number, y: number, z: number): number {
    let best = 1e9;
    let hp: Prim | null = null;
    const ps = this.prims;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i], b = p.bb;
      // distance to the primitive's box: a lower bound on its true distance
      const ex = Math.max(b[0] - x, 0, x - b[3]), ey = Math.max(b[1] - y, 0, y - b[4]), ez = Math.max(b[2] - z, 0, z - b[5]);
      const bd = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (bd >= best) continue;
      const d = p.d(x, y, z);
      if (d < best) { best = d; hp = p; }
    }
    this.hitPrim = hp;
    return best;
  }

  private shadowRay(x: number, y: number, z: number, dir?: [number, number, number]): number {
    const [lx, ly, lz] = dir ?? this.o.light.sun;
    let res = 1, t = 0.012;
    for (let i = 0; i < 64 && t < 6; i++) {
      const px = x + lx * t, py = y + ly * t, pz = z + lz * t;
      if (pz > this.bb[5] + 0.05) break;
      const d = this.map(px, py, pz);
      if (d < 0.0008) return 0;
      res = Math.min(res, (9 * d) / t);
      t += Math.max(0.006, Math.min(d * 0.9, 0.2));
    }
    return clamp(res);
  }

  private ao(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
    let occ = 0, w = 1;
    for (let i = 1; i <= 5; i++) {
      const h = 0.018 * i * i * 0.6 + 0.01;
      const d = this.map(x + nx * h, y + ny * h, z + nz * h);
      occ += (h - Math.max(d, 0)) * w;
      w *= 0.62;
    }
    return clamp(1 - occ * 3.2);
  }

  private normal(x: number, y: number, z: number, out: Float64Array): void {
    const e = 0.0012;
    const a = this.map(x + e, y - e, z - e), b = this.map(x - e, y - e, z + e), c = this.map(x - e, y + e, z - e), d = this.map(x + e, y + e, z + e);
    const nx = a - b - c + d, ny = -a - b + c + d, nz = -a + b - c + d;
    const l = Math.hypot(nx, ny, nz) || 1;
    out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
  }

  private hit: Hit = { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0, nx: 0, ny: 0, nz: 1, gx: 0, gy: 0, gz: 1, t: 0 };
  private nrm = new Float64Array(3);
  private alb: RGB = [0, 0, 0];
  private em: RGB = [0, 0, 0];

  /**
   * Trace one ray through screen point (sx, sy) in 1× pixels relative to the
   * anchor. Writes linear premultiplied RGBA + emissive into out[0..6] and
   * returns a material id (−1 none, −2 ground shadow) for edge detection.
   */
  lastU = 0;

  trace(sx: number, sy: number, out: Float64Array): number {
    const bb = this.bb;
    // point on the ray at height z = top
    const top = bb[5] + 0.01;
    const a = sx / 32, s = (sy + top * 32) / 16;
    let ox = (s + a) / 2, oy = (s - a) / 2;
    const oz = top;
    // march along −(1,1,1)/√3, parameter u = distance
    const g = this.o.ground;
    const uGround = (oz - g) / V;
    // clip against bounds on x,y (they decrease as u grows)
    const uMinX = (ox - bb[3]) / V, uMaxX = (ox - bb[0]) / V;
    const uMinY = (oy - bb[4]) / V, uMaxY = (oy - bb[1]) / V;
    let u = Math.max(0, uMinX, uMinY);
    const uEnd = Math.min(uMaxX, uMaxY, (oz - bb[2]) / V + 0.01);
    out[0] = out[1] = out[2] = out[3] = out[4] = out[5] = out[6] = 0;
    let hit = false;
    if (u < uEnd) {
      for (let i = 0; i < 220; i++) {
        const px = ox - u * V, py = oy - u * V, pz = oz - u * V;
        const d = this.map(px, py, pz);
        if (d < 0.0006) {
          if (!this.o.clip || this.o.clip(px, py, pz)) { hit = true; break; }
          // clipped away: step through the surface and keep going
          u += Math.max(0.004, -d * 0.9 + 0.003);
          continue;
        }
        u += d * 0.82;
        if (u > uEnd) break;
      }
    }
    if (hit) {
      const px = ox - u * V, py = oy - u * V, pz = oz - u * V;
      if (pz >= g - 0.002 || !this.o.shadow) { this.lastU = u; this.shade(px, py, pz, out); return this.hitPrim ? this.hitPrim.mat.id : 0; }
    }
    if (!this.o.shadow) return -1;
    // ground plane
    if (uGround < 0) return -1;
    ox -= uGround * V; oy -= uGround * V;
    const sh = this.shadowRay(ox, oy, g + 0.002, this.o.pixel ? GROUND_SUN : undefined);
    const ao = this.groundAO(ox, oy, g);
    const dark = clamp(1 - sh * (0.35 + 0.65 * ao) - (1 - ao) * 0.5);
    if (dark < 0.02) return -1;
    const al = dark * this.o.shadowAlpha;
    out[0] = 0.05 * al; out[1] = 0.04 * al; out[2] = 0.07 * al; out[3] = al;
    return -2;
  }

  private groundAO(x: number, y: number, g: number): number {
    let occ = 0;
    for (let i = 1; i <= 4; i++) {
      const h = 0.03 * i;
      const d = this.map(x, y, g + h);
      occ += Math.max(0, h - d) / h * 0.4;
    }
    return clamp(1 - occ);
  }

  private shade(px: number, py: number, pz: number, out: Float64Array): void {
    const prim = this.hitPrim!;
    const mat = prim.mat;
    const n = this.nrm;
    this.normal(px, py, pz, n);
    const h = this.hit;
    h.x = px; h.y = py; h.z = pz; h.t = this.o.t;
    prim.local(px, py, pz, this.tmp);
    h.lx = this.tmp[0]; h.ly = this.tmp[1]; h.lz = this.tmp[2];
    h.gx = n[0]; h.gy = n[1]; h.gz = n[2];
    let nx = n[0], ny = n[1], nz = n[2];
    if (mat.bump && mat.bumpAmp) {
      // bump in local space, gradient by forward differences; rotate into world with the prim's transform
      const e = 0.004;
      const b0 = mat.bump(h.lx, h.ly, h.lz);
      const gx = (mat.bump(h.lx + e, h.ly, h.lz) - b0) / e, gy = (mat.bump(h.lx, h.ly + e, h.lz) - b0) / e, gz = (mat.bump(h.lx, h.ly, h.lz + e) - b0) / e;
      const m = prim.xf.m;
      let wx = gx, wy = gy, wz = gz;
      if (m) { wx = m[0] * gx + m[3] * gy + m[6] * gz; wy = m[1] * gx + m[4] * gy + m[7] * gz; wz = m[2] * gx + m[5] * gy + m[8] * gz; }
      const dn = wx * nx + wy * ny + wz * nz;
      const k = mat.bumpAmp;
      nx -= k * (wx - dn * nx); ny -= k * (wy - dn * ny); nz -= k * (wz - dn * nz);
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
    }
    h.nx = nx; h.ny = ny; h.nz = nz;
    const alb = this.alb;
    mat.color(h, alb);
    const L = this.o.light;
    const [lx, ly, lz] = L.sun;
    const ndl = nx * lx + ny * ly + nz * lz;
    const off = 0.004;
    const sh = ndl > 0 ? this.shadowRay(px + h.gx * off, py + h.gy * off, pz + h.gz * off) : 0;
    const ao = this.ao(px, py, pz, h.gx, h.gy, h.gz);
    if (this.o.pixel) {
      // Physically-motivated light for pixel art: warm sun with soft shadows,
      // cool sky dome, warm ground bounce, rim and highlights; the palette
      // snap later turns the gradients into clean bands.
      const diff = Math.max(ndl, 0) * sh;
      const wrap = mat.sss ? Math.max(0, (ndl + 0.5) / 1.5) * (0.4 + 0.6 * sh) * mat.sss : 0;
      const skyW = (0.5 + 0.5 * nz) * ao;
      const bounceW = Math.max(0, -nz * 0.5 + 0.3) * ao;
      const vdn = (nx + ny + nz) * V;
      const rim = Math.pow(1 - clamp(vdn), 3) * (0.2 + 0.8 * clamp(ndl + 0.2)) * ao;
      const hx = lx + V, hy = ly + V, hz = lz + V, hl = Math.hypot(hx, hy, hz);
      const ndh = clamp((nx * hx + ny * hy + nz * hz) / hl);
      const spec = mat.spec * Math.pow(ndh, mat.pow) * sh;
      const refl = mat.refl ?? 0;
      const P = PIX;
      for (let c = 0; c < 3; c++) {
        let v = alb[c] * (P.sun[c] * (diff + wrap * 0.5) + P.sky[c] * skyW + P.bounce[c] * bounceW);
        v += P.rim[c] * rim * 0.18 * (0.4 + alb[c]);
        v += spec * P.sun[c] * 0.4;
        if (refl) {
          const fres = 0.25 + 0.75 * Math.pow(1 - clamp(vdn), 3);
          const sk = [0.7, 0.8, 0.98][c] * (0.6 + 0.4 * (1 - nz)) + [0.4, 0.3, 0.15][c] * clamp(ndl);
          v = v * (1 - refl * fres) + sk * refl * fres * ao;
        }
        out[c] = v;
      }
    } else {
    // Illustrated shading: a soft two-tone ramp (warm light, cool lavender
      // shade), gentle occlusion in creases, a thin warm rim and crisp highlights.
      const lit = clamp(ndl) * sh;
      const band = smoothstep01(0.06, 0.3, lit) * 0.85 + clamp(lit) * 0.15;
      const wrap = mat.sss ? clamp(ndl + 0.6) * mat.sss * 0.35 : 0;
      const top = clamp(nz) * 0.1;
      const occ = 0.62 + 0.38 * ao;
      const vdn = (nx + ny + nz) * V;
      const rim = Math.pow(1 - clamp(vdn), 4) * 0.5 * band;
      const hx = lx + V, hy = ly + V, hz = lz + V, hl = Math.hypot(hx, hy, hz);
      const ndh = clamp((nx * hx + ny * hy + nz * hz) / hl);
      const spec = mat.spec > 0.3 ? smoothstep01(0.9, 0.95, Math.pow(ndh, mat.pow / 30)) * mat.spec * 0.5 * sh : 0;
      const refl = mat.refl ?? 0;
      for (let c = 0; c < 3; c++) {
        const litC = alb[c] * L.sunCol[c];
        const shdC = alb[c] * L.sky[c];
        let v = (shdC + (litC - shdC) * Math.min(1, band + wrap)) * occ + alb[c] * top;
        v += L.rim[c] * rim * 0.35;
        v += spec;
        if (refl) {
          const skyRefl = [0.75, 0.82, 0.95][c] * (0.5 + 0.5 * nz);
          v = v * (1 - refl * 0.5) + skyRefl * refl * 0.5 * occ;
        }
        out[c] = v;
      }
    }
    out[3] = 1;
    if (mat.emit) {
      const em = this.em;
      em[0] = em[1] = em[2] = 0;
      mat.emit(h, em);
      out[0] += em[0]; out[1] += em[1]; out[2] += em[2];
      out[4] = em[0]; out[5] = em[1]; out[6] = em[2];
    }
  }

  /** Screen bounds at 1× (relative to the anchor), including the cast shadow. */
  bounds1x(): [number, number, number, number] {
    const bb = this.bb;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const corner = (x: number, y: number, z: number) => {
      const sx = (x - y) * 32, sy = (x + y) * 16 - z * 32;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    };
    for (const x of [bb[0], bb[3]]) for (const y of [bb[1], bb[4]]) for (const z of [this.o.shadow ? Math.max(bb[2], this.o.ground) : bb[2], bb[5]]) corner(x, y, z);
    if (this.o.shadow) {
      const [lx, ly, lz] = this.o.pixel ? GROUND_SUN : this.o.light.sun;
      const hgt = bb[5] - this.o.ground;
      const sx = (-lx / lz) * hgt, sy = (-ly / lz) * hgt;
      for (const x of [bb[0], bb[3]]) for (const y of [bb[1], bb[4]]) { corner(x, y, this.o.ground); corner(x + sx, y + sy, this.o.ground); }
    }
    return [x0, y0, x1, y1];
  }

  /** Render the whole model into an 8-bit image. */
  render(): Image {
    const R = this.o.R;
    let [x0, y0, x1, y1] = this.bounds1x();
    if (this.o.box) [x0, y0, x1, y1] = this.o.box;
    x0 = Math.floor(x0 * R) - 3; y0 = Math.floor(y0 * R) - 3; x1 = Math.ceil(x1 * R) + 3; y1 = Math.ceil(y1 * R) + 3;
    const w = x1 - x0, h = y1 - y0;
    const N = w * h;
    const col = new Float32Array(N * 4);
    const emi = new Float32Array(N * 3);
    const ids = new Int32Array(N);
    const dep = new Float32Array(N);
    const out = new Float64Array(7);
    // pass 1: one ray per pixel
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const id = this.trace((x0 + i + 0.5) / R, (y0 + j + 0.5) / R, out);
      const k = j * w + i;
      ids[k] = id;
      dep[k] = id >= 0 ? this.lastU : 1e9;
      col[k * 4] = out[0]; col[k * 4 + 1] = out[1]; col[k * 4 + 2] = out[2]; col[k * 4 + 3] = out[3];
      emi[k * 3] = out[4]; emi[k * 3 + 1] = out[5]; emi[k * 3 + 2] = out[6];
    }
    // pass 2: supersample pixels on material/coverage edges
    const aa = this.o.aa;
    if (aa > 1) {
      const redo: number[] = [];
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const k = j * w + i, id = ids[k];
        if ((i > 0 && ids[k - 1] !== id) || (i < w - 1 && ids[k + 1] !== id) || (j > 0 && ids[k - w] !== id) || (j < h - 1 && ids[k + w] !== id)) redo.push(k);
      }
      for (const k of redo) {
        const i = k % w, j = (k - i) / w;
        let r = 0, g = 0, b = 0, a = 0, er = 0, eg = 0, eb = 0;
        for (let q = 0; q < aa * aa; q++) {
          const ox = ((q % aa) + 0.5) / aa, oy = (Math.floor(q / aa) + 0.5) / aa;
          this.trace((x0 + i + ox) / R, (y0 + j + oy) / R, out);
          r += out[0]; g += out[1]; b += out[2]; a += out[3]; er += out[4]; eg += out[5]; eb += out[6];
        }
        const n = aa * aa;
        col[k * 4] = r / n; col[k * 4 + 1] = g / n; col[k * 4 + 2] = b / n; col[k * 4 + 3] = a / n;
        emi[k * 3] = er / n; emi[k * 3 + 1] = eg / n; emi[k * 3 + 2] = eb / n;
      }
    }
    // emissive bloom: blurred emission spreads light (and a little alpha) around lamps and fire
    const glowK = this.o.glow;
    let anyEm = false;
    for (let k = 0; k < N * 3; k++) if (emi[k] > 0) { anyEm = true; break; }
    if (anyEm && glowK > 0) {
      const rad = Math.round(4 * R);
      const blur = boxBlur3(emi, w, h, rad);
      const blur2 = boxBlur3(blur, w, h, rad);
      for (let k = 0; k < N; k++) {
        const gr = blur2[k * 3] * glowK * 0.9, gg = blur2[k * 3 + 1] * glowK * 0.9, gb = blur2[k * 3 + 2] * glowK * 0.9;
        const lum = Math.max(gr, gg, gb);
        if (lum <= 0.002) continue;
        // add light; on transparent pixels add a halo with alpha
        const a = col[k * 4 + 3];
        const ha = Math.min(0.85, lum * 0.9) * (1 - a);
        col[k * 4] += gr * (a + ha * 0.0) + gr * ha;
        col[k * 4 + 1] += gg * (a + ha * 0.0) + gg * ha;
        col[k * 4 + 2] += gb * (a + ha * 0.0) + gb * ha;
        col[k * 4 + 3] = a + ha;
      }
    }
    // drawn lines: silhouettes and creases (material change or depth step) get a dark, tinted line
    const ol = this.o.outline;
    const line = new Float32Array(N);
    if (ol > 0) {
      const dstep = 0.06;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (ids[k] < 0) continue;
        let e = 0;
        for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= w || jj >= h) { e = 1; continue; }
          const q = jj * w + ii;
          if (ids[q] < 0) e = Math.max(e, 1);
          else if (dep[q] - dep[k] > dstep) e = Math.max(e, 0.8);
          else if (ids[q] !== ids[k] && dep[q] > dep[k] - 0.004) e = Math.max(e, 0.45);
        }
        line[k] = e;
      }
    }
    if (this.o.pixel) {
      const px8 = new Uint8ClampedArray(N * 4);
      const lab = new Float64Array(3), rgb = new Float64Array(3);
      const solid = (q: number) => ids[q] >= 0;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const k = j * w + i;
        const a = col[k * 4 + 3];
        if (a <= 0.003) continue;
        if (ids[k] === -2) {
          // ground shadow: a few flat alpha steps, no gradient mush
          const st = Math.round(a * 6) / 6;
          if (st <= 0) continue;
          px8[k * 4] = 34; px8[k * 4 + 1] = 26; px8[k * 4 + 2] = 48; px8[k * 4 + 3] = Math.round(255 * st);
          continue;
        }
        for (let c = 0; c < 3; c++) rgb[c] = filmic(col[k * 4 + c] / a);
        linToOklab(rgb[0], rgb[1], rgb[2], lab);
        posterize(lab, 15, (BAYER4[(j & 3) * 4 + (i & 3)] - 0.5) * 0.12);
        // selective outline: silhouette pixels get a dark, hue-shifted line,
        // softer where the light comes from (upper left); depth steps get a mid line
        let e = 0;
        const out = (ii: number, jj: number) => ii < 0 || jj < 0 || ii >= w || jj >= h || !solid(jj * w + ii);
        if (out(i + 1, j) || out(i, j + 1)) e = 1;
        else if (out(i - 1, j) || out(i, j - 1)) e = 0.55;
        else {
          for (const [di, dj] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
            const q = (j + dj) * w + i + di;
            if (dep[q] - dep[k] > 0.05) { e = Math.max(e, 0.6); }
          }
        }
        if (e > 0 && this.o.outline > 0) {
          const k2 = e * this.o.outline;
          lab[0] = lab[0] * (1 - 0.55 * k2);
          const C = Math.hypot(lab[1], lab[2]) * (1 - 0.15 * k2);
          let H = Math.atan2(lab[2], lab[1]);
          H += Math.atan2(Math.sin(-1.9 - H), Math.cos(-1.9 - H)) * 0.3 * k2;
          lab[1] = Math.cos(H) * C; lab[2] = Math.sin(H) * C;
        }
        oklabToLin(lab[0], lab[1], lab[2], rgb);
        for (let c = 0; c < 3; c++) px8[k * 4 + c] = Math.round(255 * toSRGB(clamp(rgb[c])));
        px8[k * 4 + 3] = a >= 0.5 ? 255 : 0;
      }
      // emissive halo for lamps and fire as stepped translucent pixels
      return { w, h, data: px8, ax: -x0, ay: -y0 };
    }
    const data = new Uint8ClampedArray(N * 4);
    for (let k = 0; k < N; k++) {
      const a = col[k * 4 + 3];
      if (a <= 0.003) continue;
      const e = line[k] * ol;
      for (let c = 0; c < 3; c++) {
        let v = col[k * 4 + c] / a;
        // line colour: the surface colour, darkened and pushed toward warm violet
        v = v * (1 - e) + (v * 0.35 + [0.05, 0.03, 0.06][c]) * e;
        data[k * 4 + c] = Math.round(255 * toSRGB(softClip(v)));
      }
      data[k * 4 + 3] = Math.round(255 * clamp(a));
    }
    return { w, h, data, ax: -x0, ay: -y0 };
  }
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Filmic curve for pixel mode (keeps rich colour, rolls off highlights). */
function filmic(x: number): number {
  x *= 0.9;
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
}

/** Keep authored colours; only roll off values above ~0.85 smoothly. */
function softClip(x: number): number {
  if (x <= 0.85) return Math.max(0, x);
  return 0.85 + 0.15 * (1 - Math.exp(-(x - 0.85) / 0.15));
}
function toSRGB(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function boxBlur3(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length), dst = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let j = 0; j < h; j++) for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += src[(j * w + Math.min(w - 1, Math.max(0, i))) * 3 + c];
    for (let i = 0; i < w; i++) {
      tmp[(j * w + i) * 3 + c] = s / n;
      const add = Math.min(w - 1, i + r + 1), sub = Math.max(0, i - r);
      s += src[(j * w + add) * 3 + c] - src[(j * w + sub) * 3 + c];
    }
  }
  for (let i = 0; i < w; i++) for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let j = -r; j <= r; j++) s += tmp[(Math.min(h - 1, Math.max(0, j)) * w + i) * 3 + c];
    for (let j = 0; j < h; j++) {
      dst[(j * w + i) * 3 + c] = s / n;
      const add = Math.min(h - 1, j + r + 1), sub = Math.max(0, j - r);
      s += tmp[(add * w + i) * 3 + c] - tmp[(sub * w + i) * 3 + c];
    }
  }
  return dst;
}

export type { Mat };
