import { MAT, leafDisp, mat, rock, rockDisp } from '../mats';
import { clamp, fbm, hash3, lin, mix, smoothstep, tfbm, voronoi } from '../noise';
import { Model, type RGB } from '../sdf';

/**
 * Terrain pieces. Each tile is drawn as a rock column (its depth grows toward
 * the island's interior) followed by its top surface. Tops tile seamlessly:
 * their textures are periodic per tile and the slab extends under closed
 * neighbours (then clipped) so lighting is continuous across tiles.
 *
 * Open-side mask bits: 1 = +x, 2 = +y, 4 = −x, 8 = −y.
 */

export type Floor = 'grass' | 'stone' | 'sky';

const lerp3 = (out: RGB, a: RGB, b: RGB, t: number) => { out[0] = mix(a[0], b[0], t); out[1] = mix(a[1], b[1], t); out[2] = mix(a[2], b[2], t); };

const G1 = lin(0x64a23c), G2 = lin(0x86bf4e), G3 = lin(0xa6d062), GD = lin(0x52903a);
/** Tileable meadow grass colour. */
const grassTop = mat((h, out) => {
  const u = h.x + 0.5, v = h.y + 0.5;
  const n = tfbm(u, v, 3, 4, 1), m = tfbm(u, v, 1, 2, 2), f = tfbm(u, v, 16, 2, 3);
  lerp3(out, G1, G2, smoothstep(-0.35, 0.35, n));
  lerp3(out, out, G3, smoothstep(0.15, 0.45, m) * 0.4);
  lerp3(out, out, GD, smoothstep(0.3, 0.6, -f) * 0.2);
  // the sides of the turf lip turn deeper green
  if (h.gz < 0.6) lerp3(out, out, lin(0x4a8434), clamp((0.6 - h.gz) * 2));
}, { sss: 0.15 });

/** Flagstone paving: 2×2 irregular stones per tile (periodic). */
const flagTop = mat((h, out) => {
  const u = h.x + 0.5, v = h.y + 0.5;
  const fu = u * 2 - Math.floor(u * 2), fv = v * 2 - Math.floor(v * 2);
  const su = Math.floor(u * 2), sv = Math.floor(v * 2);
  const tone = 0.9 + hash3(((su % 2) + 2) % 2, ((sv % 2) + 2) % 2, 3) * 0.16;
  const j = Math.min(smoothstep(0, 0.06, fu), smoothstep(1, 0.94, fu), smoothstep(0, 0.06, fv), smoothstep(1, 0.94, fv));
  const base = lin(0xd2c4ac), mortar = lin(0x8a7a6a);
  lerp3(out, mortar, base, j);
  const t = 0.96 + tfbm(u, v, 2, 2, 5) * 0.08;
  out[0] *= tone * t; out[1] *= tone * t; out[2] *= tone * t;
}, { bump: (x, y) => { const u = (x + 0.5) * 2, v = (y + 0.5) * 2; const fu = u - Math.floor(u), fv = v - Math.floor(v); return Math.min(smoothstep(0, 0.06, fu), smoothstep(1, 0.94, fu), smoothstep(0, 0.06, fv), smoothstep(1, 0.94, fv)) * 0.008; }, bumpAmp: 1 });

/** Skystone: pale polished slabs with glowing aether seams. */
const skyTop = mat((h, out) => {
  const u = h.x + 0.5, v = h.y + 0.5;
  const fu = u * 2 - Math.floor(u * 2), fv = v * 2 - Math.floor(v * 2);
  const j = Math.min(smoothstep(0, 0.05, fu), smoothstep(1, 0.95, fu), smoothstep(0, 0.05, fv), smoothstep(1, 0.95, fv));
  lerp3(out, lin(0x6a7a96), lin(0xdce4ee), j);
}, {
  spec: 0.6, pow: 60,
  emit: (h, out) => {
    const u = h.x + 0.5, v = h.y + 0.5;
    const fu = u * 2 - Math.floor(u * 2), fv = v * 2 - Math.floor(v * 2);
    const seam = 1 - Math.min(smoothstep(0, 0.035, fu), smoothstep(1, 0.965, fu), smoothstep(0, 0.035, fv), smoothstep(1, 0.965, fv));
    const k = seam * 1.6;
    out[0] = 0.25 * k; out[1] = 0.65 * k; out[2] = 1.0 * k;
  },
});

const soil = mat((h, out) => lerp3(out, lin(0x7a5034), lin(0x9c6c46), smoothstep(-0.3, 0.3, fbm(h.x * 4, h.y * 4, h.z * 4, 2))));

const cliff = rock(0xb39a7e, 0.6);
const cliffDeep = rock(0x9e8a78, 0.2);

/** Top surface for one tile. */
export function topPiece(floor: Floor, mask: number, variant: number): { m: Model; clip: (x: number, y: number, z: number) => boolean } {
  const m = new Model();
  const open = (b: number) => (mask & b) !== 0;
  const ext = (b: number) => (open(b) ? 0.5 : 1.2);
  const x0 = -ext(4), x1 = ext(1), y0 = -ext(8), y1 = ext(2);
  const surf = floor === 'grass' ? grassTop : floor === 'stone' ? flagTop : skyTop;
  const thick = floor === 'grass' ? 0.07 : 0.06;
  // slab with an organic, slightly overhanging lip on open sides
  const lip = floor === 'grass' ? 0.035 : 0.015;
  m.add((x, y, z) => {
    const qx = Math.max(x0 - x, x - x1), qy = Math.max(y0 - y, y - y1);
    const side = Math.max(qx, qy);
    const wob = floor === 'grass' ? fbm(x * 9 + variant * 5, y * 9, 0.5, 3) * 0.03 : 0;
    const zz = Math.max(z - 0, -thick - z);
    const k = Math.max(side + wob, zz);
    return k - (floor === 'grass' ? 0 : 0.004);
  }, surf, [(x0 + x1) / 2, (y0 + y1) / 2, -thick / 2], [(x1 - x0) / 2 + 0.05, (y1 - y0) / 2 + 0.05, thick / 2 + 0.03], { rot: undefined });
  // the prim's own frame is centred: shape above uses world coords, so undo by placing at origin
  m.prims[0].xf.cx = 0; m.prims[0].xf.cy = 0; m.prims[0].xf.cz = 0;
  if (floor === 'grass') {
    // grass fringe hanging over open edges
    for (const [b, ax, ay, ox, oy] of [[1, 0, 1, 0.5, 0], [2, 1, 0, 0, 0.5], [4, 0, 1, -0.5, 0], [8, 1, 0, 0, -0.5]] as [number, number, number, number, number][]) {
      if (!open(b)) continue;
      for (let i = 0; i < 9; i++) {
        const t = (i + 0.5) / 9 - 0.5 + (hash3(i, b, variant) - 0.5) * 0.08;
        const px = ox + ax * t, py = oy + ay * t;
        const len = 0.04 + hash3(i, b, variant + 1) * 0.07;
        const outx = Math.sign(ox) * 0.03, outy = Math.sign(oy) * 0.03;
        m.capsule([px, py, -0.03], [px + outx, py + outy, -0.03 - len], 0.009 + hash3(i, b, 3) * 0.006, MAT.leafDark);
      }
    }
  }
  const o = (b: number) => (open(b) ? 0.2 : 0.006);
  const clip = (x: number, y: number) => x >= -0.5 - o(4) && x <= 0.5 + o(1) && y >= -0.5 - o(8) && y <= 0.5 + o(2);
  void lip;
  return { m, clip };
}

/** Rocky column under a tile, `depth` units deep (1 unit = one tile edge of height). */
export function columnPiece(depth: number, variant: number): Model {
  const m = new Model();
  const sx = variant * 13.7, sy = variant * 7.1;
  // soil band with roots
  m.box([0, 0, -0.14], [0.51, 0.51, 0.08], soil, 0.03, { disp: (x, y, z) => fbm(x * 5 + sx, y * 5 + sy, z * 5, 2) * 0.015, dispAmp: 0.015 });
  // tapering rock body: square-ish near the top, narrowing toward a ragged point
  const top = -0.2, bot = -depth;
  const H = top - bot;
  const mat = depth > 4 ? cliffDeep : cliff;
  m.add((x, y, z) => {
    const t = clamp((top - z) / H);
    const hw = 0.5 - 0.22 * Math.pow(t, 1.4) - (t > 0.85 ? (t - 0.85) * 1.6 : 0);
    const qx = Math.abs(x) - hw, qy = Math.abs(y) - hw, qz = Math.max(z - top, bot - z);
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    const d = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0);
    return Math.max(d, qz) - 0.03;
  }, mat, [0, 0, 0], [0.56, 0.56, Math.max(Math.abs(top), Math.abs(bot)) + 0.1], {
    disp: (x, y, z) => rockDisp(0.1, 2.6)(x + sx, y + sy, z) + (voronoi(x * 4 + sx, y * 4 + sy, z * 2.5) - 0.4) * 0.04,
    dispAmp: 0.12,
  });
  // hanging roots and vines on the visible faces
  const nv = 2 + Math.floor(hash3(variant, 2, 9) * 3);
  for (let q = 0; q < nv; q++) {
    const face = hash3(q, variant, 1) < 0.5;
    const t = -0.4 + hash3(q, variant, 2) * 0.8;
    const len = 0.25 + hash3(q, variant, 3) * Math.min(1.2, depth * 0.4);
    const x = face ? 0.53 : t, y = face ? t : 0.53;
    const isVine = hash3(q, variant, 4) < 0.6;
    const segs = 4;
    for (let k = 0; k < segs; k++) {
      const z0 = -0.1 - (len * k) / segs, z1 = -0.1 - (len * (k + 1)) / segs;
      const wob = (i: number) => (hash3(q, i, variant) - 0.5) * 0.03;
      m.capsule([x + (face ? 0.01 : wob(k)), y + (face ? wob(k) : 0.01), z0], [x + (face ? 0.01 : wob(k + 1)), y + (face ? wob(k + 1) : 0.01), z1], isVine ? 0.008 : 0.011, isVine ? MAT.leafDark : MAT.bark);
    }
  }
  return m;
}

export function hashDepth(dist: number, x: number, y: number): number {
  const n = hash3(x, y, 77);
  return Math.max(1, Math.min(7.5, 0.9 + dist * 1.5 + (n - 0.5) * 1.2));
}

/** Small decorations scattered on grass at runtime (positions vary per tile). */
export function decor(kind: 'tuft' | 'flowers' | 'bush' | 'stone', variant: number): Model {
  const m = new Model();
  if (kind === 'tuft') {
    const blades = 11;
    for (let b = 0; b < blades; b++) {
      const a = (b / blades) * Math.PI * 2 + variant, r = 0.01 + hash3(b, variant, 2) * 0.02;
      const h = 0.06 + hash3(b, variant, 3) * 0.07, lean = 0.025 + hash3(b, variant, 5) * 0.03;
      m.capsule([Math.cos(a) * r, Math.sin(a) * r, -0.005], [Math.cos(a) * (r + lean), Math.sin(a) * (r + lean), h], 0.007, b % 3 ? MAT.blade : MAT.bladeLight);
    }
  } else if (kind === 'flowers') {
    const col = [MAT.flowerY, MAT.flowerW, MAT.flowerP, MAT.flowerB][((variant % 4) + 4) % 4];
    for (let b = 0; b < 5; b++) {
      const fx = (hash3(b, variant, 7) - 0.5) * 0.1, fy = (hash3(b, variant, 8) - 0.5) * 0.1;
      const h = 0.04 + hash3(b, variant, 9) * 0.04;
      m.capsule([fx, fy, 0], [fx, fy, h], 0.005, MAT.blade);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        m.sphere([fx + Math.cos(a) * 0.011, fy + Math.sin(a) * 0.011, h + 0.006], 0.009, col);
      }
      m.sphere([fx, fy, h + 0.009], 0.006, MAT.flowerY);
    }
  } else if (kind === 'bush') {
    m.blob([[0, 0, 0.06, 0.09], [0.07, -0.03, 0.05, 0.07], [-0.06, 0.04, 0.045, 0.07], [0.0, 0.0, 0.12, 0.06]], 0.04, MAT.leafDark, { disp: leafDisp(0.025, variant), dispAmp: 0.025 });
    if (variant % 2) for (let b = 0; b < 5; b++) m.sphere([(hash3(b, variant, 1) - 0.5) * 0.14, (hash3(b, variant, 2) - 0.5) * 0.12, 0.08 + hash3(b, variant, 3) * 0.08], 0.013, MAT.berry);
  } else {
    m.ellipsoid([0, 0, 0.01], 0.07, 0.055, 0.045, MAT.rock, { disp: rockDisp(0.015, 9), dispAmp: 0.015 });
    m.ellipsoid([0.06, 0.04, 0.0], 0.035, 0.03, 0.025, MAT.rockBare);
  }
  return m;
}
