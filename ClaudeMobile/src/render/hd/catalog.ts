import * as A from './models/aether';
import * as C from './models/craft';
import * as L from './models/logistics';
import * as N from './models/nature';
import { ICON_IDS, UI_ICONS, icon } from './models/items';
import { type Floor, columnPiece, decor, topPiece } from './models/terrain';
import { MAT } from './mats';
import { type Image, Renderer, type RenderOpts } from './render';
import { Model } from './sdf';

/**
 * Everything the game draws, as bake jobs. Each job renders one or more
 * images; `bake-art` runs them in parallel and packs the results.
 */

/** World art resolution: texture pixels per world pixel. */
export const ART_R = 2;

const SPRITE_OPTS: RenderOpts = { pixel: true, R: ART_R, aa: 1, glow: 0, shadowAlpha: 0.26 };
const FLAT_OPTS: RenderOpts = { pixel: true, R: ART_R, aa: 1, glow: 0, shadow: false };

type Light = [number, number, number, number, number]; // x, y, z (tile units), colour, radius (px)

export interface SpriteSpec {
  frames: number;
  fps: number;
  make: (f: number, variant: string) => Model;
  variants?: Record<string, number>;
  /** Variant used for the default frames. */
  main?: string;
  lights?: Light[];
  smoke?: [number, number, number];
  lamp?: boolean;
}

const sway = (f: number) => Math.sin(f * Math.PI * 2);

export const SPRITES: Record<string, SpriteSpec> = {
  tree: {
    frames: 2, fps: 1.2, main: 's5',
    variants: { s0: 2, s3: 2, s5: 2 },
    make: (f, v) => N.tree(1, sway(f), 1, v === 's5' ? 10 : v === 's3' ? 4 : 0),
  },
  elder_tree: { frames: 2, fps: 1.2, make: (f) => N.elderTree(sway(f)), lights: [[-0.66, 0.27, 1.55, 0xffc060, 18], [0.66, -0.41, 1.65, 0xffc060, 18], [0.14, 0.69, 1.75, 0xffc060, 16]] },
  sapling: { frames: 2, fps: 1.2, main: 'g0', variants: { g0: 2, g1: 2, g2: 2 }, make: (f, v) => N.sapling(Number(v.slice(1)), sway(f)) },
  tuft: { frames: 2, fps: 1.5, make: (f) => N.tuft(sway(f)) },
  node_vein: { frames: 1, fps: 1, make: () => N.node('node_vein'), lights: [[0, 0, 0.3, 0xffa050, 20]] },
  node_spring: { frames: 4, fps: 5, make: (f) => N.node('node_spring', f), lights: [[0, 0, 0.1, 0x8adcff, 22]] },
  node_shard: { frames: 2, fps: 2, make: (f) => N.node('node_shard', f), lights: [[0, 0, 0.3, 0xffe08a, 22]] },
  workbench: { frames: 1, fps: 1, make: () => C.workbench(), lights: [[0.4, 0.47, 0.62, 0xffc060, 16]] },
  composter: { frames: 1, fps: 1, make: (f) => C.composter(f), smoke: [0, 0, 0.5] },
  sieve: { frames: 4, fps: 10, make: (f) => C.sieve(f), lamp: true },
  dew_catcher: { frames: 4, fps: 4, make: (f) => C.dewCatcher(f), lights: [[0, 0, 0.2, 0x8adcff, 12]] },
  clay_tub: { frames: 4, fps: 5, make: (f) => C.clayTub(f), lamp: true },
  kiln: { frames: 1, fps: 1, make: (f) => C.kiln(f), lamp: true, lights: [[0, 0.38, 0.15, 0xff8a3a, 26]], smoke: [0.12, -0.14, 0.72] },
  harvester: { frames: 6, fps: 6, make: (f) => C.harvester(f), lamp: true, lights: [[0.12, 0.38, 0.4, 0xffc060, 14]], smoke: [-0.22, -0.02, 0.76] },
  wind_sifter: { frames: 6, fps: 10, make: (f) => C.windSifter(f), lamp: true },
  sawmill: { frames: 4, fps: 12, make: (f) => C.sawmill(f), lamp: true, lights: [[-0.36, 0.33, 0.6, 0xffc060, 14]] },
  press: { frames: 6, fps: 7, make: (f) => C.press(f), lamp: true },
  millstone: { frames: 6, fps: 6, make: (f) => C.millstone(f), lamp: true },
  furnace: { frames: 4, fps: 6, make: (f) => C.furnace(f), lamp: true, lights: [[0, 0.38, 0.25, 0xff7a2a, 30]], smoke: [-0.1, -0.12, 1.24] },
  assembler: { frames: 6, fps: 8, make: (f) => C.assembler(f), lamp: true, lights: [[0, 0.34, 0.3, 0x8adcff, 12]] },
  condenser: { frames: 6, fps: 7, make: (f) => A.condenser(f), lamp: true, lights: [[0, 0, 0.6, 0x8fd0ff, 20]] },
  distiller: { frames: 4, fps: 5, make: (f) => A.distiller(f), lamp: true, lights: [[0.18, 0.2, 0.36, 0x8fd0ff, 16]] },
  star_net: { frames: 4, fps: 4, make: (f) => A.starNet(f), lamp: true, lights: [[0.04, 0.08, 0.2, 0xffe08a, 14]] },
  resonator: { frames: 8, fps: 8, make: (f) => A.resonator(f), lamp: true, lights: [[0, 0, 0.72, 0x6cb8f2, 30]] },
  crucible: { frames: 4, fps: 6, make: (f) => A.crucible(f), lamp: true, lights: [[0, 0, 0.62, 0xffc04a, 30]], smoke: [-0.24, -0.24, 0.72] },
  drill: { frames: 4, fps: 12, make: (f) => A.drill(f), lamp: true, lights: [[0, 0, 1.55, 0x6cb8f2, 16]] },
  depot: { frames: 2, fps: 1, make: (f) => L.depot(f), lights: [[0.36, 0.3, 0.12, 0xffc060, 14]] },
  dispatcher: { frames: 4, fps: 8, make: (f) => L.dispatcher(f), lamp: true },
  splitter: { frames: 3, fps: 6, make: (f) => L.splitter(false, f) },
  sorter: { frames: 3, fps: 6, make: (f) => L.splitter(true, f) },
  crate: { frames: 1, fps: 1, main: 'f1', variants: { f0: 1, f1: 1, f2: 1 }, make: (_f, v) => L.crates(Number(v.slice(1))) },
  silo: { frames: 1, fps: 1, main: 'f1', variants: { f0: 1, f1: 1, f2: 1 }, make: (_f, v) => L.silo(Number(v.slice(1))) },
  warehouse: { frames: 1, fps: 1, make: (f) => L.warehouse(f), lights: [[0, 0.42, 0.2, 0x6cb8f2, 20]] },
  windmill: { frames: 8, fps: 10, make: (f) => A.windmill(f), lights: [[0.25, 0.14, 0.78, 0xffc060, 12]] },
  engine: { frames: 6, fps: 12, make: (f) => A.engine(f), lamp: true, lights: [[0, 0.27, 0.45, 0x6cb8f2, 26]], smoke: [0.18, -0.12, 0.98] },
  pylon: { frames: 6, fps: 6, make: (f) => A.pylon(f), lights: [[0, 0, 1.42, 0x6cb8f2, 34]] },
  beacon: { frames: 6, fps: 6, make: (f) => A.beacon(f), lights: [[0, 0, 1.4, 0x6cb8f2, 32]] },
  roost: { frames: 4, fps: 4, make: (f) => A.roost(f), lamp: true, lights: [[0, 0, 1.22, 0x6cb8f2, 30]] },
  forge: { frames: 1, fps: 8, main: 'st0', variants: { st0: 1, st1: 1, st2: 1, st3: 8 }, make: (f, v) => A.forge(Number(v.slice(2)), f), lights: [[0, 0, 2.9, 0x6cb8f2, 70]] },
};

export type Rect = [number, number, number, number, number, number, number]; // sheet, x, y, w, h, ax, ay

/** Render a set of models sharing one canvas box, then crop the union of their opaque pixels. */
function renderSet(models: Model[], opts: RenderOpts): Image[] {
  let box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const m of models) {
    const b = new Renderer(m, opts).bounds1x();
    box = [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])];
  }
  const imgs = models.map((m, i) => new Renderer(m, { ...opts, box, t: m.t ?? i / models.length }).render());
  return cropSet(imgs);
}

/** Crop a set of equally sized images to the union of their opaque pixels (anchors adjusted). */
export function cropSet(imgs: Image[]): Image[] {
  const { w, h } = imgs[0];
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (const im of imgs) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (im.data[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return imgs.map((im) => ({ ...im, w: 1, h: 1, data: new Uint8ClampedArray(4) }));
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  return imgs.map((im) => {
    const d = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y++) d.set(im.data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4), y * nw * 4);
    return { w: nw, h: nh, data: d, ax: im.ax - x0, ay: im.ay - y0 };
  });
}

/** Wrap a model so materials see the animation phase. */
function phased(m: Model, t: number): Model { m.t = t; return m; }

export type JobOut = [string, Image][];
export const JOBS: Record<string, () => JobOut> = {};

for (const [type, sp] of Object.entries(SPRITES)) {
  JOBS['sprite:' + type] = () => {
    const sets = sp.variants ?? { _: sp.frames };
    const keys: string[] = [], models: Model[] = [];
    for (const [v, n] of Object.entries(sets)) for (let i = 0; i < n; i++) { keys.push(`${type}:${v}:${i}`); models.push(phased(sp.make(i / n, v), i / n)); }
    const imgs = renderSet(models, SPRITE_OPTS);
    return keys.map((k, i) => [k, imgs[i]]);
  };
}

for (const express of [false, true]) for (let dir = 0; dir < 4; dir++) {
  JOBS[`belt:${express ? 'x' : 'p'}:${dir}`] = () => {
    const models = [0, 1, 2, 3].map((i) => phased(L.belt(dir, express), (i / 4) * (dir < 2 ? 1 : -1)));
    const imgs = renderSet(models, { ...FLAT_OPTS, outline: 0.6 });
    return imgs.map((im, i) => [`belt:${express ? 'x' : 'p'}:${dir}:${i}`, im]);
  };
}

JOBS['icons'] = () => {
  const out: JobOut = [];
  for (const id of ICON_IDS) {
    out.push([`icon:${id}`, cropSet([new Renderer(icon(id), { pixel: true, R: 1.6, aa: 1, glow: 0, shadow: false }).render()])[0]]);
    out.push([`iconw:${id}`, cropSet([new Renderer(icon(id), { pixel: true, R: 1, aa: 1, glow: 0, shadow: false, outline: 1 }).render()])[0]]);
  }
  for (const [name, f] of Object.entries(UI_ICONS)) {
    const m = new Model(); f(m);
    out.push([`ui:${name}`, cropSet([new Renderer(m, { pixel: true, R: 1.8, aa: 1, glow: 0, shadow: false }).render()])[0]]);
  }
  return out;
};

export const DEPTHS = [1, 1.8, 2.6, 3.4, 4.2, 5, 5.8];
export const COL_VARIANTS = 3;
for (const d of DEPTHS) JOBS[`col:${d}`] = () => {
  const out: JobOut = [];
  for (let v = 0; v < COL_VARIANTS; v++) out.push([`col:${d}:${v}`, cropSet([new Renderer(columnPiece(d, v), FLAT_OPTS).render()])[0]]);
  return out;
};
const FLOORS: Floor[] = ['grass', 'stone', 'sky'];
for (const fl of FLOORS) JOBS[`top:${fl}`] = () => {
  const out: JobOut = [];
  for (let mask = 0; mask < 16; mask++) {
    const t = topPiece(fl, mask, mask % 2);
    out.push([`top:${fl}:${mask}`, cropSet([new Renderer(t.m, { ...FLAT_OPTS, clip: t.clip, outline: 0 }).render()])[0]]);
  }
  return out;
};
export const DECOR_KINDS = ['tuft', 'flowers', 'bush', 'stone'] as const;
export const DECOR_VARIANTS = 4;
JOBS['decor'] = () => {
  const out: JobOut = [];
  for (const k of DECOR_KINDS) for (let v = 0; v < DECOR_VARIANTS; v++) out.push([`decor:${k}:${v}`, cropSet([new Renderer(decor(k, v), { ...SPRITE_OPTS, shadowAlpha: 0.18 }).render()])[0]]);
  return out;
};
JOBS['fall'] = () => {
  const models = Array.from({ length: 6 }, (_, i) => {
    const m = new Model();
    m.box([0, 0, -1.6], [0.12, 0.01, 1.6], MAT.fall, 0.02);
    for (let k = 0; k < 4; k++) m.sphere([-0.09 + k * 0.06, 0.02, -0.02], 0.035, MAT.foam);
    return phased(m, i / 6);
  });
  return renderSet(models, { ...FLAT_OPTS, outline: 0 }).map((im, i) => [`fall:${i}`, im]);
};
JOBS['islets'] = () => {
  const out: JobOut = [];
  for (let i = 0; i < 5; i++) out.push([`islet:${i}`, cropSet([new Renderer(N.skyIslet(i * 7 + 3, i % 2 === 0), { pixel: true, R: 1, aa: 1, glow: 0, shadow: false }).render()])[0]]);
  return out;
};

/** World-space light offsets in 1× pixels for a sprite spec. */
export function lightPx(l: Light): [number, number, number, number] {
  return [Math.round((l[0] - l[1]) * 32), Math.round((l[0] + l[1]) * 16 - l[2] * 32), l[3], l[4]];
}
