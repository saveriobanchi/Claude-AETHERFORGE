import { Canvas } from './iso';
import { tree } from './models/nature';
import { furnace, workbench } from './models/buildings';
import { type Floor, column, plants, pond, waterfall } from './models/terrain';
import { type Loader, TexLib } from './tex';

/** Preview: a small island rendered in one canvas (the game composes per-tile sprites the same way). */
export function island(load: Loader): Canvas {
  const L = new TexLib(load);
  const tiles: [number, number, Floor][] = [];
  const shape = [
    '..####..',
    '.######.',
    '########',
    '##SS####',
    '.#SS###.',
    '..##W#..',
  ];
  shape.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') tiles.push([x - 4, y - 3, ch === 'S' ? 'stone' : 'grass']); }));
  const has = (x: number, y: number) => tiles.some((t) => t[0] === x && t[1] === y);
  const gap = (x: number, y: number) => { for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && !has(x + dx, y + dy)) return r - 1; return 4; };
  const c = new Canvas(1000, 860, 500, 300);
  for (const [x, y, f] of tiles) {
    const d = 2 + gap(x, y) * 2 + ((x * 7 + y * 3) & 1);
    if (x === 0 && y === 2) pond(c, L, x, y, d);
    else column(c, L, f, d, (x * 5 + y) & 3, x, y);
  }
  waterfall(c, L, 0, 2, 6);
  // objects cast shadows; terrain receives them
  const at = (x: number, y: number, draw: (cc: Canvas) => void) => { c.at(x, y); c.castOn = true; draw(c); c.castOn = false; c.at(0, 0); };
  at(-2, -3, (s) => tree(s, L, 'oak', 1, 0, 6));
  at(0, -2, (s) => tree(s, L, 'beech', 2));
  at(2, -1, (s) => tree(s, L, 'pine', 3));
  at(-4, -1, (s) => tree(s, L, 'maple', 4));
  at(-1, -1, (s) => workbench(s, L));
  at(1, 0, (s) => furnace(s, L, 1));
  for (const [x, y] of [[-3, 0], [-1, 1], [0, -1], [1, 1], [3, 0], [-3, -1], [-1, -3], [2, 1], [-4, 0], [1, -2], [3, -1]] as [number, number][]) { c.at(x, y); plants(c, L, 0.5, 0.5, x * 13 + y, 3); c.at(0, 0); }
  c.finish({});
  return c;
}
