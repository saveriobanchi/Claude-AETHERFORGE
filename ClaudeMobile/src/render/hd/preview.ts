import { sawmill, windmill, workbench } from './models/craft';
import { decor } from './models/terrain';
import { tree } from './models/nature';
import { composeIsland } from './compose';
import type { Floor } from './models/terrain';
import { type Image, Renderer, type RenderOpts } from './render';
import type { Model } from './sdf';

/** Named render jobs for the preview / bake scripts. */
export const JOBS: Record<string, () => Image> = {};
const job = (name: string, make: () => Model, o: RenderOpts = {}) => { JOBS[name] = () => new Renderer(make(), o).render(); };

job('tree', () => tree(1, 0, 1, 10));
job('workbench', () => workbench());
job('sawmill', () => sawmill());
job('windmill', () => windmill(0.3));

JOBS.island = () => {
  const tiles: [number, number, Floor][] = [];
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.abs(x) + Math.abs(y) < 4) tiles.push([x, y, x === 1 && y >= -1 ? 'stone' : 'grass']);
  tiles.push([3, 0, 'grass'], [3, 1, 'grass']);
  const objs: [number, number, () => Model][] = [[-1, -1, () => tree(1, 0, 1, 6)], [-1, 1, () => workbench()], [0, -2, () => sawmill()], [2, 0, () => windmill(0.3)]];
  const deco: [number, number, () => Model][] = [];
  const kinds = ['tuft', 'flowers', 'bush', 'stone'] as const;
  const busy = new Set(objs.map(([x, y]) => `${x},${y}`));
  for (const [x, y, f] of tiles) {
    if (f !== 'grass' || busy.has(`${x},${y}`)) continue;
    for (let q = 0; q < 3; q++) {
      const h = Math.abs(Math.sin(x * 12.9 + y * 78.2 + q * 37.1) * 43758.5) % 1;
      if (h > 0.75) continue;
      const k = kinds[Math.floor(((h * 7.3) % 1) * 4)];
      const ox = ((h * 13.1) % 1) * 0.7 - 0.35, oy = ((h * 29.7) % 1) * 0.7 - 0.35;
      deco.push([x + ox, y + oy, () => decor(k, q + x * 3)]);
    }
  }
  return composeIsland(tiles, [...deco, ...objs]);
};
