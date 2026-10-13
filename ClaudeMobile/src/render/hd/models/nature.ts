import { MAT, foliage, leafDisp } from '../mats';
import { hash3 } from '../noise';
import { Model } from '../sdf';

type V3 = [number, number, number];

/** A broad, lush tree: flared trunk, a few limbs, layered leaf clumps. */
export function tree(seed = 1, sway = 0, scale = 1, blossoms = 0): Model {
  const m = new Model();
  const s = scale;
  const top: V3 = [0.04 * s, -0.03 * s, 1.05 * s];
  m.cone([0, 0, 0.54 * s], 0.15 * s, 0.075 * s, 0.54 * s, MAT.bark);
  // root flares
  for (let r = 0; r < 5; r++) {
    const a = (r / 5) * Math.PI * 2 + seed;
    const len = (0.2 + hash3(r, seed, 1) * 0.1) * s;
    m.capsule([Math.cos(a) * 0.06 * s, Math.sin(a) * 0.06 * s, 0.12 * s], [Math.cos(a) * len, Math.sin(a) * len, -0.02], 0.05 * s, MAT.bark);
  }
  // limbs reaching into the crown
  const limbs: V3[] = [[-0.36, 0.14, 1.3], [0.34, -0.22, 1.36], [0.06, 0.34, 1.5], [-0.12, -0.32, 1.56], [0.1, 0.05, 1.8]];
  for (const [x, y, z] of limbs) m.capsule(top, [x * s, y * s, z * s], 0.04 * s, MAT.bark);
  // many leaf clumps on a dome so the crown reads as layered foliage
  const clumps: [number, number, number, number][] = [];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = i * 2.39996 + seed, f = i / (N - 1);
    const ring = Math.sqrt(1 - f * 0.85);
    const r = 0.5 * ring;
    clumps.push([Math.cos(a) * r, Math.sin(a) * r * 0.95, 1.2 + f * 0.85 - ring * 0.05, 0.2 + (1 - f) * 0.06 + hash3(i, seed, 7) * 0.05]);
  }
  const sh = clumps.map(([x, y, z, r]) => [x * s + sway * (z - 1) * 0.035, y * s - sway * (z - 1) * 0.018, z * s, r * s] as [number, number, number, number]);
  const leaves = [foliage(0x5c9c3c, 0xa6d45c, seed), foliage(0x4f8e3a, 0x94c656, seed + 3), foliage(0x68a83e, 0xb4dc66, seed + 7)];
  for (let i = 0; i < sh.length; i++) m.blob([sh[i]], 0.01, leaves[i % 3], { disp: leafDisp(0.07 * s, seed + i), dispAmp: 0.07 * s });
  for (let b = 0; b < blossoms; b++) {
    const c = sh[(b * 5) % sh.length];
    const a = hash3(b, seed, 3) * Math.PI * 2, e = hash3(b, seed, 4) * 1.2 - 0.1;
    m.sphere([c[0] + Math.cos(a) * Math.cos(e) * c[3] * 0.98, c[1] + Math.sin(a) * Math.cos(e) * c[3] * 0.98, c[2] + Math.sin(e) * c[3] * 0.98], 0.026 * s, MAT.blossom);
  }
  return m;
}
