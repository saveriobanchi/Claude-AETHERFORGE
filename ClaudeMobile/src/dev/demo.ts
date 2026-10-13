import * as A from '../core/actions';
import { DISCOVERY_LIST } from '../core/content/discoveries';
import { ITEM_IDS } from '../core/content/items';
import { run, stampIslet } from '../core/sim';
import { type GameState, createState } from '../core/state';

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
  A.place(s, 'depot', -2, 0);
  A.place(s, 'kiln', 3, -1, 1);
  A.place(s, 'press', 4, 1, 2);
  A.place(s, 'windmill', 6, -1);
  A.place(s, 'assembler', 5, 3, 1);
  A.place(s, 'sieve', 0, 3);
  A.place(s, 'dew_catcher', -1, 5);
  A.place(s, 'clay_tub', 1, 5);
  const d = A.place(s, 'dispatcher', 2, 1, 0).id!;
  A.setFilter(s, d, 'pebble');
  A.placeLine(s, 'belt', [{ x: 3, y: 1, dir: 0 }]);
  A.place(s, 'furnace', 6, 2);
  A.place(s, 'condenser', 7, 0);
  A.place(s, 'star_net', 0, -6);
  A.place(s, 'pylon', 3, 3);
  A.place(s, 'crate', 2, -4);
  A.place(s, 'silo', 4, -4);
  stampIslet(s, 0, -10, -3);
  run(s, 12);
  return s;
}
