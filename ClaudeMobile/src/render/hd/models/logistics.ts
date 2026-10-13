import { MAT, mat } from '../mats';
import { hash3, lin, smoothstep } from '../noise';
import { Model, type Mat } from '../sdf';
import { barrel, chimney, crate, gable, gear, lantern, plinth, sack, type V3 } from './parts';

const TAU = Math.PI * 2;

/** Moving rubber belt surface: ridges travel along local x with the animation phase. */
function beltSurface(express: boolean): Mat {
  const base = lin(express ? 0x2a3a52 : 0x3a3034), ridge = lin(express ? 0x6ad0f4 : 0x6a5a52);
  return mat((h, out) => {
    const u = h.lx * 10 - h.t;
    const fu = u - Math.floor(u);
    const k = smoothstep(0.0, 0.12, fu) * smoothstep(0.32, 0.2, fu);
    const v = Math.abs(h.ly) / 0.2;
    const edge = v > 0.85 ? 0.7 : 1;
    out[0] = (base[0] + (ridge[0] - base[0]) * k) * edge;
    out[1] = (base[1] + (ridge[1] - base[1]) * k) * edge;
    out[2] = (base[2] + (ridge[2] - base[2]) * k) * edge;
  }, express ? { emit: (h, out) => { const u = h.lx * 10 - h.t, fu = u - Math.floor(u); const k = fu < 0.25 ? 0.5 : 0; out[0] = 0.1 * k; out[1] = 0.5 * k; out[2] = 0.8 * k; } } : {});
}
const BELT = beltSurface(false), EXPRESS = beltSurface(true);

/** Conveyor tile. dir 0:+x 1:+y 2:−x 3:−y. Low, sits in the floor layer. */
export function belt(dir: number, express: boolean): Model {
  const m = new Model();
  const a = (dir * Math.PI) / 2;
  const rot: V3 = [0, 0, a];
  const rail = express ? MAT.brass : MAT.beamX;
  m.box([0, 0, 0.045], [0.5, 0.2, 0.012], express ? EXPRESS : BELT, 0.006, { rot });
  for (const side of [-1, 1]) {
    const ox = -Math.sin(a) * side * 0.25, oy = Math.cos(a) * side * 0.25;
    m.box([ox, oy, 0.04], [0.5, 0.035, 0.035], rail, 0.01, { rot });
    for (const t of [-0.32, 0, 0.32]) {
      const px = ox + Math.cos(a) * t, py = oy + Math.sin(a) * t;
      m.cyl([px, py, 0.08], 0.014, 0.006, MAT.ironDark);
    }
  }
  // roller under each end
  for (const t of [-0.45, 0.45]) m.cyl([Math.cos(a) * t, Math.sin(a) * t, 0.035], 0.03, 0.2, MAT.iron, dir % 2 === 0 ? 'y' : 'x');
  return m;
}

/** Depot: a sturdy iron-banded chest with a copper funnel on top and a lantern. */
export function depot(f = 0): Model {
  const m = new Model();
  plinth(m, 0.44, 0.04);
  m.box([0, 0, 0.27], [0.32, 0.28, 0.22], MAT.crate, 0.02);
  for (const z of [0.12, 0.42]) m.box([0, 0, z], [0.33, 0.29, 0.014], MAT.ironDark, 0.004);
  m.add((x, y, z) => {
    const r = 0.1 + (z + 0.08) * 0.9;
    return Math.max(Math.max(Math.abs(x), Math.abs(y)) - r, Math.abs(z) - 0.08, -(Math.max(Math.abs(x), Math.abs(y)) - r + 0.03) );
  }, MAT.copper, [0, 0, 0.57], [0.26, 0.26, 0.09]);
  if (f > 0.5) m.box([0, 0, 0.52], [0.05, 0.05, 0.03], MAT.gold, 0.01);
  m.box([0, 0.29, 0.28], [0.07, 0.01, 0.05], MAT.brass, 0.004);
  lantern(m, [0.36, 0.3, 0.12], 0.9);
  return m;
}

/** Dispatcher: a copper drum on a stone base that launches items out of a brass chute (+x). */
export function dispatcher(f = 0): Model {
  const m = new Model();
  plinth(m, 0.44, 0.04);
  m.box([0, 0, 0.16], [0.28, 0.28, 0.12], MAT.stone, 0.015);
  m.cyl([0, 0, 0.42], 0.2, 0.14, MAT.copper);
  m.torus([0, 0, 0.56], 0.2, 0.016, MAT.brass);
  m.cyl([0, 0, 0.555], 0.16, 0.01, MAT.ink);
  m.box([0.32, 0, 0.3], [0.12, 0.08, 0.05], MAT.brass, 0.012, { rot: [0, 0.35, 0] });
  gear(m, [0, 0.22, 0.42], 0.08, 0.01, 'y', f * TAU, 8, MAT.gold);
  return m;
}

/** Splitter (wood) and sorter (iron with a glass dome): low boxes with brass output arrows. */
export function splitter(sorter: boolean, f = 0): Model {
  const m = new Model();
  m.box([0, 0, 0.11], [0.36, 0.36, 0.1], sorter ? MAT.iron : MAT.crate, 0.02);
  m.box([0, 0, 0.215], [0.33, 0.33, 0.006], sorter ? MAT.ironDark : MAT.deck, 0.003);
  const arrow = (dx: number, dy: number, on: boolean) => {
    const a = Math.atan2(dy, dx);
    m.add((x, y, z) => {
      const u = x * Math.cos(a) + y * Math.sin(a), v = -x * Math.sin(a) + y * Math.cos(a);
      return Math.max(Math.abs(v) - (0.06 - u * 0.6), -0.02 - u, u - 0.08, Math.abs(z) - 0.008);
    }, on ? MAT.lamp : MAT.brass, [dx * 0.24, dy * 0.24, 0.225], [0.09, 0.09, 0.01]);
  };
  arrow(1, 0, sorter || f < 0.34);
  arrow(0, 1, f >= 0.34 && f < 0.67);
  arrow(0, -1, !sorter && f >= 0.67);
  if (sorter) m.sphere([0, 0, 0.25], 0.12, MAT.glass);
  else gear(m, [0, 0, 0.24], 0.1, 0.012, 'z', f * TAU, 9, MAT.gold);
  return m;
}

/** Crate store: stacked crates, sacks and a barrel; more appear as the stash fills. */
export function crates(fill: number): Model {
  const m = new Model();
  plinth(m, 0.46, 0.03);
  crate(m, [-0.16, -0.14, 0.03], 0.16, 0.1);
  crate(m, [0.2, -0.16, 0.03], 0.12, -0.15);
  barrel(m, [0.24, 0.24, 0.03], 0.1, 0.24);
  if (fill >= 1) { crate(m, [-0.16, -0.14, 0.35], 0.12, 0.35); sack(m, [-0.24, 0.26, 0.03]); }
  if (fill >= 2) { crate(m, [0.2, -0.16, 0.27], 0.1, 0.2); sack(m, [-0.06, 0.32, 0.03], 0.9, MAT.burlapDark); crate(m, [-0.12, -0.1, 0.59], 0.08, 0.6); }
  return m;
}

/** Silo: a round stone silo with iron hoops, a copper cone roof and a gauge strip showing fullness. */
export function silo(fill: number): Model {
  const m = new Model();
  plinth(m, 0.46, 0.05);
  m.cyl([0, 0, 0.72], 0.34, 0.67, MAT.towerStone);
  for (const z of [0.35, 0.75, 1.15]) m.torus([0, 0, z], 0.345, 0.014, MAT.ironDark);
  m.cone([0, 0, 1.58], 0.4, 0.03, 0.2, MAT.roofBlue);
  // gauge strip on the +y face
  const lvl = [0.15, 0.55, 0.95][fill];
  m.box([0.0, 0.335, 0.72], [0.035, 0.012, 0.55], MAT.glassDark, 0.006);
  m.box([0.0, 0.34, 0.17 + lvl * 0.55], [0.03, 0.012, lvl * 0.55], MAT.grain, 0.004);
  m.box([0.0, 0.32, 0.3], [0.08, 0.04, 0.12], MAT.darkWood, 0.02);
  return m;
}

/** Skystone warehouse: pale stone hall with an arched aether-lit door and a slate roof. */
export function warehouse(f = 0): Model {
  const m = new Model();
  plinth(m, 0.48, 0.05);
  m.box([0, 0, 0.35], [0.42, 0.4, 0.3], MAT.skystone, 0.02);
  gable(m, [0, 0, 0.65], 0.48, 0.46, 0.3, 'x', MAT.roofSlate);
  m.add((x, y, z) => Math.max(Math.abs(x) - 0.12, z - 0.22 - Math.sqrt(Math.max(0, 0.0144 - x * x)), -z, Math.abs(y - 0.4) - 0.02), MAT.aether, [0, 0, 0.05], [0.13, 0.42, 0.36]);
  for (let i = 0; i < 5; i++) m.box([0.425, -0.3 + i * 0.15, 0.2 + hash3(i, 2, 2) * 0.3], [0.006, 0.01, 0.04], MAT.aether, 0.003);
  chimney(m, [-0.2, -0.2, 0.7], 0.25, 0.05);
  lantern(m, [0.2, 0.44, 0.48], 0.9);
  lantern(m, [-0.2, 0.44, 0.48], 0.9);
  void f;
  return m;
}
