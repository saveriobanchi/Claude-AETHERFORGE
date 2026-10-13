import { MAT } from '../mats';
import { hash3 } from '../noise';
import { Model } from '../sdf';
import { barrel, beam, bush, chimney, crate, deckBase, gable, gear, lampPost, lantern, logPile, pipe, plankStack, plinth, post, sack, type V3 } from './parts';

/**
 * Early and mid-game crafting buildings. Each takes the animation phase
 * `f` in [0, 1) and returns a model on a 1×1 footprint.
 */

const TAU = Math.PI * 2;

/** Carpenter's workbench: heavy top, vise, tools, lumber, a lantern on a post. */
export function workbench(): Model {
  const m = new Model();
  plinth(m, 0.46, 0.04);
  for (const [x, y] of [[-0.32, -0.24], [0.32, -0.24], [-0.32, 0.26], [0.32, 0.26]]) post(m, x, y, 0.04, 0.44, 0.03);
  beam(m, [-0.32, -0.24, 0.14], [0.32, -0.24, 0.14]);
  beam(m, [-0.32, 0.26, 0.14], [0.32, 0.26, 0.14]);
  m.box([0, 0.01, 0.15], [0.3, 0.24, 0.01], MAT.deck, 0.004);
  plankStack(m, [-0.04, 0.0, 0.16], 3, 0.2);
  m.box([0, 0.01, 0.47], [0.4, 0.31, 0.034], MAT.deck, 0.01);
  // vise
  m.box([0.33, -0.2, 0.54], [0.05, 0.05, 0.036], MAT.iron, 0.008);
  m.cyl([0.33, -0.29, 0.54], 0.01, 0.07, MAT.ironDark, 'y');
  // saw, mallet, chisel, shavings
  m.box([-0.06, 0.12, 0.509], [0.18, 0.055, 0.004], MAT.blade3, 0.002, { rot: [0, 0, 0.25] });
  m.box([0.14, 0.17, 0.523], [0.05, 0.02, 0.016], MAT.oak, 0.006, { rot: [0, 0, 0.25] });
  m.cyl([-0.22, -0.13, 0.54], 0.034, 0.06, MAT.beamY, 'y');
  m.cyl([-0.11, -0.1, 0.52], 0.011, 0.1, MAT.post, 'x');
  for (let i = 0; i < 6; i++) m.torus([0.06 + i * 0.035, -0.1 + (i % 2) * 0.05, 0.51], 0.015, 0.004, MAT.shaving);
  crate(m, [-0.3, -0.36, 0.04], 0.07, 0.2);
  lampPost(m, 0.4, 0.38, 0.72);
  return m;
}

/** Composter: slatted wooden bin of rich soil and leaves, a pitchfork, steam rising. */
export function composter(f = 0): Model {
  const m = new Model();
  plinth(m, 0.44, 0.03);
  // slatted walls
  const hw = 0.34;
  for (const [x, y] of [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw]]) post(m, x, y, 0.03, 0.42, 0.03);
  for (let k = 0; k < 4; k++) {
    const z = 0.07 + k * 0.085;
    m.box([0, hw, z], [hw, 0.014, 0.034], MAT.crate, 0.008);
    m.box([hw, 0, z], [0.014, hw, 0.034], MAT.crate, 0.008);
    m.box([0, -hw, z], [hw, 0.014, 0.034], MAT.crate, 0.008);
    m.box([-hw, 0, z], [0.014, hw, 0.034], MAT.crate, 0.008);
  }
  // heaped compost
  m.blob([[0, 0, 0.3, 0.26], [0.1, -0.08, 0.34, 0.18], [-0.1, 0.1, 0.33, 0.17]], 0.08, MAT.compost, { squash: 0.55 });
  for (let i = 0; i < 9; i++) {
    const a = hash3(i, 3, 1) * TAU, r = hash3(i, 3, 2) * 0.2;
    m.ellipsoid([Math.cos(a) * r, Math.sin(a) * r, 0.42 + hash3(i, 3, 3) * 0.04], 0.03, 0.02, 0.006, i % 3 ? MAT.leaf : MAT.autumn, { rot: [0.3, 0.2, a] });
  }
  // pitchfork leaning on the bin
  m.capsule([0.44, 0.1, 0.02], [0.4, -0.05, 0.62], 0.01, MAT.post);
  for (const d of [-0.02, 0, 0.02]) m.capsule([0.44 + d, 0.11 + d * 0.3, 0.0], [0.44 + d, 0.1, 0.1], 0.004, MAT.iron);
  sack(m, [-0.36, 0.38, 0.03], 0.8);
  void f;
  return m;
}

/** Sieve: a shaking framed mesh over a trestle, pebbles piling underneath. */
export function sieve(f = 0): Model {
  const m = new Model();
  plinth(m, 0.44, 0.03);
  for (const [x, y] of [[-0.3, -0.26], [0.3, -0.26], [-0.3, 0.26], [0.3, 0.26]]) post(m, x, y, 0.03, 0.38, 0.025);
  beam(m, [-0.3, -0.26, 0.2], [-0.3, 0.26, 0.2]);
  beam(m, [0.3, -0.26, 0.2], [0.3, 0.26, 0.2]);
  const sh = Math.sin(f * TAU) * 0.025;
  // tray frame
  m.box([sh, 0, 0.4], [0.36, 0.32, 0.03], MAT.oak, 0.008);
  m.add((x, y, z) => {
    const inside = Math.max(Math.abs(x) - 0.33, Math.abs(y) - 0.29);
    return Math.max(-inside, Math.abs(z) - 0.035, Math.max(Math.abs(x) - 0.36, Math.abs(y) - 0.32));
  }, MAT.oak, [sh, 0, 0.4], [0.37, 0.33, 0.04]);
  m.box([sh, 0, 0.385], [0.33, 0.29, 0.003], MAT.mesh, 0.001);
  m.blob([[sh - 0.05, 0.02, 0.41, 0.13], [sh + 0.08, -0.05, 0.4, 0.1]], 0.05, MAT.soil, { squash: 0.45 });
  // falling grains and the pile below
  for (let i = 0; i < 6; i++) {
    const z = 0.36 - ((f * 0.3 + i * 0.05) % 0.3);
    m.sphere([(hash3(i, 1, 1) - 0.5) * 0.4 + sh, (hash3(i, 1, 2) - 0.5) * 0.36, z], 0.012, MAT.pebble);
  }
  m.blob([[0, 0, 0.04, 0.2], [0.1, 0.08, 0.04, 0.12]], 0.06, MAT.pebble, { squash: 0.4 });
  crate(m, [-0.32, 0.36, 0.03], 0.065, 0.3);
  return m;
}

/** Dew catcher: a fine net strung between two tall posts drips into a stone basin. */
export function dewCatcher(f = 0): Model {
  const m = new Model();
  plinth(m, 0.44, 0.03);
  post(m, -0.36, 0.28, 0.03, 1.15, 0.03);
  post(m, 0.28, -0.36, 0.03, 1.15, 0.03);
  beam(m, [-0.36, 0.28, 1.12], [0.28, -0.36, 1.12], 0.022);
  // net: a thin panel with a woven mesh material, gently bowed
  m.add((x, y, z) => {
    const u = (x - y) / Math.SQRT2, v = (x + y) / Math.SQRT2;
    const bow = 0.03 * Math.cos((u / 0.45) * Math.PI * 0.5);
    return Math.max(Math.abs(v - bow) - 0.006, Math.abs(u) - 0.42, Math.abs(z - 0.78) - 0.3);
  }, MAT.net, [0, 0, 0], [0.5, 0.5, 1.1]);
  m.cyl([0.0, 0.0, 0.12], 0.2, 0.09, MAT.stone);
  m.cyl([0.0, 0.0, 0.205], 0.17, 0.01, MAT.water);
  for (let i = 0; i < 3; i++) {
    const z = 0.95 - ((f + i / 3) % 1) * 0.7;
    m.sphere([-0.2 + i * 0.16, 0.12 - i * 0.16, z], 0.014, MAT.waterDrop);
  }
  barrel(m, [0.3, 0.3, 0.03], 0.07, 0.16, MAT.barrel);
  return m;
}

/** Clay tub: a stout barrel of wet clay churned by a paddle, sacks of loam beside. */
export function clayTub(f = 0): Model {
  const m = new Model();
  plinth(m, 0.44, 0.03);
  barrel(m, [0, 0, 0.03], 0.26, 0.34);
  m.cyl([0, 0, 0.36], 0.24, 0.012, MAT.clay);
  const a = f * TAU;
  const px = Math.cos(a) * 0.1, py = Math.sin(a) * 0.1;
  m.capsule([px, py, 0.3], [px * 0.6, py * 0.6, 0.78], 0.016, MAT.post);
  m.box([px, py, 0.33], [0.05, 0.012, 0.06], MAT.oak, 0.005, { rot: [0, 0, a] });
  sack(m, [0.34, 0.3, 0.03]);
  sack(m, [-0.34, 0.34, 0.03], 0.85, MAT.burlapDark);
  m.box([0.34, -0.3, 0.07], [0.07, 0.06, 0.04], MAT.clay, 0.02);
  return m;
}

/** Kiln: a brick beehive with a glowing mouth, a chimney and a stack of firewood. */
export function kiln(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05);
  m.add((x, y, z) => {
    const d = Math.sqrt(x * x + y * y + (z * 0.9) ** 2) - 0.36;
    return Math.max(d, -z);
  }, MAT.brick, [0, 0, 0.05], [0.37, 0.37, 0.42]);
  // arched mouth facing +y
  m.add((x, y, z) => Math.max(Math.abs(x) - 0.09, z - 0.18 - Math.sqrt(Math.max(0, 0.0081 - x * x)), -z, Math.abs(y - 0.33) - 0.06), MAT.fire, [0, 0, 0.05], [0.1, 0.4, 0.3]);
  m.box([0, 0.36, 0.06], [0.13, 0.04, 0.012], MAT.stoneDark, 0.005);
  chimney(m, [0.12, -0.14, 0.3], 0.38, 0.055);
  logPile(m, [-0.32, 0.18, 0.05], 5, 0.12, 'y');
  void f;
  return m;
}

/** Treewright's lodge: timber hut, a crane arm with a log claw, a basket of logs. */
export function harvester(f = 0): Model {
  const m = new Model();
  deckBase(m, 0.46);
  // cabin
  m.box([-0.12, 0.1, 0.25], [0.22, 0.24, 0.18], MAT.logWall, 0.02);
  m.box([-0.12, 0.345, 0.2], [0.06, 0.01, 0.11], MAT.darkWood, 0.006);
  m.box([0.105, 0.12, 0.27], [0.008, 0.06, 0.05], MAT.window, 0.004);
  gable(m, [-0.12, 0.1, 0.43], 0.27, 0.3, 0.22, 'y', MAT.roofGreen);
  chimney(m, [-0.22, -0.02, 0.5], 0.22, 0.04);
  // crane
  post(m, 0.3, -0.3, 0.07, 0.9, 0.035);
  const a = -0.6 + Math.sin(f * TAU) * 0.5;
  const ex = 0.3 + Math.cos(a) * 0.5, ey = -0.3 + Math.sin(a) * 0.5;
  beam(m, [0.3, -0.3, 0.88], [ex, ey, 0.8], 0.02);
  gear(m, [0.3, -0.36, 0.78], 0.06, 0.012, 'y', f * TAU, 8);
  m.capsule([ex, ey, 0.8], [ex, ey, 0.6], 0.004, MAT.rope);
  m.cyl([ex, ey, 0.56], 0.04, 0.04, MAT.logX, 'x');
  // log basket
  m.box([0.26, 0.28, 0.12], [0.16, 0.12, 0.05], MAT.crate, 0.01);
  logPile(m, [0.26, 0.28, 0.13], 4, 0.15, 'x');
  lantern(m, [0.12, 0.38, 0.4], 0.9);
  return m;
}

/** Wind sifter: a tall hopper box with little sails that turn in the breeze. */
export function windSifter(f = 0): Model {
  const m = new Model();
  plinth(m, 0.44, 0.04);
  m.box([0, 0, 0.3], [0.3, 0.3, 0.26], MAT.oak, 0.015);
  for (const z of [0.12, 0.48]) m.box([0, 0, z], [0.31, 0.31, 0.012], MAT.ironDark, 0.004);
  m.cone([0, 0, 0.66], 0.22, 0.32, 0.1, MAT.crate);
  m.blob([[0, 0, 0.72, 0.18]], 0.01, MAT.soil, { squash: 0.4 });
  // chute with pebbles
  m.box([0.34, 0.08, 0.16], [0.06, 0.08, 0.02], MAT.oak, 0.006, { rot: [0, 0.4, 0] });
  m.blob([[0.38, 0.1, 0.05, 0.08]], 0.02, MAT.pebble, { squash: 0.5 });
  // mast and sails facing +y
  post(m, 0, 0, 0.56, 1.08, 0.025);
  const hub: V3 = [0, 0.1, 0.98];
  m.cyl([0, 0.05, 0.98], 0.016, 0.05, MAT.beamY, 'y');
  for (let s = 0; s < 4; s++) {
    const a = f * (Math.PI / 2) + (s * Math.PI) / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    m.capsule(hub, [ca * 0.34, 0.1, 0.98 + sa * 0.34], 0.01, MAT.post);
    m.box([ca * 0.2 - sa * 0.05, 0.105, 0.98 + sa * 0.2 + ca * 0.05], [0.13, 0.004, 0.045], MAT.sail, 0.003, { rot: [0, -a, 0] });
  }
  m.sphere(hub, 0.025, MAT.ironDark);
  return m;
}

/** Sawmill: open timber shed with a shingle roof, spinning blade, log on the bench, planks out front. */
export function sawmill(f = 0): Model {
  const m = new Model();
  deckBase(m, 0.46);
  for (const [x, y] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) post(m, x, y, 0.07, 0.78, 0.035);
  beam(m, [-0.4, -0.38, 0.77], [0.4, -0.38, 0.77]);
  beam(m, [-0.4, 0.38, 0.77], [0.4, 0.38, 0.77]);
  for (const sx of [-1, 1]) for (const y of [-0.38, 0.38]) m.capsule([sx * 0.38, y, 0.6], [sx * 0.2, y, 0.76], 0.014, MAT.post);
  gable(m, [0, 0, 0.8], 0.5, 0.52, 0.3, 'x', MAT.roof);
  // bench, carriage and log
  m.box([0, 0.02, 0.2], [0.3, 0.13, 0.12], MAT.oak, 0.01);
  m.cyl([-0.06, 0.02, 0.4], 0.08, 0.26, MAT.logX, 'x');
  m.cyl([0.2, 0.02, 0.4], 0.077, 0.004, MAT.logEnd, 'x');
  // blade in the x–z plane, teeth turning
  const rot = f * TAU;
  m.add((x, y, z) => {
    const r = Math.hypot(x, z), a = Math.atan2(z, x) + rot;
    const teeth = 0.15 + 0.014 * Math.abs(((a / TAU) * 24) % 1 - 0.5);
    return Math.max(r - teeth, Math.abs(y) - 0.006);
  }, MAT.blade3, [0.16, 0.14, 0.42], [0.18, 0.02, 0.18]);
  m.cyl([0.16, 0.155, 0.42], 0.03, 0.012, MAT.brass, 'y');
  gear(m, [0.32, 0.16, 0.22], 0.07, 0.012, 'y', -rot, 9, MAT.iron);
  plankStack(m, [-0.18, -0.27, 0.07], 4, 0.2);
  m.blob([[0.32, 0.33, 0.08, 0.08], [0.25, 0.36, 0.07, 0.05]], 0.03, MAT.shaving, { squash: 0.5 });
  lantern(m, [-0.36, 0.33, 0.6], 0.9);
  return m;
}

/** Stone press: an iron frame with a heavy piston crushing pebbles into stone blocks. */
export function press(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05);
  m.box([0, 0, 0.12], [0.3, 0.3, 0.07], MAT.stoneDark, 0.015);
  post(m, -0.3, 0, 0.05, 1.0, 0.04, MAT.iron);
  post(m, 0.3, 0, 0.05, 1.0, 0.04, MAT.iron);
  m.box([0, 0, 1.0], [0.36, 0.08, 0.05], MAT.iron, 0.012);
  const z = 0.25 + (0.5 + 0.5 * Math.cos(f * TAU)) * 0.3;
  m.cyl([0, 0, (z + 0.95) / 2 + 0.06], 0.035, (0.95 - z) / 2, MAT.brass);
  m.box([0, 0, z + 0.04], [0.2, 0.2, 0.05], MAT.ironDark, 0.012);
  m.box([0, 0, 0.21], [0.16, 0.16, 0.02], MAT.stone, 0.006);
  gear(m, [0.36, 0.0, 0.8], 0.11, 0.015, 'x', f * TAU, 10);
  for (let i = 0; i < 3; i++) m.box([-0.28 + i * 0.1, 0.36, 0.09], [0.04, 0.04, 0.04], MAT.stone, 0.01);
  return m;
}

/** Millstone: two great stones turned by a long beam, gravel heaped beside. */
export function millstone(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.04);
  m.cyl([0, 0, 0.12], 0.36, 0.08, MAT.stone);
  const rot = f * TAU;
  m.add((x, y, z) => {
    const a = Math.atan2(y, x) + rot;
    const groove = Math.cos(a * 8) > 0.85 ? 0.008 : 0;
    return Math.max(Math.hypot(x, y) - 0.3, Math.abs(z) - 0.06) + groove;
  }, MAT.millstone, [0, 0, 0.26], [0.3, 0.3, 0.06]);
  post(m, 0, 0, 0.3, 0.62, 0.035);
  const bx = Math.cos(rot) * 0.5, by = Math.sin(rot) * 0.5;
  beam(m, [-bx, -by, 0.55], [bx, by, 0.55], 0.025);
  m.blob([[0.36, 0.32, 0.04, 0.12], [0.26, 0.38, 0.04, 0.08]], 0.04, MAT.pebble, { squash: 0.55 });
  sack(m, [-0.36, 0.34, 0.04]);
  return m;
}

/** Furnace: a squat brick forge with a roaring mouth, a tall chimney, bellows and copper pipe. */
export function furnace(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05);
  m.box([0, 0, 0.32], [0.34, 0.34, 0.27], MAT.brick, 0.02);
  m.box([0, 0, 0.62], [0.28, 0.28, 0.04], MAT.stoneDark, 0.012);
  chimney(m, [-0.1, -0.12, 0.66], 0.55, 0.08);
  // mouth facing +y
  m.add((x, y, z) => Math.max(Math.abs(x) - 0.13, Math.abs(z - 0.24) - 0.12 - Math.sqrt(Math.max(0, 0.017 - x * x)) * 0.4, Math.abs(y - 0.33) - 0.03), MAT.fire, [0, 0, 0], [0.15, 0.4, 0.45]);
  m.box([0, 0.36, 0.38], [0.17, 0.03, 0.02], MAT.ironDark, 0.005);
  // bellows on the +x side
  const sq = 0.5 + 0.5 * Math.sin(f * TAU);
  m.box([0.42, 0.0, 0.2], [0.05, 0.13 - sq * 0.03, 0.08], MAT.leather, 0.03);
  m.capsule([0.47, 0.0, 0.2], [0.55, 0.0, 0.32], 0.012, MAT.post);
  pipe(m, [[0.3, 0.2, 0.5], [0.42, 0.2, 0.5], [0.42, 0.2, 0.08]], 0.02);
  logPile(m, [-0.3, 0.38, 0.05], 3, 0.1, 'x');
  return m;
}

/** Assembler: an iron cabinet with a window onto turning gears and a jointed arm at work. */
export function assembler(f = 0): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05, MAT.stoneDark);
  m.box([0, 0, 0.3], [0.34, 0.32, 0.25], MAT.iron, 0.025);
  for (const z of [0.1, 0.5]) m.box([0, 0, z], [0.35, 0.33, 0.012], MAT.brass, 0.004);
  // window on +y with gears behind
  m.box([0, 0.32, 0.3], [0.22, 0.008, 0.13], MAT.glassDark, 0.006);
  gear(m, [-0.08, 0.29, 0.3], 0.09, 0.012, 'y', f * TAU, 10);
  gear(m, [0.1, 0.29, 0.27], 0.06, 0.012, 'y', -f * TAU * 1.5, 8, MAT.copper);
  m.box([0, 0, 0.56], [0.26, 0.24, 0.01], MAT.copper, 0.004);
  // arm
  const t = 0.5 - 0.5 * Math.cos(f * TAU);
  post(m, 0.24, -0.22, 0.56, 0.8, 0.025, MAT.ironDark);
  const elbow: V3 = [0.12 - t * 0.1, -0.04, 0.82];
  m.capsule([0.24, -0.22, 0.8], elbow, 0.018, MAT.brass);
  m.capsule(elbow, [elbow[0] - 0.06, elbow[1] + 0.08, 0.64], 0.014, MAT.brass);
  m.box([elbow[0] - 0.06, elbow[1] + 0.08, 0.62], [0.025, 0.025, 0.02], MAT.ironDark, 0.006);
  gear(m, [-0.06, 0.06, 0.59], 0.05, 0.01, 'z', 0, 8, MAT.gold);
  m.sphere([0.3, 0.3, 0.52], 0.022, MAT.aether);
  return m;
}

export { bush };
