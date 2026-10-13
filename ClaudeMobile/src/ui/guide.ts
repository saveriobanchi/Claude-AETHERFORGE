import { BUILDINGS } from '../core/content/buildings';
import { type GameState, stackTotal } from '../core/state';

function count(s: GameState, type: string): number {
  let n = 0;
  for (const b of s.buildings.values()) if (b.type === type) n++;
  return n;
}

/**
 * Gentle notes for the first hour, derived purely from the world's state.
 * They never list goals; they suggest the next natural thing to try and fall
 * silent once the player has learned to automate.
 */
export function guideNote(s: GameState): string | null {
  const k = s.known;
  const has = (t: string) => count(s, t) > 0;
  if (!has('workbench')) {
    if (s.stash.wood < 6) return 'Tap the tree to gather timber.';
    return 'Open Build and set down a Workbench.';
  }
  if (!k.has('compost')) return 'Keep gathering — leaves pile up quickly.';
  if (!has('composter')) return 'Leaves can rot into soil. Build a Compost Bin.';
  if (!k.has('land')) {
    const c = [...s.buildings.values()].find((b) => b.type === 'composter');
    if (c && stackTotal(c.outBuf) > 0) return 'Tap the bin to collect its loam.';
    if (c && stackTotal(c.inBuf) === 0 && !c.working) return 'Tap the bin and load it with leaves.';
    return 'The bin is working. Gather more while it rots.';
  }
  if (s.tiles.size < 11) return 'Grow the island: Build › Land, then tap beside the edge.';
  if (!k.has('fiber')) return 'New ground sprouts tufts of grass. Tap them for fiber.';
  if (!k.has('sieve')) {
    if (s.tiles.size < 13) return 'Room is precious. Keep the island growing.';
    return 'Loam piles up. Twist fiber into twine at the Workbench.';
  }
  if (!has('sieve')) return 'Build a Sifting Frame and see what loam hides.';
  if (!k.has('stone')) return 'Tap the Sifting Frame to sift loam from your stash.';
  if (!k.has('clay')) return 'Pebbles pack into stone at the Workbench.';
  if (!has('dew_catcher') || !has('clay_tub')) return 'Dew and loam make clay. Build a Dew Catcher and a Clay Tub.';
  if (!k.has('kiln')) return 'Feed the Clay Tub. Machines can point their output at each other.';
  if (!has('kiln')) return 'Build a Kiln. It needs fuel for anything but charcoal.';
  if (!k.has('copper')) return 'Kilns smelt copper flakes from the sieve. Load it with charcoal or timber.';
  if (!k.has('automation')) return 'Copper becomes gears at the Workbench.';
  if (!has('harvester')) return 'Build a Treewright among your trees.';
  if (!k.has('wind')) {
    if (!has('depot')) return 'Point the Treewright at a Depot — or run conveyors into one.';
    return 'Let the Treewright work. Lay conveyors to carry things to depots.';
  }
  if (!has('windmill')) return 'Build a Windmill: wind-driven machines work on their own.';
  const windDriven = [...s.buildings.values()].some((b) => BUILDINGS[b.type].power);
  if (!windDriven) return 'Wind machines need flagstone beneath them.';
  return null;
}
