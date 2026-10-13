import type { ItemId } from '../../core/content/items';
import { P } from './palette';
import { type RGBA, PixelCanvas, box, hash2, mix, rgb, shadeRamp } from './pixel';
import { flat, metal } from './materials';

const S = 16;
type IconDraw = (c: PixelCanvas) => void;

function pile(c: PixelCanvas, r: RGBA[], speck?: RGBA, seed = 1): void {
  c.ellipse(8, 11, 7, 4.5, (x, y) => {
    const l = 0.75 - (x - 8) / 18 - (y - 9) / 12 + (hash2(x, y, seed) - 0.5) * 0.35;
    if (speck && hash2(x, y, seed + 9) > 0.78) return speck;
    return shadeRamp(r, l, x, y, 0.3);
  });
}

function ingot(c: PixelCanvas, r: RGBA[], glow = false): void {
  box(c, { x: 8, y: 11 }, 0, 0, 6, 3.5, 0, 4, { top: flat(r, 'top'), left: flat(r, 'left'), right: flat(r, 'right') });
  c.line(4, 7, 8, 5, mix(r[r.length - 1], rgb(0xffffff), 0.4));
  if (glow) { c.set(6, 6, rgb(0xffffff)); c.set(10, 8, r[r.length - 1]); }
}

function gem(c: PixelCanvas, r: RGBA[], cx = 8, cy = 8, w = 5, h = 7): void {
  c.poly([[cx, cy - h], [cx + w, cy - 1], [cx, cy + h], [cx - w, cy - 1]], (x, y) => shadeRamp(r, 0.95 - (x - cx + w) / (w * 2.6) + (y < cy - 1 ? 0.12 : -0.08), x, y, 0.2));
  c.line(cx, cy - h + 1, cx, cy + h - 1, r[r.length - 1]);
}

const ICONS: Record<ItemId, IconDraw> = {
  wood: (c) => {
    c.poly([[2, 10], [10, 4], [14, 7], [6, 13]], (x, y) => shadeRamp(P.wood, 0.7 - (y - 4) / 14 + (x % 3 === 0 ? -0.12 : 0), x, y, 0.2));
    c.ellipse(4, 11.5, 2.6, 2.6, (_x, _y, d) => (d > 0.55 ? P.wood[4] : d > 0.2 ? P.wood[5] : P.wood[3]));
  },
  leaf: (c) => {
    c.poly([[2, 14], [5, 6], [12, 2], [13, 9], [7, 13]], (x, y) => shadeRamp(P.leaf, 0.85 - (x + y) / 30, x, y, 0.3));
    c.line(3, 13, 11, 4, P.leaf[1]);
  },
  sapling: (c) => {
    c.ellipse(8, 13, 5, 2, P.soil[3]);
    c.line(8, 12, 8, 6, P.wood[3]);
    c.ellipse(5.5, 6, 3, 2, (x, y) => shadeRamp(P.leaf, 0.8 - (x - 3) / 8, x, y, 0.2));
    c.ellipse(10.5, 5, 3, 2, (x, y) => shadeRamp(P.leaf, 0.7 - (x - 8) / 8, x, y, 0.2));
  },
  fiber: (c) => {
    for (let i = 0; i < 6; i++) c.line(3 + i * 2, 14, 6 + i, 2 + (i % 2) * 2, i % 2 ? rgb(0xc4b860) : rgb(0x8c9a46));
    c.line(4, 10, 12, 10, rgb(0x6e5a28));
  },
  twine: (c) => {
    c.ellipse(8, 8, 6, 6, (x, y) => shadeRamp([rgb(0x6a4a24), rgb(0x8f6a32), rgb(0xb88d44), rgb(0xd9b15e)], 0.75 - (x + y - 10) / 16 + (((x * 2 + y) % 4) === 0 ? -0.25 : 0), x, y, 0.1));
    c.line(12, 12, 15, 15, rgb(0xb88d44));
  },
  plank: (c) => {
    c.poly([[1, 9], [9, 5], [15, 8], [7, 12]], (x, y) => shadeRamp(P.wood, 0.85 - (y - 5) / 16, x, y, 0.2));
    c.poly([[1, 9], [7, 12], [7, 14], [1, 11]], P.wood[2]);
    c.poly([[7, 12], [15, 8], [15, 10], [7, 14]], P.wood[1]);
    c.line(3, 9, 9, 6, P.wood[3]);
  },
  loam: (c) => pile(c, P.soil, P.soil[5], 3),
  pebble: (c) => {
    for (const [x, y, r] of [[5, 11, 3], [10, 10, 3.5], [8, 6, 2.5]] as [number, number, number][]) c.ellipse(x, y, r, r * 0.8, (px, py) => shadeRamp(P.rock, 0.85 - (px - x + r) / (r * 3) - (py - y) / (r * 3), px, py, 0.2));
  },
  stone: (c) => box(c, { x: 8, y: 12 }, 0, 0, 5, 5, 0, 7, { top: flat(P.stone, 'top'), left: flat(P.stone, 'left'), right: flat(P.stone, 'right') }),
  dew: (c) => {
    c.poly([[8, 1], [12, 8], [8, 14], [4, 8]], (x, y) => shadeRamp(P.water, 0.9 - (x - 4) / 12, x, y, 0.2));
    c.ellipse(8, 10, 4, 4, (x, y) => shadeRamp(P.water, 0.85 - (x - 4) / 10 - (y - 8) / 12, x, y, 0.2));
    c.set(6, 8, P.water[4]);
    c.set(6, 9, rgb(0xffffff));
  },
  clay: (c) => {
    c.ellipse(8, 10, 6, 4.5, (x, y) => shadeRamp(P.clay, 0.8 - (x - 2) / 16 - (y - 6) / 14, x, y, 0.3));
    c.line(5, 9, 9, 8, P.clay[3]);
  },
  charcoal: (c) => {
    c.poly([[3, 11], [6, 5], [12, 4], [14, 10], [8, 14]], (x, y) => shadeRamp(P.rock.slice(0, 4), 0.6 - (x + y - 8) / 30 + (hash2(x, y, 4) > 0.8 ? 0.4 : 0), x, y, 0.2));
  },
  brick: (c) => box(c, { x: 8, y: 12 }, 0, 0, 6, 3, 0, 5, { top: flat(P.brick, 'top'), left: flat(P.brick, 'left'), right: flat(P.brick, 'right') }),
  copper_grit: (c) => pile(c, P.rock, P.copper[4], 5),
  copper: (c) => ingot(c, P.copper),
  gear: (c) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const tooth = Math.cos(a * 8) > 0.2 ? 1.6 : 0;
      if (d < 5 + tooth && d > 1.8) c.set(x, y, shadeRamp(P.brass, 0.75 - (dx + dy) / 18, x, y, 0.2));
    }
  },
  wire: (c) => {
    for (let k = 0; k < 4; k++) c.ellipse(8, 5 + k * 2.5, 5, 2, (_x, _y, d) => (d > 0.5 ? P.copper[3 + (k % 2)] : 0));
  },
  gravel: (c) => pile(c, P.rock, P.rock[5], 7),
  sand: (c) => pile(c, [rgb(0x8a6a3a), rgb(0xb8945a), rgb(0xd8b878), rgb(0xf0d8a0)], undefined, 8),
  iron_grit: (c) => pile(c, P.rock, P.iron[5], 9),
  iron: (c) => ingot(c, P.iron),
  glass: (c) => {
    c.poly([[3, 4], [12, 2], [13, 12], [4, 14]], (x, y) => shadeRamp(P.glass, 0.6 + ((x + y) % 9 < 2 ? 0.35 : 0), x, y, 0.2));
  },
  plate: (c) => box(c, { x: 8, y: 11 }, 0, 0, 6.5, 6.5, 0, 2, { top: metal('top'), left: flat(P.iron, 'left'), right: flat(P.iron, 'right') }),
  mechanism: (c) => {
    box(c, { x: 8, y: 13 }, 0, 0, 5, 5, 0, 7, { top: metal('top', P.iron, false), left: metal('left'), right: metal('right') });
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 6.5, dy = y + 0.5 - 9.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (d < 2.6 + (Math.cos(a * 6) > 0.3 ? 0.9 : 0) && d > 0.9) c.set(x, y, P.brass[3]);
    }
  },
  lens: (c) => {
    c.ellipse(8, 8, 6, 6, (x, y, d) => (d > 0.78 ? P.brass[2] : shadeRamp(P.glass, 0.85 - d * 0.3 + ((x - y) === 0 ? 0.2 : 0), x, y, 0.2)));
  },
  mist: (c) => {
    for (const [x, y, r] of [[5, 9, 3.5], [10, 8, 4], [8, 6, 3]] as [number, number, number][]) c.ellipse(x, y, r, r * 0.8, (px, py) => shadeRamp(P.cloud, 0.95 - (py - y + r) / (r * 4), px, py, 0.2));
    c.set(9, 10, P.aether[4]);
    c.set(6, 7, P.aether[5]);
  },
  aether: (c) => {
    c.ellipse(8, 8, 5.5, 5.5, (x, y, d) => shadeRamp(P.aether, 1 - d * 0.6 - (x - 8) / 20, x, y, 0.2));
    c.set(6, 6, rgb(0xffffff));
    c.px(2, 8, rgb(0xd8fff2, 120)); c.px(13, 9, rgb(0xd8fff2, 120)); c.px(8, 2, rgb(0xd8fff2, 120));
  },
  stardust: (c) => {
    for (const [x, y, s] of [[5, 5, 2], [11, 7, 1], [7, 11, 1], [12, 12, 2]] as [number, number, number][]) {
      c.set(x, y, P.star[3]);
      for (let k = 1; k <= s; k++) { c.set(x + k, y, P.star[2]); c.set(x - k, y, P.star[2]); c.set(x, y + k, P.star[2]); c.set(x, y - k, P.star[2]); }
    }
  },
  crystal: (c) => gem(c, P.aether),
  skystone: (c) => {
    box(c, { x: 8, y: 12 }, 0, 0, 5, 5, 0, 7, { top: flat(P.stone, 'top'), left: flat(P.stone, 'left'), right: flat(P.stone, 'right') });
    c.line(4, 9, 8, 7, P.aether[4]);
    c.line(8, 7, 9, 3, P.aether[5]);
  },
  amber: (c) => {
    c.poly([[8, 2], [12, 8], [8, 14], [4, 8]], (x, y) => shadeRamp(P.amber, 0.9 - (x - 4) / 12, x, y, 0.2));
    c.set(6, 7, P.amber[4]);
    c.set(7, 9, rgb(0x3a2410));
  },
  sunmetal: (c) => ingot(c, P.gold, true),
  cell: (c) => {
    c.rect(5, 3, 6, 10, P.glass[2]);
    c.rect(6, 5, 4, 6, P.aether[4]);
    c.set(7, 6, rgb(0xffffff));
    c.rect(4, 2, 8, 2, P.brass[3]);
    c.rect(4, 12, 8, 2, P.brass[2]);
  },
  coil: (c) => {
    for (let k = 0; k < 40; k++) {
      const a = k * 0.45;
      const r = 1 + k * 0.14;
      c.set(Math.round(8 + Math.cos(a) * r), Math.round(8 + Math.sin(a) * r), k % 3 ? P.gold[3] : P.aether[5]);
    }
  },
  core: (c) => {
    c.poly([[8, 14], [2, 7], [4, 3], [8, 5], [12, 3], [14, 7]], (x, y) => shadeRamp(P.aether, 1 - (x + y - 6) / 22, x, y, 0.2));
    c.ellipse(8, 8, 2, 2, P.gold[4]);
    c.set(5, 5, rgb(0xffffff));
  },
};

const cache = new Map<ItemId, PixelCanvas>();

export function iconFor(item: ItemId): PixelCanvas {
  let c = cache.get(item);
  if (!c) {
    c = new PixelCanvas(S, S);
    ICONS[item](c);
    c.outline(0.55);
    cache.set(item, c);
  }
  return c;
}
