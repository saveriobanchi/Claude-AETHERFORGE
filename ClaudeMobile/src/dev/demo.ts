import * as A from '../core/actions';
import { DISCOVERY_LIST } from '../core/content/discoveries';
import { ITEM_IDS } from '../core/content/items';
import { run, stampIslet } from '../core/sim';
import { type GameState, addTile, createState } from '../core/state';

/** A showcase world used for visual review and dev mode. */
export function demoWorld(): GameState {
  const s = createState(7);
  for (const d of DISCOVERY_LIST) s.known.add(d.id);
  s.extraCapacity = 100000;
  for (const id of ITEM_IDS) s.stash[id] = 5000;
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
  stampIslet(s, 0, -10, -3);
  run(s, 40);
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
