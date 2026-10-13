import type { ItemId } from '../../../core/content/items';
import { MAT, leafDisp, rockDisp } from '../mats';
import { hash3 } from '../noise';
import { type Mat, Model } from '../sdf';
import { gear, sack } from './parts';

/**
 * Item icons as small models (about ±0.22 tile units). Rendered large for
 * the interface and small for items riding conveyors.
 */

const ingot = (mat: Mat) => (m: Model) => {
  m.add((x, y, z) => {
    const t = (z + 0.05) / 0.1;
    const hx = 0.17 - t * 0.04, hy = 0.08 - t * 0.025;
    return Math.max(Math.abs(x) - hx, Math.abs(y) - hy, Math.abs(z) - 0.05) - 0.006;
  }, mat, [0, 0, 0.05], [0.18, 0.09, 0.06]);
};
const heap = (mat: Mat, seed: number, r = 0.17) => (m: Model) => {
  m.blob([[0, 0, 0.02, r], [r * 0.6, -r * 0.3, 0.01, r * 0.6], [-r * 0.5, r * 0.4, 0.01, r * 0.55]], r * 0.4, mat, { squash: 0.5, disp: rockDisp(0.02, 14), dispAmp: 0.02 });
  void seed;
};
const grit = (mat: Mat, seed: number) => (m: Model) => {
  for (let i = 0; i < 14; i++) {
    const a = hash3(i, seed, 1) * Math.PI * 2, r = Math.sqrt(hash3(i, seed, 2)) * 0.16;
    m.add((x, y, z) => (Math.abs(x) + Math.abs(y) + Math.abs(z) - 0.03) * 0.57, i % 3 ? mat : MAT.pebble, [Math.cos(a) * r, Math.sin(a) * r, 0.03 + (0.16 - r) * 0.2], [0.035, 0.035, 0.035], { rot: [i, i * 2, 0] });
  }
};
const gem = (mat: Mat, h = 0.36) => (m: Model) => {
  m.add((x, y, z) => (Math.abs(x) + Math.abs(y) + Math.abs(z) * (0.13 / (h / 2)) - 0.13) * 0.57, mat, [0, 0, h / 2], [0.14, 0.14, h / 2 + 0.01]);
};

const ICON: Record<ItemId, (m: Model) => void> = {
  wood: (m) => {
    m.cyl([0, 0, 0.09], 0.09, 0.2, MAT.logX, 'x');
    m.cyl([0.2, 0, 0.09], 0.086, 0.004, MAT.logEnd, 'x');
    m.cyl([-0.04, 0.0, 0.2], 0.012, 0.03, MAT.leaf, 'z');
  },
  leaf: (m) => m.blob([[0, 0, 0.08, 0.12], [0.1, -0.05, 0.06, 0.08], [-0.08, 0.07, 0.06, 0.08]], 0.05, MAT.leaf, { squash: 0.6, disp: leafDisp(0.03, 2), dispAmp: 0.03 }),
  sapling: (m) => {
    m.blob([[0, 0, 0.04, 0.13]], 0.01, MAT.soil, { squash: 0.45 });
    m.capsule([0, 0, 0.04], [0, 0, 0.2], 0.012, MAT.bark);
    m.blob([[0, 0, 0.25, 0.08], [0.06, -0.03, 0.21, 0.05]], 0.03, MAT.leaf, { disp: leafDisp(0.02, 3), dispAmp: 0.02 });
  },
  fiber: (m) => {
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * 0.025;
      m.capsule([x, 0, 0.0], [x + (i % 2 ? 0.04 : -0.03), 0.02, 0.26 + (i % 3) * 0.03], 0.008, i % 2 ? MAT.blade : MAT.bladeLight);
    }
    m.torus([0, 0, 0.06], 0.07, 0.012, MAT.rope);
  },
  twine: (m) => {
    m.cyl([0, 0, 0.1], 0.12, 0.1, MAT.rope);
    for (let k = 0; k < 6; k++) m.torus([0, 0, 0.02 + k * 0.034], 0.123, 0.012, MAT.rope);
    m.capsule([0.12, 0, 0.12], [0.2, 0.06, 0.02], 0.01, MAT.rope);
  },
  plank: (m) => {
    m.box([0, 0, 0.03], [0.2, 0.07, 0.016], MAT.oak, 0.006);
    m.box([0.02, 0.02, 0.064], [0.2, 0.07, 0.016], MAT.oak, 0.006);
  },
  loam: heap(MAT.soil, 1),
  pebble: (m) => { for (const [x, y, r] of [[-0.06, -0.04, 0.07], [0.08, 0.02, 0.06], [-0.02, 0.09, 0.05], [0.05, -0.09, 0.045]]) m.ellipsoid([x, y, r * 0.6], r, r * 0.85, r * 0.6, MAT.rockBare); },
  stone: (m) => m.box([0, 0, 0.1], [0.12, 0.12, 0.1], MAT.stone, 0.02, { disp: rockDisp(0.008, 20), dispAmp: 0.008 }),
  dew: (m) => {
    m.add((x, y, z) => {
      const zz = z - 0.11;
      const r = zz < 0 ? 0.1 : 0.1 * (1 - zz / 0.17);
      return Math.max(Math.hypot(x, y) - r, zz < 0 ? Math.hypot(x, y, zz) - 0.1 : -1e9) * (zz < 0 ? 1 : 0.8);
    }, MAT.waterDrop, [0, 0, 0], [0.11, 0.11, 0.3]);
  },
  clay: (m) => m.box([0, 0, 0.08], [0.13, 0.1, 0.07], MAT.clay, 0.04),
  charcoal: (m) => { for (const [x, y, z] of [[-0.05, 0, 0.05], [0.07, -0.02, 0.05], [0.0, 0.06, 0.13]]) m.box([x, y, z], [0.06, 0.05, 0.045], MAT.charcoal, 0.015, { rot: [0, 0, x * 5] }); },
  brick: (m) => m.box([0, 0, 0.06], [0.17, 0.085, 0.055], MAT.brickSolid, 0.012),
  copper_grit: grit(MAT.copper, 4),
  copper: ingot(MAT.copper),
  gear: (m) => gear(m, [0, 0, 0.04], 0.15, 0.03, 'z', 0.1, 10, MAT.copper),
  wire: (m) => {
    for (let i = 0; i < 5; i++) m.torus([0, 0, 0.03 + i * 0.03], 0.13, 0.011, MAT.copper);
    m.cyl([0, 0, 0.09], 0.08, 0.09, MAT.oak);
  },
  gravel: heap(MAT.pebble, 6),
  sand: heap(MAT.sand, 7),
  iron_grit: grit(MAT.ironOre, 8),
  iron: ingot(MAT.iron),
  glass: (m) => m.box([0, 0, 0.11], [0.12, 0.12, 0.11], MAT.glass, 0.025),
  plate: (m) => {
    m.box([0, 0, 0.02], [0.18, 0.18, 0.016], MAT.iron, 0.01);
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.sphere([x * 0.14, y * 0.14, 0.036], 0.012, MAT.brass);
  },
  mechanism: (m) => {
    m.box([0, 0, 0.08], [0.15, 0.13, 0.08], MAT.brass, 0.015);
    gear(m, [0, 0.135, 0.09], 0.07, 0.01, 'y', 0.3, 8, MAT.copper);
    gear(m, [0.15, 0, 0.1], 0.05, 0.01, 'x', 0.2, 7, MAT.iron);
  },
  lens: (m) => {
    m.torus([0, 0, 0.14], 0.13, 0.022, MAT.brass, { rot: [Math.PI / 2, 0, 0.6] });
    m.cyl([0, 0, 0.14], 0.12, 0.012, MAT.glass, 'z', 0.01, { rot: [Math.PI / 2, 0, 0.6] });
  },
  mist: (m) => m.blob([[0, 0, 0.1, 0.1], [0.08, -0.04, 0.14, 0.08], [-0.07, 0.05, 0.17, 0.07]], 0.05, MAT.mist),
  aether: (m) => { m.sphere([0, 0, 0.13], 0.12, MAT.aether); m.sphere([-0.04, 0.04, 0.18], 0.03, MAT.foam); },
  stardust: (m) => { heap(MAT.star, 3, 0.13)(m); for (const [x, y, z] of [[0.15, 0.1, 0.18], [-0.14, -0.06, 0.22], [0.02, -0.15, 0.25]]) m.sphere([x, y, z], 0.018, MAT.star); },
  crystal: gem(MAT.crystal),
  skystone: (m) => m.box([0, 0, 0.11], [0.12, 0.12, 0.11], MAT.skystone, 0.02),
  amber: (m) => m.ellipsoid([0, 0, 0.1], 0.12, 0.1, 0.09, MAT.amber),
  sunmetal: ingot(MAT.ingotHot),
  cell: (m) => {
    m.cyl([0, 0, 0.13], 0.08, 0.1, MAT.glass);
    m.cyl([0, 0, 0.13], 0.06, 0.08, MAT.aether);
    m.cyl([0, 0, 0.025], 0.09, 0.025, MAT.brass);
    m.cyl([0, 0, 0.245], 0.09, 0.025, MAT.brass);
  },
  coil: (m) => {
    for (let i = 0; i < 6; i++) m.torus([0, 0, 0.04 + i * 0.035], 0.1, 0.014, MAT.gold);
    m.cyl([0, 0, 0.14], 0.04, 0.12, MAT.lamp);
  },
  core: (m) => {
    m.sphere([0, 0, 0.14], 0.12, MAT.crystal);
    m.torus([0, 0, 0.14], 0.15, 0.012, MAT.gold, { rot: [0.5, 0, 0] });
    m.torus([0, 0, 0.14], 0.15, 0.012, MAT.gold, { rot: [-0.5, 0.8, 0] });
  },
};

export function icon(id: ItemId): Model {
  const m = new Model();
  ICON[id](m);
  return m;
}

export const ICON_IDS = Object.keys(ICON) as ItemId[];

/** Interface glyph models (navigation, actions) in the same painted pixel style. */
export const UI_ICONS: Record<string, (m: Model) => void> = {
  build: (m) => {
    m.capsule([-0.1, 0.1, 0.0], [0.08, -0.08, 0.2], 0.022, MAT.post);
    m.box([0.1, -0.1, 0.24], [0.11, 0.045, 0.045], MAT.iron, 0.012, { rot: [0, 0, -0.785] });
  },
  stash: (m) => {
    m.box([0, 0, 0.1], [0.17, 0.12, 0.09], MAT.crate, 0.015);
    m.cyl([0, 0, 0.19], 0.12, 0.17, MAT.crate, 'x', 0.01, { disp: (_x, _y, z) => (z < 0 ? 1 : 0), dispAmp: 0 });
    m.box([0, 0.125, 0.15], [0.03, 0.006, 0.035], MAT.gold, 0.004);
    for (const x of [-0.12, 0.12]) m.box([x, 0, 0.14], [0.012, 0.125, 0.14], MAT.ironDark, 0.003);
  },
  craft: (m) => {
    m.box([0, 0, 0.12], [0.18, 0.12, 0.02], MAT.deck, 0.008);
    for (const [x, y] of [[-0.14, -0.08], [0.14, -0.08], [-0.14, 0.08], [0.14, 0.08]]) m.box([x, y, 0.05], [0.015, 0.015, 0.05], MAT.post, 0.004);
    m.box([0.0, 0.0, 0.15], [0.12, 0.03, 0.004], MAT.blade3, 0.002, { rot: [0, 0, 0.4] });
  },
  journal: (m) => {
    m.box([0, 0, 0.04], [0.15, 0.19, 0.035], MAT.leather, 0.015);
    m.box([0.005, 0, 0.045], [0.135, 0.18, 0.03], MAT.paper, 0.005);
    m.box([0, 0, 0.078], [0.15, 0.19, 0.004], MAT.leather, 0.004);
    m.box([0.06, 0.0, 0.085], [0.02, 0.19, 0.004], MAT.gold, 0.002);
  },
  eye: (m) => {
    m.add((x, y, z) => (Math.abs(x) + Math.abs(y) + Math.abs(z) * 0.5 - 0.08) * 0.57, MAT.crystal, [0, 0, 0.14], [0.09, 0.09, 0.17]);
    m.torus([0, 0, 0.14], 0.15, 0.014, MAT.brass, { rot: [0.4, 0, 0] });
  },
  world: (m) => {
    m.cyl([0, 0, 0.04], 0.18, 0.04, MAT.grass);
    m.cone([0, 0, -0.08], 0.17, 0.03, 0.09, MAT.cliffRock);
  },
  research: (m) => {
    m.cyl([0, 0, 0.03], 0.16, 0.025, MAT.brass);
    m.torus([0, 0, 0.06], 0.16, 0.014, MAT.gold);
    m.box([0, 0, 0.065], [0.13, 0.018, 0.006], MAT.redCloth, 0.004, { rot: [0, 0, 0.7] });
    m.box([0, 0, 0.065], [0.13, 0.018, 0.006], MAT.iron, 0.004, { rot: [0, 0, 0.7 + Math.PI / 2] });
  },
  sack: (m) => sack(m, [0, 0, 0], 1.4),
  gear: (m) => { gear(m, [0, 0, 0.04], 0.15, 0.04, 'z', 0.2, 8, MAT.iron); m.cyl([0, 0, 0.05], 0.05, 0.045, MAT.ironDark); },
  compass: (m) => {
    m.cyl([0, 0, 0.03], 0.17, 0.03, MAT.brass);
    m.cyl([0, 0, 0.062], 0.14, 0.004, MAT.paper);
    m.add((x, y, z) => Math.max(Math.abs(x) * 0.25 + Math.abs(y) - 0.03, Math.abs(z) - 0.006), MAT.redCloth, [0, 0, 0.07], [0.13, 0.04, 0.01], { rot: [0, 0, 0.8] });
    m.torus([0, 0, 0.06], 0.17, 0.014, MAT.gold);
  },
  book: (m) => {
    m.box([0, 0, 0.05], [0.16, 0.2, 0.045], MAT.leather, 0.015, { rot: [0, 0, 0.3] });
    m.box([0.012, 0.004, 0.05], [0.145, 0.19, 0.038], MAT.paper, 0.004, { rot: [0, 0, 0.3] });
    m.box([0, 0, 0.098], [0.16, 0.2, 0.006], MAT.leather, 0.004, { rot: [0, 0, 0.3] });
    m.box([0, 0, 0.106], [0.06, 0.06, 0.004], MAT.gold, 0.002, { rot: [0, 0, 1.085] });
  },
  island: (m) => {
    m.cyl([0, 0, 0.02], 0.2, 0.025, MAT.grass, 'z', 0.02);
    m.cone([0, 0, -0.12], 0.19, 0.03, 0.12, MAT.cliffRock);
    m.cyl([0.04, -0.02, 0.1], 0.015, 0.06, MAT.bark);
    m.sphere([0.04, -0.02, 0.2], 0.07, MAT.leaf);
  },
};
