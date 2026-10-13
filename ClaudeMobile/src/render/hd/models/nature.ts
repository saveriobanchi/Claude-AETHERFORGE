import { MAT, foliage, leafDisp, rockDisp } from '../mats';
import { hash3 } from '../noise';
import { Model } from '../sdf';

export type V3 = [number, number, number];

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
  // a broad crown of distinct leaf masses: a lower skirt, a middle ring and a top
  const clumps: [number, number, number, number][] = [];
  const ring = (n: number, r: number, z: number, cr: number, ph: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ph + hash3(i, seed, 5) * 0.4;
      clumps.push([Math.cos(a) * r, Math.sin(a) * r, z + (hash3(i, seed, 6) - 0.5) * 0.1, cr * (0.85 + hash3(i, seed, 7) * 0.3)]);
    }
  };
  ring(7, 0.5, 1.22, 0.24, seed);
  ring(5, 0.32, 1.52, 0.25, seed + 1);
  ring(3, 0.14, 1.78, 0.22, seed + 2);
  clumps.push([0.02, -0.02, 1.95, 0.17]);
  const sh = clumps.map(([x, y, z, r]) => [x * s + sway * (z - 1) * 0.035, y * s - sway * (z - 1) * 0.018, z * s, r * s] as [number, number, number, number]);
  const leaves = [foliage(0x3f7630, 0x86b444, seed), foliage(0x356a2e, 0x7aa83e, seed + 3), foliage(0x4a8232, 0x94c04a, seed + 7)];
  for (let i = 0; i < sh.length; i++) m.blob([sh[i]], 0.01, leaves[i % 3], { squash: 0.8, disp: leafDisp(0.06 * s, seed + i), dispAmp: 0.06 * s });
  for (let b = 0; b < blossoms; b++) {
    const c = sh[(b * 5) % sh.length];
    const a = hash3(b, seed, 3) * Math.PI * 2, e = hash3(b, seed, 4) * 1.2 - 0.1;
    m.sphere([c[0] + Math.cos(a) * Math.cos(e) * c[3] * 0.98, c[1] + Math.sin(a) * Math.cos(e) * c[3] * 0.98, c[2] + Math.sin(e) * c[3] * 0.98], 0.026 * s, MAT.blossom);
  }
  return m;
}

/** The ancient elder tree: a huge gnarled trunk, a vast crown and warm lanterns hanging from its limbs. */
export function elderTree(sway = 0): Model {
  const m = tree(23, sway, 1.45, 0);
  const s = 1.45;
  // gnarled extra roots and lanterns
  for (let r = 0; r < 4; r++) {
    const a = (r / 4) * Math.PI * 2 + 0.7;
    m.capsule([Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.3], [Math.cos(a) * 0.42, Math.sin(a) * 0.42, -0.02], 0.06, MAT.bark);
  }
  for (const [x, y, z] of [[-0.5, 0.2, 1.38], [0.48, -0.3, 1.45], [0.1, 0.5, 1.52]]) {
    const p: V3 = [x * s * 0.95, y * s * 0.95, z * s - 0.32];
    m.capsule([p[0], p[1], p[2] + 0.2], [p[0], p[1], p[2] + 0.05], 0.004, MAT.ironDark);
    lanternAt(m, p);
  }
  for (let b = 0; b < 10; b++) {
    const a = hash3(b, 23, 1) * Math.PI * 2, rr = 0.5 + hash3(b, 23, 2) * 0.35;
    m.sphere([Math.cos(a) * rr * s * 0.75, Math.sin(a) * rr * s * 0.75, (1.3 + hash3(b, 23, 3) * 0.6) * s], 0.03, MAT.amber);
  }
  return m;
}

function lanternAt(m: Model, p: V3): void {
  m.box(p, [0.028, 0.028, 0.038], MAT.lamp, 0.006);
  m.cone([p[0], p[1], p[2] + 0.052], 0.042, 0.01, 0.016, MAT.ironDark);
  m.box([p[0], p[1], p[2] - 0.044], [0.034, 0.034, 0.006], MAT.ironDark, 0.003);
}

/** Sapling growth stages 0..2. */
export function sapling(stage: number, sway = 0): Model {
  const m = new Model();
  m.blob([[0, 0, 0.0, 0.12]], 0.01, MAT.soil, { squash: 0.35 });
  const h = 0.12 + stage * 0.14;
  m.capsule([0, 0, 0], [sway * 0.01, 0, h], 0.012 + stage * 0.006, MAT.bark);
  const r = 0.06 + stage * 0.05;
  m.blob([[sway * 0.012, 0, h + r * 0.4, r], [r * 0.5 + sway * 0.012, -r * 0.3, h + r * 0.1, r * 0.7], [-r * 0.5, r * 0.4, h, r * 0.65]], r * 0.4, MAT.leaf, { disp: leafDisp(r * 0.3, stage), dispAmp: r * 0.3 });
  return m;
}

/** Fiber tuft: tall pale grasses with seed heads. */
export function tuft(sway = 0): Model {
  const m = new Model();
  for (let i = 0; i < 16; i++) {
    const a = hash3(i, 1, 1) * Math.PI * 2, r = hash3(i, 1, 2) * 0.14;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    const h = 0.2 + hash3(i, 1, 3) * 0.2;
    const lean = (hash3(i, 1, 4) - 0.5) * 0.12 + sway * 0.03;
    m.capsule([x, y, 0], [x + lean, y + lean * 0.4, h], 0.008, i % 3 ? MAT.blade : MAT.bladeLight);
    if (i % 2) m.ellipsoid([x + lean * 1.05, y + lean * 0.42, h + 0.03], 0.012, 0.012, 0.035, MAT.seedHead);
  }
  return m;
}

/** Islet hearts: ore vein, spring, star shard. */
export function node(kind: 'node_vein' | 'node_spring' | 'node_shard', f = 0): Model {
  const m = new Model();
  if (kind === 'node_vein') {
    m.blob([[-0.12, 0.08, 0.12, 0.2], [0.14, -0.1, 0.16, 0.22], [0.02, 0.0, 0.32, 0.16]], 0.08, MAT.rockBare, { disp: rockDisp(0.05, 6), dispAmp: 0.05 });
    for (let i = 0; i < 9; i++) {
      const a = hash3(i, 5, 1) * Math.PI * 2, z = 0.12 + hash3(i, 5, 2) * 0.25;
      m.add((x, y, zz) => (Math.abs(x) + Math.abs(y) + Math.abs(zz) - 0.035) * 0.57, i % 3 ? MAT.copper : MAT.ironOre, [Math.cos(a) * 0.24, Math.sin(a) * 0.22, z], [0.04, 0.04, 0.04]);
    }
  } else if (kind === 'node_spring') {
    m.add((x, y, z) => Math.max(Math.hypot(x, y) - 0.36, Math.abs(z) - 0.05, -(Math.max(Math.hypot(x, y) - 0.28, -z))), MAT.rock, [0, 0, 0.05], [0.37, 0.37, 0.06]);
    m.cyl([0, 0, 0.06], 0.29, 0.02, MAT.water);
    const r = 0.05 + f * 0.15;
    m.torus([0, 0, 0.085], r, 0.008, MAT.foam);
    for (let i = 0; i < 4; i++) m.sphere([(hash3(i, 6, 1) - 0.5) * 0.3, (hash3(i, 6, 2) - 0.5) * 0.3, 0.1 + ((f + i / 4) % 1) * 0.16], 0.016, MAT.foam);
  } else {
    m.blob([[0, 0, 0.04, 0.2]], 0.05, MAT.rockBare, { squash: 0.5, disp: rockDisp(0.03, 7), dispAmp: 0.03 });
    for (const [x, y, h, a] of [[0, 0, 0.42, 0], [0.12, -0.06, 0.26, 0.4], [-0.1, 0.08, 0.22, -0.4]]) {
      m.add((xx, yy, zz) => (Math.abs(xx) + Math.abs(yy) + Math.abs(zz) * (0.12 / h) - 0.06) * 0.57, MAT.starShard, [x, y, 0.08 + h * 0.5], [0.07, 0.07, h * 0.55], { rot: [a * 0.6, a, 0] });
    }
    if (f > 0.5) m.sphere([0.18, 0.1, 0.4], 0.015, MAT.star);
  }
  return m;
}

/** A small distant floating islet for the sky backdrop. */
export function skyIslet(seed: number, fall: boolean): Model {
  const m = new Model();
  const r = 0.9 + hash3(seed, 1, 1) * 0.6;
  m.add((x, y, z) => {
    const t = Math.min(1, Math.max(0, -z / (r * 2.2)));
    const rr = r * (1 - t * 0.85);
    return Math.max(Math.hypot(x, y) - rr, z - 0, -z - r * 2.2);
  }, MAT.cliffRock, [0, 0, 0], [r, r, r * 2.3], { disp: rockDisp(0.18, 1.6), dispAmp: 0.2 });
  m.cyl([0, 0, 0.03], r * 1.02, 0.06, MAT.grass, 'z', 0.05, { disp: (x, y) => hash3(Math.floor(x * 9), Math.floor(y * 9), seed) * 0.02, dispAmp: 0.02 });
  const n = 1 + Math.floor(hash3(seed, 2, 2) * 3);
  for (let i = 0; i < n; i++) {
    const a = hash3(i, seed, 3) * Math.PI * 2, d = hash3(i, seed, 4) * r * 0.5;
    const sub = tree(seed + i, 0, 0.7 + hash3(i, seed, 5) * 0.3, 0);
    for (const p of sub.prims) { p.xf.cx += Math.cos(a) * d; p.xf.cy += Math.sin(a) * d; p.xf.cz += 0.06; for (const k of [0, 3]) p.bb[k] += Math.cos(a) * d; for (const k of [1, 4]) p.bb[k] += Math.sin(a) * d; p.bb[2] += 0.06; p.bb[5] += 0.06; m.prims.push(p); }
  }
  if (fall) m.box([0.1, r * 0.95, -r * 0.9], [0.08, 0.02, r * 0.9], MAT.fall, 0.02);
  return m;
}
