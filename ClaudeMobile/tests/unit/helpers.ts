import type { ItemId } from '../../src/core/content/items';
import { ITEM_IDS } from '../../src/core/content/items';
import { DISCOVERY_LIST } from '../../src/core/content/discoveries';
import { currentRecipe, rebuildCache } from '../../src/core/sim';
import { type Building, type GameState, addTile, createState, stackTotal } from '../../src/core/state';

/** A state with everything discovered, a field of tiles and effectively unlimited stash room. */
export function sandbox(size = 8, floor: 'grass' | 'stone' = 'stone'): GameState {
  const s = createState(42);
  s.tiles.clear();
  s.buildings.clear();
  s.occ.clear();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) addTile(s, x, y, floor);
  for (const d of DISCOVERY_LIST) s.known.add(d.id);
  s.extraCapacity = 1_000_000;
  rebuildCache(s);
  return s;
}

export function give(s: GameState, items: Partial<Record<ItemId, number>>): void {
  for (const k in items) s.stash[k as ItemId] += items[k as ItemId] ?? 0;
}

function inProgress(b: Building): number {
  if (!b.working) return 0;
  const r = currentRecipe(b);
  return r ? stackTotal(r.inputs) : 0;
}

/** Every item anywhere in the world, counting consumed-but-unfinished recipe inputs. */
export function totalItems(s: GameState): number {
  let n = 0;
  for (const id of ITEM_IDS) n += s.stash[id];
  for (const b of s.buildings.values()) {
    n += stackTotal(b.inBuf) + stackTotal(b.outBuf) + b.items.length + (b.hold ? 1 : 0) + inProgress(b);
  }
  for (const w of s.wisps) n += w.carry ? w.n : 0;
  return n;
}
