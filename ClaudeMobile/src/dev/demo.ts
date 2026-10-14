import * as A from '../core/actions';
import { DISCOVERY_LIST } from '../core/content/discoveries';
import { ITEM_IDS, type ItemId } from '../core/content/items';
import { BUILDINGS } from '../core/content/buildings';
import { run, stampIslet } from '../core/sim';
import { type GameState, addTile, createState } from '../core/state';

/** A showcase world used for visual review and dev mode. */
export function demoWorld(): GameState {
  const s = createState(7);
  for (const d of DISCOVERY_LIST) s.known.add(d.id);
  s.extraCapacity = 100000;
  for (const id of ITEM_IDS) { s.stash[id] = 5000; s.stats.obtained[id] = 5000; s.stats.made[id] = Math.round(30 * Math.pow(10, (id.length % 5) * 0.8)); }
  for (let r = 2; r <= 6; r++) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (Math.abs(x) + Math.abs(y) <= r + 2) A.expand(s, 'plot', x, y);
  for (let y = -1; y <= 3; y++) for (let x = 2; x <= 6; x++) A.expand(s, 'flagstone', x, y);
  A.place(s, 'workbench', -1, -1);
  A.place(s, 'composter', 1, -2, 1);
  for (const [x, y] of [[-3, -2], [-4, 0], [-2, 2], [-5, -3], [-3, 4]]) { s.stash.sapling = 9; A.place(s, 'sapling', x, y); }
  A.place(s, 'harvester', -3, 0, 0);
  A.place(s, 'sawmill', -2, 0, 1);
  for (let y = 0; y <= 3; y++) A.expand(s, 'flagstone', -2, y);
  A.place(s, 'sawmill', -2, 0, 1);
  A.place(s, 'depot', -2, 3);
  A.place(s, 'kiln', 3, -1, 1);
  A.place(s, 'press', 4, 1, 2);
  A.place(s, 'windmill', 6, -1);
  A.place(s, 'assembler', 5, 3, 1);
  A.place(s, 'sieve', 0, 3);
  A.place(s, 'dew_catcher', -1, 5);
  A.place(s, 'clay_tub', 1, 5);
  // a sifting line: dispatcher → conveyor → wind sifter → conveyor → depot
  const d = A.place(s, 'dispatcher', 2, 4, 0).id!;
  A.setFilter(s, d, 'loam');
  for (let y = 4; y <= 6; y++) for (let x = 2; x <= 8; x++) A.expand(s, 'flagstone', x, y);
  A.placeLine(s, 'belt', [3, 4].map((x) => ({ x, y: 4, dir: 0 as const })));
  A.place(s, 'wind_sifter', 5, 4, 0);
  A.placeLine(s, 'belt', [6, 7].map((x) => ({ x, y: 4, dir: 0 as const })));
  A.place(s, 'depot', 8, 4);
  // timber line from the treewright
  A.placeLine(s, 'belt', [{ x: -2, y: 1, dir: 1 }, { x: -2, y: 2, dir: 1 }]);
  A.place(s, 'furnace', 6, 2);
  A.place(s, 'condenser', 7, 0);
  A.place(s, 'star_net', 0, -6);
  A.place(s, 'pylon', 3, 3);
  A.place(s, 'windmill', 7, 2);
  A.place(s, 'resonator', 5, 6);
  A.place(s, 'distiller', 6, 6);
  A.place(s, 'crate', 2, -4);
  A.place(s, 'silo', 4, -4);
  // trade, orchard and bees
  for (const [x, y] of [[-6, 2], [-6, 1], [-5, 3], [-4, 4]]) if (A.place(s, 'trading_post', x, y, 0).ok) break;
  for (const [x, y] of [[-5, -1], [-6, -1], [-4, -3]]) { s.stash.fruit_sapling = 9; A.place(s, 'fruit_sapling', x, y); }
  A.place(s, 'hive', -5, -2);
  A.place(s, 'lantern', -1, 3);
  A.place(s, 'lantern', 4, 5);
  // biome patches with their fruit trees
  for (const t of s.tiles.values()) {
    if (t.floor !== 'grass') continue;
    if (t.x <= -3 && t.y >= 2) t.biome = 'marsh';
    else if (t.y <= -4 && t.x >= -1) t.biome = 'dunes';
    else if (t.x <= -4 && t.y <= -3) t.biome = 'frost';
  }
  s.tileRev++;
  for (const [type, x, y] of [['pear_sapling', -4, 3], ['date_sapling', 1, -5], ['orange_sapling', 0, -6], ['plum_sapling', -5, -4], ['cherry_sapling', -2, -3]] as [string, number, number][]) {
    s.stash[BUILDINGS[type].cost && (Object.keys(BUILDINGS[type].cost)[0] as ItemId)] = 9;
    A.place(s, type, x, y);
  }
  for (const [x, y] of [[-6, -3], [1, -4]]) { s.stash.sapling = 9; A.place(s, 'sapling', x, y); }
  s.trade.marks = 140;
  // a decorated corner: paths, a fountain, gazebo, lamps, hedges and a garden
  s.chapters = 5;
  for (const id of ['patterns1', 'patterns2', 'patterns3', 'patterns4']) s.known.add(id);
  // free grass west of the trees becomes a little park
  const spots: [number, number][] = [];
  for (let y = -8; y <= 8; y++) for (let x = -10; x <= 10; x++) if (A.canPlace(s, 'bench', x, y).ok && s.tiles.get(((x + 2048) * 4096 + (y + 2048)))?.floor === 'grass') spots.push([x, y]);
  spots.sort((p, q) => Math.hypot(p[0] + 2, p[1] - 6) - Math.hypot(q[0] + 2, q[1] - 6));
  const park = ['fountain', 'stone_path', 'gazebo', 'lamp_post', 'flower_bed', 'bench', 'statue', 'stone_path', 'planter', 'well', 'hedge', 'banner', 'flower_bed', 'brick_arch', 'crystal_lamp', 'lamp_post', 'hedge', 'fence', 'fence', 'plank_path', 'bench', 'flower_bed'];
  park.forEach((t, i) => { const p = spots[i]; if (p) A.place(s, t, p[0], p[1], (i % 2) as 0 | 1); });
  s.renown = { xp: 40, level: 11, points: 4, perks: { well_oiled: 2, bountiful: 1, haggler: 1, deep_cellars: 3 }, codex: ['biomes'] };
  s.trade.level = 2;
  run(s, 40);
  for (const b of s.buildings.values()) if (b.type.endsWith('sapling')) { b.progress = 1e9; }
  stampIslet(s, 0, -10, -3);
  run(s, 1);
  return s;
}

/** A late-game showcase: islets docked, wisps flying, the Aetherforge awake. */
export function lateWorld(): GameState {
  const s = demoWorld();
  stampIslet(s, 1, 9, -6);
  stampIslet(s, 3, -6, 9);
  for (let y = -2; y <= 3; y++) for (let x = 9; x <= 13; x++) addTile(s, x, y, 'sky');
  const f = A.place(s, 'forge', 10, -1);
  if (f.ok) { s.forge.stage = 3; s.forge.request = { plank: 200, glass: 120, crystal: 30 }; }
  A.place(s, 'roost', 1, 1);
  A.place(s, 'beacon', 9, -3);
  A.place(s, 'engine', 4, -1);
  run(s, 20);
  return s;
}

/** Performance stress: a 40×40 island with ~1200 machines and conveyors. */
export function stressWorld(): GameState {
  const s = createState(3);
  for (const d of DISCOVERY_LIST) s.known.add(d.id);
  s.extraCapacity = 1_000_000;
  for (const id of ITEM_IDS) s.stash[id] = 100000;
  for (let y = -20; y < 20; y++) for (let x = -20; x < 20; x++) addTile(s, x, y, 'stone');
  for (let row = -18; row < 18; row += 3) {
    for (let x = -18; x < 16; x += 6) {
      const d = A.place(s, 'dispatcher', x, row, 0).id!;
      A.setFilter(s, d, 'loam');
      A.placeLine(s, 'belt', [1, 2].map((k) => ({ x: x + k, y: row, dir: 0 as const })));
      A.place(s, 'wind_sifter', x + 3, row, 0);
      A.place(s, 'depot', x + 4, row);
      A.place(s, 'windmill', x + 3, row + 1);
    }
  }
  run(s, 30);
  return s;
}
