import { Canvas } from './iso';
import { tree } from './models/nature';
import { furnace, workbench } from './models/buildings';
import { type Floor, column, plants } from './models/terrain';
import { type Loader, TexLib } from './tex';

/** Preview: a small island rendered in one canvas (the game composes per-tile sprites the same way). */
export function island(load: Loader): Canvas {
  const L = new TexLib(load);
  const tiles: [number, number, Floor][] = [];
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.abs(x) + Math.abs(y) < 4) tiles.push([x, y, x === 1 && y >= -1 ? 'stone' : x === -2 && y === 1 ? 'sky' : 'grass']);
  tiles.push([3, 0, 'grass'], [3, 1, 'grass'], [0, 3, 'grass']);
  const has = (x: number, y: number) => tiles.some((t) => t[0] === x && t[1] === y);
  const gap = (x: number, y: number) => { for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && !has(x + dx, y + dy)) return r - 1; return 4; };
  const c = new Canvas(900, 760, 450, 260);
  for (const [x, y, f] of tiles) {
    const d = 2 + gap(x, y) * 2 + ((x * 7 + y * 3) & 1);
    column(c, L, f, d, (x * 5 + y) & 3, x, y);
  }
  // objects: trees and plants (positions in block units; tile (x,y) spans x..x+1)
  const at = (x: number, y: number, draw: (cc: Canvas) => void) => {
    const sub = new Canvas(c.w, c.h, c.ox + (x - y) * 32, c.oy + (x + y) * 16);
    // share buffers by drawing directly with an offset canvas view
    draw(sub);
    for (let k = 0; k < c.w * c.h; k++) {
      if (!sub.col[k * 4 + 3]) continue;
      const dd = sub.dep[k] + x + y;
      if (dd < c.dep[k] && c.col[k * 4 + 3]) continue;
      c.dep[k] = dd;
      c.col.set(sub.col.subarray(k * 4, k * 4 + 4), k * 4);
    }
  };
  at(-1, -1, (s) => tree(s, L, 'oak', 1, 0, 6));
  at(-2, 0, (s) => tree(s, L, 'beech', 2));
  at(2, -1, (s) => tree(s, L, 'pine', 3));
  at(0, 0, (s) => workbench(s, L));
  at(1, 1, (s) => furnace(s, L, 1));
  for (const [x, y] of [[-1, 0], [-1, 1], [0, -2], [1, 2], [3, 0], [0, 3], [-1, -2], [2, 1]] as [number, number][]) at(x, y, (s) => plants(s, L, 0.5, 0.5, x * 13 + y, 3));
  c.outline(0.55);
  return c;
}
