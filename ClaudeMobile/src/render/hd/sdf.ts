import { smin } from './noise';

/**
 * Signed-distance scene description for the offline HD renderer.
 *
 * Units are tiles: a 1×1 footprint spans x,y ∈ [-0.5, 0.5]; z is up (one
 * unit of height is 32 screen pixels at 1×, like one tile edge). +x faces
 * the lower right of the screen, +y the lower left.
 */

export interface Hit {
  x: number; y: number; z: number;     // world position
  lx: number; ly: number; lz: number;  // position in the primitive's frame
  nx: number; ny: number; nz: number;  // world normal (after bump)
  gx: number; gy: number; gz: number;  // geometric normal
  t: number;                           // animation time 0..1
}

export type RGB = [number, number, number];

export interface Mat {
  id: number;
  /** Linear albedo for a hit. */
  color(h: Hit, out: RGB): void;
  /** Specular strength and Blinn exponent. */
  spec: number;
  pow: number;
  /** Optional height field for bump mapping (local coords) and its amplitude. */
  bump?: (x: number, y: number, z: number) => number;
  bumpAmp?: number;
  /** Light passing through thin foliage. */
  sss?: number;
  /** Emissive radiance (linear, can exceed 1). */
  emit?: (h: Hit, out: RGB) => void;
  /** Mirror-ish sky reflection (water, glass, metal). */
  refl?: number;
}

type Shape = (x: number, y: number, z: number) => number;

/** World → local rigid transform (rotation as a 3×3 matrix). */
class Xf {
  constructor(public cx: number, public cy: number, public cz: number, public m: number[] | null) {}
  apply(x: number, y: number, z: number, o: Float64Array): void {
    x -= this.cx; y -= this.cy; z -= this.cz;
    const m = this.m;
    if (m) { o[0] = m[0] * x + m[1] * y + m[2] * z; o[1] = m[3] * x + m[4] * y + m[5] * z; o[2] = m[6] * x + m[7] * y + m[8] * z; }
    else { o[0] = x; o[1] = y; o[2] = z; }
  }
}

/** Rotation matrix (world→local) from Euler angles applied X then Y then Z (local→world). */
export function rotMat(ax: number, ay: number, az: number): number[] | null {
  if (!ax && !ay && !az) return null;
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
  // local→world R = Rz·Ry·Rx ; world→local = Rᵀ
  const r = [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy, cy * sx, cy * cx,
  ];
  return [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]];
}

export class Prim {
  readonly bb: Float64Array;
  private tmp = new Float64Array(3);
  constructor(public shape: Shape, public mat: Mat, public xf: Xf, bb: number[], public disp?: Shape, public dispAmp = 0) {
    this.bb = new Float64Array(bb);
  }
  /** Uniform scale applied around the model origin (see Model.scale). */
  s = 1;
  d(x: number, y: number, z: number): number {
    const o = this.tmp;
    this.xf.apply(x, y, z, o);
    const k = this.s;
    const lx = o[0] / k, ly = o[1] / k, lz = o[2] / k;
    let d = this.shape(lx, ly, lz);
    if (this.disp && d < this.dispAmp * 2 + 0.05) d += this.disp(lx, ly, lz);
    return d * k;
  }
  local(x: number, y: number, z: number, o: Float64Array): void {
    this.xf.apply(x, y, z, o);
    o[0] /= this.s; o[1] /= this.s; o[2] /= this.s;
  }
}

// ── local shapes ──

export const sdBox = (hx: number, hy: number, hz: number, r = 0): Shape => (x, y, z) => {
  const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r, qz = Math.abs(z) - hz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
};
export const sdSphere = (r: number): Shape => (x, y, z) => Math.sqrt(x * x + y * y + z * z) - r;
export const sdEllipsoid = (a: number, b: number, c: number): Shape => (x, y, z) => {
  const k0 = Math.sqrt((x / a) ** 2 + (y / b) ** 2 + (z / c) ** 2);
  const k1 = Math.sqrt((x / (a * a)) ** 2 + (y / (b * b)) ** 2 + (z / (c * c)) ** 2);
  return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(a, b, c);
};
/** Vertical cylinder, half-height h, edge rounding r. */
export const sdCyl = (rad: number, h: number, r = 0): Shape => (x, y, z) => {
  const dx = Math.sqrt(x * x + y * y) - rad + r, dz = Math.abs(z) - h + r;
  return Math.min(Math.max(dx, dz), 0) + Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dz, 0) ** 2) - r;
};
/** Vertical frustum: radius r0 at z=-h, r1 at z=+h. */
export const sdCone = (r0: number, r1: number, h: number): Shape => (x, y, z) => {
  const q = Math.sqrt(x * x + y * y);
  const k1x = r1, k1y = h, k2x = r1 - r0, k2y = 2 * h;
  const cax = q - Math.min(q, z < 0 ? r0 : r1), cay = Math.abs(z) - h;
  const t = Math.max(0, Math.min(1, ((k1x - q) * k2x + (k1y - z) * k2y) / (k2x * k2x + k2y * k2y)));
  const cbx = q - k1x + k2x * t, cby = z - k1y + k2y * t;
  const s = cbx < 0 && cay < 0 ? -1 : 1;
  return s * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
};
export const sdTorus = (R: number, r: number): Shape => (x, y, z) => {
  const q = Math.sqrt(x * x + y * y) - R;
  return Math.sqrt(q * q + z * z) - r;
};
/** Triangular prism along x: base width 2·hw at z=-hh, apex at z=+hh, length 2·hl. */
export const sdRoof = (hl: number, hw: number, hh: number, r = 0): Shape => (x, y, z) => {
  // plane distances of the two slopes
  const len = Math.sqrt(hw * hw + 4 * hh * hh);
  const nY = (2 * hh) / len, nZ = hw / len;
  const slope = Math.abs(y) * nY + (z - hh) * nZ;
  const base = -z - hh;
  const ends = Math.abs(x) - hl;
  const inner = Math.max(slope, base, ends);
  if (r === 0) return inner;
  return inner - r;
};
export const sdCapsuleZ = (h: number, r: number): Shape => (x, y, z) => {
  const zz = z - Math.max(-h, Math.min(h, z));
  return Math.sqrt(x * x + y * y + zz * zz) - r;
};

export const opSub = (a: Shape, b: Shape): Shape => (x, y, z) => Math.max(a(x, y, z), -b(x, y, z));
export const opInter = (a: Shape, b: Shape): Shape => (x, y, z) => Math.max(a(x, y, z), b(x, y, z));
export const opShell = (a: Shape, t: number): Shape => (x, y, z) => Math.abs(a(x, y, z)) - t;
export const opMove = (a: Shape, dx: number, dy: number, dz: number): Shape => (x, y, z) => a(x - dx, y - dy, z - dz);
export const opUnion = (...s: Shape[]): Shape => (x, y, z) => { let d = Infinity; for (const f of s) { const v = f(x, y, z); if (v < d) d = v; } return d; };

export interface Opt {
  rot?: [number, number, number];
  disp?: Shape;
  dispAmp?: number;
}

/**
 * A model: a bag of primitives with materials. Helpers place common shapes
 * in world (tile) coordinates; bounding boxes are derived conservatively.
 */
export class Model {
  prims: Prim[] = [];
  /** Animation phase available to material functions (0..1). */
  t = 0;

  add(shape: Shape, mat: Mat, c: [number, number, number], ext: [number, number, number], o: Opt = {}): Prim {
    const m = o.rot ? rotMat(o.rot[0], o.rot[1], o.rot[2]) : null;
    // rotated: use the bounding sphere of the extent box
    const pad = (o.dispAmp ?? 0) + 0.002;
    let ex = ext[0] + pad, ey = ext[1] + pad, ez = ext[2] + pad;
    if (m) { const r = Math.sqrt(ext[0] ** 2 + ext[1] ** 2 + ext[2] ** 2) + pad; ex = ey = ez = r; }
    const p = new Prim(shape, mat, new Xf(c[0], c[1], c[2], m), [c[0] - ex, c[1] - ey, c[2] - ez, c[0] + ex, c[1] + ey, c[2] + ez], o.disp, o.dispAmp ?? 0);
    this.prims.push(p);
    return p;
  }

  box(c: [number, number, number], h: [number, number, number], mat: Mat, r = 0.01, o: Opt = {}): Prim {
    return this.add(sdBox(h[0], h[1], h[2], Math.min(r, h[0], h[1], h[2])), mat, c, h, o);
  }
  /** Box from min/max corners. */
  boxMM(a: [number, number, number], b: [number, number, number], mat: Mat, r = 0.01, o: Opt = {}): Prim {
    return this.box([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, Math.abs(b[2] - a[2]) / 2], mat, r, o);
  }
  sphere(c: [number, number, number], r: number, mat: Mat, o: Opt = {}): Prim {
    return this.add(sdSphere(r), mat, c, [r, r, r], o);
  }
  ellipsoid(c: [number, number, number], a: number, b: number, cc: number, mat: Mat, o: Opt = {}): Prim {
    return this.add(sdEllipsoid(a, b, cc), mat, c, [a, b, cc], o);
  }
  /** Cylinder standing on z0 to z1 (or along x/y when rotated via axis). */
  cyl(c: [number, number, number], rad: number, h: number, mat: Mat, axis: 'x' | 'y' | 'z' = 'z', r = 0.008, o: Opt = {}): Prim {
    const rot: [number, number, number] | undefined = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : o.rot;
    const ext: [number, number, number] = axis === 'x' ? [h, rad, rad] : axis === 'y' ? [rad, h, rad] : [rad, rad, h];
    return this.add(sdCyl(rad, h, Math.min(r, rad, h)), mat, c, ext, { ...o, rot: rot ?? o.rot });
  }
  cone(c: [number, number, number], r0: number, r1: number, h: number, mat: Mat, o: Opt = {}): Prim {
    const r = Math.max(r0, r1);
    return this.add(sdCone(r0, r1, h), mat, c, [r, r, h], o);
  }
  torus(c: [number, number, number], R: number, r: number, mat: Mat, o: Opt = {}): Prim {
    return this.add(sdTorus(R, r), mat, c, [R + r, R + r, r], o);
  }
  roof(c: [number, number, number], hl: number, hw: number, hh: number, mat: Mat, o: Opt = {}): Prim {
    return this.add(sdRoof(hl, hw, hh), mat, c, [hl, hw, hh], o);
  }
  /** Capsule between two world points. */
  capsule(a: [number, number, number], b: [number, number, number], r: number, mat: Mat, o: Opt = {}): Prim {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const c: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    // orient local z along (dx,dy,dz)
    const ay = Math.acos(Math.max(-1, Math.min(1, dz / (len || 1))));
    const az = Math.atan2(dy, dx);
    const p = this.add(sdCapsuleZ(len / 2, r), mat, c, [len / 2 + r, len / 2 + r, len / 2 + r], { ...o, rot: [0, ay, az] });
    return p;
  }
  /** Smoothly blended cluster of spheres/ellipsoids (foliage, rocks, clouds). */
  blob(parts: [number, number, number, number][], k: number, mat: Mat, o: Opt & { squash?: number } = {}): Prim {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    const sq = o.squash ?? 1;
    for (const [x, y, z, r] of parts) { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); z0 = Math.min(z0, z - r * sq); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); z1 = Math.max(z1, z + r * sq); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const ps = parts.map(([x, y, z, r]) => [x - cx, y - cy, z - cz, r]);
    const isq = 1 / sq;
    const shape: Shape = (x, y, z) => {
      let d = Infinity;
      for (const [px, py, pz, r] of ps) {
        const dx = x - px, dy = y - py, dz = (z - pz) * isq;
        const v = Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
        d = d === Infinity ? v : smin(d, v, k);
      }
      return d * (sq < 1 ? sq : 1);
    };
    return this.add(shape, mat, [cx, cy, cz], [(x1 - x0) / 2 + k, (y1 - y0) / 2 + k, (z1 - z0) / 2 + k], o);
  }

  /** Scale the whole model uniformly about its origin (footprint centre on the ground). */
  scale(k: number): this {
    for (const p of this.prims) {
      p.s *= k;
      p.xf.cx *= k; p.xf.cy *= k; p.xf.cz *= k;
      for (let i = 0; i < 6; i++) p.bb[i] *= k;
    }
    return this;
  }

  bounds(): [number, number, number, number, number, number] {
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const p of this.prims) {
      const b = p.bb;
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); z0 = Math.min(z0, b[2]);
      x1 = Math.max(x1, b[3]); y1 = Math.max(y1, b[4]); z1 = Math.max(z1, b[5]);
    }
    return [x0, y0, z0, x1, y1, z1];
  }
}
