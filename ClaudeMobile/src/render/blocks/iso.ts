/**
 * Isometric block rasteriser for the baked art. World units are blocks
 * (one block = one tile): screen = ((x − y)·32, (x + y)·16 − z·32) art
 * pixels, so a 16×16 texture lands on a block face at 2×2 pixels per texel,
 * exactly like Minecraft seen isometrically. Faces are textured quads drawn
 * with a depth buffer; plants and props are upright billboards.
 */

export interface Tex { w: number; h: number; data: Uint8Array | Uint8ClampedArray }
export type V3 = [number, number, number];
export type RGB = [number, number, number];
/** Texture region in texels: [u0, v0, u1, v1] (u1/v1 may be < u0/v0 to mirror). */
export type UV = [number, number, number, number];

export interface Face { tex: Tex; uv?: UV; tint?: RGB; glow?: boolean }

/** Face light: top is brightest, the +y face (screen left) catches the sun, +x (screen right) is in shade. */
export const SHADE = {
  top: [1.0, 1.0, 1.0] as RGB,
  left: [0.86, 0.84, 0.86] as RGB,
  right: [0.66, 0.66, 0.76] as RGB,
};

export class Canvas {
  readonly col: Uint8ClampedArray;
  readonly dep: Float32Array;
  readonly id: Int32Array;
  constructor(readonly w: number, readonly h: number, readonly ox: number, readonly oy: number) {
    this.col = new Uint8ClampedArray(w * h * 4);
    this.dep = new Float32Array(w * h).fill(-1e9);
    this.id = new Int32Array(w * h).fill(-1);
  }

  proj(x: number, y: number, z: number): [number, number] {
    return [this.ox + (x - y) * 32, this.oy + (x + y) * 16 - z * 32];
  }

  /**
   * Textured parallelogram: origin p, edges eu (texture u) and ev (texture v).
   * Pixels whose texel is transparent are skipped (cut-out leaves, glass).
   */
  quad(p: V3, eu: V3, ev: V3, f: Face, shade: RGB, id = 0, bias = 0): void {
    const [ox, oy] = this.proj(p[0], p[1], p[2]);
    const [ax, ay] = this.proj(p[0] + eu[0], p[1] + eu[1], p[2] + eu[2]);
    const [bx, by] = this.proj(p[0] + ev[0], p[1] + ev[1], p[2] + ev[2]);
    const dux = ax - ox, duy = ay - oy, dvx = bx - ox, dvy = by - oy;
    const det = dux * dvy - duy * dvx;
    if (Math.abs(det) < 1e-6) return;
    const xs = [ox, ax, bx, ax + dvx], ys = [oy, ay, by, ay + dvy];
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(this.w - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    const t = f.tex;
    const [u0, v0, u1, v1] = f.uv ?? [0, 0, t.w, t.h];
    const tint = f.tint ?? [1, 1, 1];
    const d0 = p[0] + p[1] + p[2], deu = eu[0] + eu[1] + eu[2], dev = ev[0] + ev[1] + ev[2];
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const qx = px + 0.5 - ox, qy = py + 0.5 - oy;
      const s = (qx * dvy - qy * dvx) / det, r = (dux * qy - duy * qx) / det;
      if (s < 0 || s >= 1 || r < 0 || r >= 1) continue;
      const depth = d0 + s * deu + r * dev + bias;
      const k = py * this.w + px;
      if (depth < this.dep[k] - 1e-4) continue;
      let tu = Math.floor(u0 + s * (u1 - u0)), tv = Math.floor(v0 + r * (v1 - v0));
      tu = ((tu % t.w) + t.w) % t.w; tv = ((tv % t.h) + t.h) % t.h;
      const ti = (tv * t.w + tu) * 4;
      if (t.data[ti + 3] < 128) continue;
      const sh = f.glow ? [1, 1, 1] : shade;
      this.dep[k] = depth;
      this.id[k] = id;
      this.col[k * 4] = t.data[ti] * sh[0] * tint[0];
      this.col[k * 4 + 1] = t.data[ti + 1] * sh[1] * tint[1];
      this.col[k * 4 + 2] = t.data[ti + 2] * sh[2] * tint[2];
      this.col[k * 4 + 3] = 255;
    }
  }

  /**
   * Cuboid from a to b (block units). Only the three camera-facing faces are
   * drawn. Texture coordinates follow world position (16 texels per block),
   * so partial boxes show the matching part of the texture, Minecraft-style.
   */
  box(a: V3, b: V3, top: Face, left: Face = top, right: Face = left, id = 0): void {
    const [x0, y0, z0] = a, [x1, y1, z1] = b;
    const T = 16;
    const auto = (f: Face, uv: UV): Face => (f.uv ? f : { ...f, uv });
    // top: u along +x, v along +y
    this.quad([x0, y0, z1], [x1 - x0, 0, 0], [0, y1 - y0, 0], auto(top, [x0 * T, y0 * T, x1 * T, y1 * T]), SHADE.top, id);
    // +y face (screen left): u along +x, v downward
    const vz0 = ((1 - (z1 - Math.floor(z1 - 1e-6))) % 1) * T, vz1 = vz0 + (z1 - z0) * T;
    this.quad([x0, y1, z1], [x1 - x0, 0, 0], [0, 0, -(z1 - z0)], auto(left, [x0 * T, vz0, x1 * T, vz1]), SHADE.left, id);
    // +x face (screen right): u along −y, v downward
    this.quad([x1, y1, z1], [0, -(y1 - y0), 0], [0, 0, -(z1 - z0)], auto(right, [(1 - y1) * T, vz0, (1 - y0) * T, vz1]), SHADE.right, id);
  }

  /** Upright sprite standing at p (its bottom centre), 2 px per texel, facing the camera. */
  sprite(p: V3, f: Face, id = 0, scale = 2, bias = 0.3): void {
    const t = f.tex;
    const [u0, v0, u1, v1] = f.uv ?? [0, 0, t.w, t.h];
    const tw = Math.abs(u1 - u0), th = Math.abs(v1 - v0);
    const [cx, cy] = this.proj(p[0], p[1], p[2]);
    const depth = p[0] + p[1] + p[2] + bias;
    const tint = f.tint ?? [1, 1, 1];
    const left = Math.round(cx - (tw * scale) / 2), top = Math.round(cy - th * scale);
    for (let y = 0; y < th * scale; y++) for (let x = 0; x < tw * scale; x++) {
      const px = left + x, py = top + y;
      if (px < 0 || py < 0 || px >= this.w || py >= this.h) continue;
      const tu = Math.floor(u0 + x / scale), tv = Math.floor(v0 + y / scale);
      const ti = (tv * t.w + tu) * 4;
      if (t.data[ti + 3] < 128) continue;
      const k = py * this.w + px;
      if (depth < this.dep[k]) continue;
      this.dep[k] = depth;
      this.id[k] = id;
      this.col[k * 4] = t.data[ti] * tint[0];
      this.col[k * 4 + 1] = t.data[ti + 1] * tint[1];
      this.col[k * 4 + 2] = t.data[ti + 2] * tint[2];
      this.col[k * 4 + 3] = 255;
    }
  }

  /** Soft drop shadow on the ground plane under a footprint (drawn behind everything). */
  shadow(x0: number, y0: number, x1: number, y1: number, alpha = 0.28): void {
    const T = 1 / 16;
    for (let y = y0; y < y1; y += T) for (let x = x0; x < x1; x += T) {
      const [px, py] = this.proj(x, y, 0);
      for (let dy = 0; dy < 1; dy++) for (let dx = 0; dx < 2; dx++) {
        const X = Math.round(px + dx), Y = Math.round(py + dy);
        if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
        const k = Y * this.w + X;
        if (this.col[k * 4 + 3]) continue;
        this.col[k * 4] = 30; this.col[k * 4 + 1] = 22; this.col[k * 4 + 2] = 40; this.col[k * 4 + 3] = Math.round(255 * alpha);
        this.dep[k] = -1e8;
      }
    }
  }

  /**
   * Pixel-art finish: a 1 px dark outline around the silhouette (darker on
   * the shaded right/bottom), and a thin darker line where two objects meet.
   */
  outline(strength = 0.6): void {
    const { w, h, col, dep } = this;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && col[(y * w + x) * 4 + 3] === 255 && dep[y * w + x] > -1e8;
    const add: [number, number, number][] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      const k = (y * w + x) * 4;
      if (col[k + 3] && dep[y * w + x] > -1e8) continue;
      let n = -1;
      for (const [dx, dy] of [[-1, 0], [0, -1], [1, 0], [0, 1]]) if (solid(x + dx, y + dy)) { n = ((y + dy) * w + x + dx); break; }
      if (n >= 0) add.push([x, y, n]);
    }
    for (const [x, y, n] of add) {
      const k = (y * w + x) * 4;
      col[k] = col[n * 4] * (1 - strength) * 0.6 + 20 * strength;
      col[k + 1] = col[n * 4 + 1] * (1 - strength) * 0.5 + 12 * strength;
      col[k + 2] = col[n * 4 + 2] * (1 - strength) * 0.6 + 26 * strength;
      col[k + 3] = 255;
    }
  }
}
