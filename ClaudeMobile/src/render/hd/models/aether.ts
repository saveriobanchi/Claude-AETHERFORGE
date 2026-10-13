import { MAT } from '../mats';
import { hash3 } from '../noise';
import { Model } from '../sdf';
import { barrel, beam, chimney, gable, gear, lantern, pipe, plinth, post, type V3 } from './parts';

/** Power, aether and late-game buildings. `f` is the animation phase in [0, 1). */

const TAU = Math.PI * 2;

/** Windmill: tapered stone tower, timber cap with a shingle cone, four lattice sails. */
export function windmill(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05);
  m.cone([0, 0, 0.6], 0.38, 0.29, 0.55, MAT.towerStone);
  m.box([0, 0.35, 0.22], [0.075, 0.03, 0.13], MAT.darkWood, 0.03);
  m.box([0.25, 0.14, 0.78], [0.03, 0.045, 0.055], MAT.window, 0.008);
  m.cyl([0, 0, 1.2], 0.33, 0.07, MAT.oak);
  m.cone([0, 0, 1.47], 0.39, 0.02, 0.21, MAT.roof);
  const hub: V3 = [0, 0.43, 1.17];
  m.cyl([0, 0.32, 1.17], 0.035, 0.12, MAT.beamY, 'y');
  m.sphere(hub, 0.055, MAT.ironDark);
  const rot = f * (Math.PI / 2);
  for (let s = 0; s < 4; s++) {
    const a = rot + (s * Math.PI) / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const px = -sa, pz = ca;
    const tip: V3 = [ca * 0.92, hub[1], hub[2] + sa * 0.92];
    m.capsule(hub, tip, 0.017, MAT.post);
    m.box([ca * 0.58 + px * 0.09, hub[1] + 0.01, hub[2] + sa * 0.58 + pz * 0.09], [0.33, 0.005, 0.072], MAT.sail, 0.003, { rot: [0, -a, 0] });
    for (let r = 0; r < 5; r++) {
      const t = 0.28 + r * 0.155;
      m.capsule([ca * t, hub[1] + 0.012, hub[2] + sa * t], [ca * t + px * 0.17, hub[1] + 0.012, hub[2] + sa * t + pz * 0.17], 0.007, MAT.post);
    }
    m.capsule([ca * 0.25 + px * 0.17, hub[1] + 0.012, hub[2] + sa * 0.25 + pz * 0.17], [tip[0] + px * 0.17, hub[1] + 0.012, tip[2] + pz * 0.17], 0.007, MAT.post);
  }
  barrel(m, [-0.34, 0.32, 0.05], 0.06, 0.14);
  return m;
}

/** Breeze engine: copper boiler drum with a glowing aether core and a spinning turbine. */
export function engine(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05, MAT.stoneDark);
  m.box([0, 0, 0.14], [0.36, 0.34, 0.09], MAT.iron, 0.02);
  m.cyl([0, 0, 0.45], 0.26, 0.22, MAT.copper);
  for (const z of [0.28, 0.45, 0.62]) m.torus([0, 0, z], 0.265, 0.012, MAT.brass);
  // core window toward +y with turbine
  m.cyl([0, 0.25, 0.45], 0.12, 0.02, MAT.aether, 'y');
  gear(m, [0, 0.27, 0.45], 0.1, 0.008, 'y', f * TAU, 6, MAT.ironDark);
  m.torus([0, 0.26, 0.45], 0.12, 0.016, MAT.brass, { rot: [Math.PI / 2, 0, 0] });
  m.cone([0, 0, 0.72], 0.2, 0.08, 0.06, MAT.copper);
  pipe(m, [[0.18, -0.12, 0.7], [0.18, -0.12, 0.95]], 0.03, MAT.ironDark);
  pipe(m, [[-0.2, -0.2, 0.6], [-0.2, -0.2, 0.88]], 0.025, MAT.ironDark);
  pipe(m, [[0.26, 0.1, 0.35], [0.38, 0.1, 0.35], [0.38, 0.1, 0.1]], 0.02, MAT.copper);
  return m;
}

/** Cloud condenser: a glass column filling with glowing mist inside a copper frame, an intake fan. */
export function condenser(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05, MAT.stoneDark);
  m.box([0, 0, 0.1], [0.3, 0.3, 0.05], MAT.iron, 0.015);
  m.cyl([0, 0, 0.62], 0.17, 0.48, MAT.glass);
  const fill = 0.25 + f * 0.6;
  m.cyl([0, 0, 0.15 + fill / 2], 0.15, fill / 2, MAT.mist);
  for (const [x, y] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) post(m, x, y, 0.1, 1.12, 0.025, MAT.copper);
  m.box([0, 0, 1.12], [0.27, 0.27, 0.025], MAT.copper, 0.008);
  m.cone([0, 0, 1.2], 0.15, 0.04, 0.06, MAT.copper);
  // intake fan on +x
  m.cyl([0.33, 0, 0.62], 0.13, 0.025, MAT.ironDark, 'x');
  gear(m, [0.36, 0, 0.62], 0.11, 0.006, 'x', f * TAU, 3, MAT.brass);
  for (let i = 0; i < 4; i++) m.sphere([0.48 + ((f + i * 0.25) % 1) * 0.12, (hash3(i, 2, 1) - 0.5) * 0.2, 0.6 + (hash3(i, 2, 2) - 0.5) * 0.2], 0.03, MAT.cloud);
  return m;
}

/** Aether distiller: a copper still with a glass coil feeding a glowing flask. */
export function distiller(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05);
  m.box([0, 0, 0.14], [0.36, 0.34, 0.09], MAT.brick, 0.015);
  m.cyl([-0.12, 0.06, 0.4], 0.15, 0.17, MAT.copper);
  m.sphere([-0.12, 0.06, 0.56], 0.15, MAT.copper);
  m.cone([-0.12, 0.06, 0.74], 0.06, 0.02, 0.06, MAT.copper);
  pipe(m, [[-0.12, 0.06, 0.8], [0.14, -0.14, 0.82], [0.14, -0.14, 0.6]], 0.016);
  for (let k = 0; k < 4; k++) m.torus([0.14, -0.14, 0.3 + k * 0.08], 0.06, 0.013, MAT.glass);
  m.sphere([0.18, 0.2, 0.36], 0.12, MAT.flask);
  m.cyl([0.18, 0.2, 0.52], 0.03, 0.05, MAT.glass);
  for (let i = 0; i < 3; i++) m.sphere([0.18 + (hash3(i, 4, 1) - 0.5) * 0.1, 0.2, 0.32 + ((f + i / 3) % 1) * 0.12], 0.015, MAT.cloud);
  m.box([-0.12, 0.33, 0.13], [0.06, 0.02, 0.04], MAT.fire, 0.006);
  return m;
}

/** Star net: a sagging net between two tall posts, a jar slowly filling with fallen stars. */
export function starNet(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.03);
  post(m, -0.36, 0.32, 0.03, 1.5, 0.035, MAT.darkPost);
  post(m, 0.32, -0.36, 0.03, 1.62, 0.035, MAT.darkPost);
  m.add((x, y, z) => {
    const u = (x - y) / Math.SQRT2, v = (x + y) / Math.SQRT2;
    const t = (u + 0.48) / 0.96;
    const top = 1.45 + t * 0.1 - Math.sin(t * Math.PI) * 0.22;
    return Math.max(Math.abs(v) - 0.006, Math.abs(u) - 0.46, z - top, 0.95 - z - Math.sin(t * Math.PI) * 0.1);
  }, MAT.net, [0, 0, 0], [0.5, 0.5, 1.6]);
  for (let i = 0; i < 6; i++) {
    const t = hash3(i, 7, 1);
    const u = -0.4 + t * 0.8;
    if (hash3(i, Math.floor(f * 4), 2) > 0.6) m.sphere([u / Math.SQRT2, -u / Math.SQRT2, 1.1 + hash3(i, 7, 3) * 0.25], 0.025, MAT.star);
  }
  m.cyl([0.04, 0.08, 0.15], 0.1, 0.12, MAT.glass);
  m.cyl([0.04, 0.08, 0.1 + f * 0.04], 0.085, 0.06 + f * 0.04, MAT.star);
  m.cyl([0.04, 0.08, 0.28], 0.07, 0.015, MAT.post);
  return m;
}

/** Resonator: a floating crystal held between orbiting brass rings over an iron plinth. */
export function resonator(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05, MAT.stoneDark);
  m.box([0, 0, 0.16], [0.3, 0.3, 0.11], MAT.iron, 0.02);
  m.cyl([0, 0, 0.3], 0.18, 0.03, MAT.brass);
  const bob = Math.sin(f * TAU) * 0.03;
  const c: V3 = [0, 0, 0.72 + bob];
  m.add((x, y, z) => (Math.abs(x) + Math.abs(y) + Math.abs(z) * 0.55 - 0.16) * 0.57, MAT.crystal, c, [0.17, 0.17, 0.3]);
  const a0 = f * Math.PI;
  m.torus(c, 0.3, 0.014, MAT.gold, { rot: [a0, 0.3, 0] });
  m.torus(c, 0.24, 0.012, MAT.brass, { rot: [0.4, a0 + 1, 0] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + f * TAU;
    m.sphere([Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.72 + bob + Math.sin(a * 2) * 0.05], 0.018, MAT.aether);
  }
  return m;
}

/** Crucible: a brick hearth holding a pot of glowing sunmetal between iron rails; ingots cooling. */
export function crucible(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05);
  m.box([0, 0, 0.22], [0.34, 0.34, 0.17], MAT.brick, 0.02);
  m.add((x, y, z) => {
    const r = 0.2 + z * 0.15;
    return Math.max(Math.hypot(x, y) - r, Math.abs(z) - 0.13, -(Math.max(Math.hypot(x, y) - r + 0.035, -(z - 0.1))));
  }, MAT.ironDark, [0, 0, 0.52], [0.25, 0.25, 0.14]);
  m.cyl([0, 0, 0.6], 0.18, 0.01, MAT.molten);
  post(m, -0.36, 0, 0.05, 0.9, 0.03, MAT.iron);
  post(m, 0.36, 0, 0.05, 0.9, 0.03, MAT.iron);
  m.box([0, 0, 0.9], [0.4, 0.04, 0.03], MAT.iron, 0.01);
  m.capsule([0, 0, 0.88], [0, 0, 0.7], 0.006, MAT.ironDark);
  for (let i = 0; i < 3; i++) m.box([-0.22 + i * 0.14, 0.4, 0.07], [0.05, 0.025, 0.02], MAT.ingotHot, 0.008);
  for (let i = 0; i < 2; i++) m.sphere([(hash3(i, 9, 1) - 0.5) * 0.2, (hash3(i, 9, 2) - 0.5) * 0.2, 0.64 + ((f + i * 0.5) % 1) * 0.15], 0.012, MAT.spark);
  chimney(m, [-0.24, -0.24, 0.39], 0.3, 0.05);
  return m;
}

/** Islet drill: an iron derrick boring into the islet heart, crystal glow at its crown. */
export function drill(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05, MAT.stoneDark);
  for (const [x, y] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) m.capsule([x, y, 0.05], [x * 0.25, y * 0.25, 1.35], 0.022, MAT.iron);
  for (const z of [0.4, 0.8, 1.15]) {
    const r = 0.36 - (z / 1.35) * 0.27;
    for (const [a, b] of [[[-r, -r], [r, -r]], [[r, -r], [r, r]], [[r, r], [-r, r]], [[-r, r], [-r, -r]]] as [number[], number[]][]) m.capsule([a[0], a[1], z], [b[0], b[1], z], 0.012, MAT.ironDark);
  }
  m.box([0, 0, 1.38], [0.12, 0.12, 0.05], MAT.brass, 0.012);
  m.add((x, y, z) => {
    const a = Math.atan2(y, x) - z * 30 + f * TAU;
    return Math.hypot(x, y) - 0.035 - (Math.cos(a) > 0 ? 0.01 : 0);
  }, MAT.iron, [0, 0, 0.7], [0.05, 0.05, 0.65]);
  m.add((x, y, z) => (Math.abs(x) + Math.abs(y) + Math.abs(z) * 0.6 - 0.09) * 0.57, MAT.crystal, [0, 0, 1.55], [0.1, 0.1, 0.16]);
  gear(m, [0.14, 0.13, 1.25], 0.08, 0.012, 'y', f * TAU, 9);
  return m;
}

/** Aether pylon: a tapering skystone obelisk with a hovering crystal and orbiting motes. */
export function pylon(f = 0): Model {
  const m = new Model();
  plinth(m, 0.44, 0.06, MAT.stone);
  m.add((x, y, z) => {
    const hw = 0.2 - z * 0.08;
    return Math.max(Math.abs(x) - hw, Math.abs(y) - hw, Math.abs(z - 0.5) - 0.5);
  }, MAT.skystone, [0, 0, 0.06], [0.22, 0.22, 1.02]);
  m.box([0, 0, 1.08], [0.15, 0.15, 0.02], MAT.gold, 0.006);
  const bob = Math.sin(f * TAU) * 0.035;
  m.add((x, y, z) => (Math.abs(x) + Math.abs(y) + Math.abs(z) * 0.5 - 0.1) * 0.57, MAT.crystal, [0, 0, 1.42 + bob], [0.11, 0.11, 0.22]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + f * TAU;
    m.sphere([Math.cos(a) * 0.22, Math.sin(a) * 0.22, 1.42 + bob], 0.018, MAT.aether);
  }
  return m;
}

/** Beacon: a stone pillar crowned with a gold ring and a hovering dark orb ringed with light. */
export function beacon(f = 0): Model {
  const m = new Model();
  plinth(m, 0.44, 0.06);
  m.cyl([0, 0, 0.55], 0.14, 0.5, MAT.towerStone);
  m.cyl([0, 0, 1.08], 0.22, 0.04, MAT.gold);
  const bob = Math.sin(f * TAU) * 0.035;
  m.sphere([0, 0, 1.4 + bob], 0.13, MAT.ironDark);
  m.sphere([-0.05, 0.06, 1.46 + bob], 0.02, MAT.aether);
  m.torus([0, 0, 1.4 + bob], 0.28, 0.012, MAT.aether, { rot: [0.35, 0, f * TAU] });
  return m;
}

/** Wisp roost: a stone tower topped with a woven nest of glowing wisps, perches jutting out. */
export function roost(f = 0): Model {
  const m = new Model();
  plinth(m, 0.44, 0.06);
  m.cone([0, 0, 0.6], 0.2, 0.15, 0.54, MAT.skystone);
  m.add((x, y, z) => Math.max(Math.abs(Math.hypot(x, y) - 0.22) - 0.05, Math.abs(z) - 0.06), MAT.nest, [0, 0, 1.18], [0.3, 0.3, 0.07]);
  m.sphere([0, 0, 1.22], 0.11, MAT.aether);
  for (const [a, z] of [[0.6, 0.8], [2.6, 0.95], [4.4, 0.7]]) {
    const p: V3 = [Math.cos(a) * 0.4, Math.sin(a) * 0.4, z];
    beam(m, [0, 0, z], p, 0.012, MAT.darkPost);
    m.sphere([p[0], p[1], z + 0.04 + Math.sin(f * TAU + a) * 0.01], 0.025, MAT.aether);
  }
  lantern(m, [0.17, 0.12, 0.5], 0.8);
  return m;
}

/** The Aetherforge (3×3): stone dais, iron pillars, glass sanctum, and when awake a great crystal. */
export function forge(stage: number, f = 0): Model {
  const m = new Model();
  m.box([0, 0, 0.05], [1.45, 1.45, 0.05], MAT.stone, 0.03);
  if (stage === 0) {
    for (const [x, y] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) post(m, x, y, 0.1, 0.5, 0.04);
    m.torus([0, 0, 0.11], 0.9, 0.025, MAT.aether);
    m.box([0.6, 0.9, 0.16], [0.18, 0.12, 0.06], MAT.crate, 0.01);
    return m;
  }
  m.box([0, 0, 0.25], [1.32, 1.32, 0.15], MAT.stone, 0.03);
  m.box([0, 0, 0.47], [1.0, 1.0, 0.07], MAT.skystone, 0.03);
  if (stage >= 2) {
    for (const [x, y] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
      m.box([x, y, 1.4], [0.09, 0.09, 0.86], MAT.iron, 0.02);
      m.box([x, y, 0.62], [0.13, 0.13, 0.08], MAT.brass, 0.015);
    }
    for (const [a, b] of [[[-0.8, -0.8], [0.8, -0.8]], [[0.8, -0.8], [0.8, 0.8]], [[0.8, 0.8], [-0.8, 0.8]], [[-0.8, 0.8], [-0.8, -0.8]]]) m.capsule([a[0], a[1], 2.28], [b[0], b[1], 2.28], 0.05, MAT.gold);
    m.box([0, 0, 0.82], [0.48, 0.48, 0.28], MAT.glass, 0.02);
  }
  if (stage >= 3) {
    const bob = Math.sin(f * TAU) * 0.05;
    const c: V3 = [0, 0, 2.9 + bob];
    m.add((x, y, z) => (Math.abs(x) + Math.abs(y) + Math.abs(z) * 0.5 - 0.42) * 0.57, MAT.crystal, c, [0.44, 0.44, 0.86]);
    m.torus(c, 0.7, 0.03, MAT.gold, { rot: [0.3, 0, f * TAU] });
    m.torus(c, 0.55, 0.02, MAT.star, { rot: [-0.4, 0.2, -f * TAU] });
    for (const [x, y] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) m.sphere([x, y, 2.36], 0.07, MAT.star);
  }
  return m;
}

export { gable };
