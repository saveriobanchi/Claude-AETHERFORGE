import type { ItemId } from '../core/content/items';
import { iconFor } from '../render/art/icons';
import { P } from '../render/art/palette';
import { PixelCanvas, rgb, type RGBA } from '../render/art/pixel';
import { spriteFor } from '../render/art/registry';
import { beltFrames } from '../render/vox/buildings';

const cache = new Map<string, string>();

function toUrl(pc: PixelCanvas): string {
  return pc.toCanvas().toDataURL();
}

/** Draw a glyph from an ASCII bitmap: '#' main, '+' accent, '.' shade. */
function bitmap(rows: string[], main: RGBA = P.cream[2], accent: RGBA = P.gold[3], shade: RGBA = P.cream[0]): PixelCanvas {
  const h = rows.length, w = rows[0].length;
  const c = new PixelCanvas(w + 2, h + 2);
  void shade;
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '#') c.set(x + 1, y + 1, main);
    else if (ch === '+') c.set(x + 1, y + 1, accent);
  }));
  // soft drop shadow down-right only, so thin strokes stay crisp
  const sh: [number, number][] = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.alpha(x, y) > 200 && !c.alpha(x + 1, y + 1)) sh.push([x + 1, y + 1]);
  for (const [x, y] of sh) c.set(x, y, rgb(0x0a0e10, 150));
  return c;
}

const G: Record<string, string[]> = {
  build: [
    '...######....',
    '..########...',
    '..#######++..',
    '...####..++..',
    '......#+.....',
    '.....#+......',
    '....#+.......',
    '...#+........',
    '..#+.........',
    '.#+..........',
    '#+...........',
  ],
  craft: [
    '....+...+....',
    '.....+.+.....',
    '......+......',
    '.....+.+.....',
    '....+...+....',
    '.............',
    '#############',
    '#############',
    '.##.......##.',
    '.##.......##.',
    '.##.......##.',
  ],
  stash: [
    '....#####....',
    '...##...##...',
    '..##.....##..',
    '.###########.',
    '##.........##',
    '#....+++....#',
    '#....+.+....#',
    '#....+++....#',
    '#...........#',
    '#...........#',
    '##.........##',
    '.###########.',
  ],
  journal: [
    '.###########.',
    '.#+........#.',
    '.#+.#####..#.',
    '.#+........#.',
    '.#+.####...#.',
    '.#+........#.',
    '.#+.#####..#.',
    '.#+........#.',
    '.#+.###....#.',
    '.#+........#.',
    '.###########.',
    '...+.........',
  ],
  eye: [
    '.............',
    '....#####....',
    '..##.....##..',
    '.#...###...#.',
    '#...#+++#...#',
    '#...#+#+#...#',
    '#...#+++#...#',
    '.#...###...#.',
    '..##.....##..',
    '....#####....',
    '.............',
  ],
  menu: [
    '.............',
    '.###########.',
    '.............',
    '.............',
    '.###########.',
    '.............',
    '.............',
    '.###########.',
    '.............',
  ],
  close: [
    '#.......#',
    '.#.....#.',
    '..#...#..',
    '...#.#...',
    '....#....',
    '...#.#...',
    '..#...#..',
    '.#.....#.',
    '#.......#',
  ],
  rotate: [
    '...#####.....',
    '.##.....##.+.',
    '#.........#++',
    '#..........+.',
    '#............',
    '#...........#',
    '#...........#',
    '.#.........#.',
    '..##.....##..',
    '....#####....',
  ],
  trash: [
    '....###....',
    '###########',
    '.#.......#.',
    '.#.#.#.#.#.',
    '.#.#.#.#.#.',
    '.#.#.#.#.#.',
    '.#.#.#.#.#.',
    '.#.......#.',
    '..#######..',
  ],
  move: [
    '.....+.....',
    '....+++....',
    '.....#.....',
    '..+..#..+..',
    '.++#####++.',
    '..+..#..+..',
    '.....#.....',
    '....+++....',
    '.....+.....',
  ],
  check: [
    '..........#',
    '.........##',
    '........##.',
    '#......##..',
    '##....##...',
    '.##..##....',
    '..####.....',
    '...##......',
  ],
  land: [
    '.....+.....',
    '...+++++...',
    '.+++++++++.',
    '#+++++++++#',
    '###+++++###',
    '.####+####.',
    '...#####...',
    '....###....',
    '.....#.....',
  ],
  hand: [
    '....#.#.#..',
    '....#.#.#.#',
    '..#.#.#.#.#',
    '..#.#.#.#.#',
    '..#########',
    '..#########',
    '#.########.',
    '##########.',
    '.########..',
    '..######...',
  ],
  spark: [
    '.....+.....',
    '.....+.....',
    '....+#+....',
    '++++###++++',
    '....+#+....',
    '.....+.....',
    '.....+.....',
  ],
};

export function glyph(name: string): string {
  const k = 'g:' + name;
  let u = cache.get(k);
  if (!u) {
    const rows = G[name];
    u = toUrl(bitmap(rows, name === 'close' ? P.cream[1] : P.cream[2]));
    cache.set(k, u);
  }
  return u;
}

export function itemIcon(item: ItemId): string {
  const k = 'i:' + item;
  let u = cache.get(k);
  if (!u) {
    u = toUrl(iconFor(item));
    cache.set(k, u);
  }
  return u;
}

/** Building thumbnail: first frame cropped to its opaque bounds. */
export function thumb(type: string): string {
  const k = 't:' + type;
  let u = cache.get(k);
  if (!u) {
    let f: PixelCanvas;
    if (type === 'belt' || type === 'express') f = beltFrames(0, type === 'express')[0];
    else {
      const def = spriteFor(type);
      f = def.variants?.s5?.[0] ?? def.variants?.st3?.[0] ?? def.variants?.g2?.[0] ?? def.frames[0];
    }
    let x0 = f.w, y0 = f.h, x1 = 0, y1 = 0;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.alpha(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const c = new PixelCanvas(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.set(x - x0, y - y0, f.get(x, y));
    u = toUrl(c);
    cache.set(k, u);
  }
  return u;
}

/** Land tile thumbnail. */
export function landThumb(floor: 'grass' | 'stone' | 'sky'): string {
  const k = 'l:' + floor;
  let u = cache.get(k);
  if (!u) {
    const c = new PixelCanvas(34, 26);
    const top = floor === 'grass' ? P.grass : floor === 'stone' ? P.flag : P.stone;
    c.poly([[1, 9], [17, 1], [33, 9], [17, 17]], (x, y) => top[3 + ((x + y * 3) % 7 === 0 ? 1 : 0)]);
    c.poly([[1, 9], [17, 17], [17, 25], [1, 17]], floor === 'grass' ? P.soil[3] : P.rock[3]);
    c.poly([[17, 17], [33, 9], [33, 17], [17, 25]], floor === 'grass' ? P.soil[2] : P.rock[2]);
    c.line(1, 9, 17, 17, floor === 'grass' ? P.grass[1] : P.flag[2]);
    if (floor === 'sky') { c.line(8, 9, 14, 7, P.aether[4]); c.line(14, 7, 20, 10, P.aether[5]); }
    c.outline(0.7);
    u = toUrl(c);
    cache.set(k, u);
  }
  return u;
}

export function appMark(): string {
  return thumb('tree');
}

export { rgb };
