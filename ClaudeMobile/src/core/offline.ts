import { BUILDINGS, TREE } from './content/buildings';
import { ITEM_IDS, type ItemId, type Stack } from './content/items';
import { OFFLINE } from './content/world';
import { run, treeMaxStock } from './sim';
import { type GameState, attuneRank, capacity, perkRank, stashAdd } from './state';

export interface OfflineReport {
  seconds: number;
  counted: number;
  gained: Stack;
  spent: Stack;
}

/** Net automated flow rates (items/s) measured over recent active play. */
export function flowRates(s: GameState): { rate: Partial<Record<ItemId, number>>; window: number } {
  const buckets = [...s.flow.hist, s.flow.cur];
  let window = 0;
  const net: Partial<Record<ItemId, number>> = {};
  for (const b of buckets) {
    window += b.dt;
    for (const k in b.inn) net[k as ItemId] = (net[k as ItemId] ?? 0) + (b.inn[k as ItemId] ?? 0);
    // what went into the forge or a trading post is not replayed offline (those don't progress while away)
    for (const k in b.out) net[k as ItemId] = (net[k as ItemId] ?? 0) - Math.max(0, (b.out[k as ItemId] ?? 0) - (b.sunk?.[k as ItemId] ?? 0));
  }
  const rate: Partial<Record<ItemId, number>> = {};
  if (window < 20) return { rate, window };
  for (const k in net) rate[k as ItemId] = (net[k as ItemId] ?? 0) / window;
  return { rate, window };
}

export function offlineCap(s: GameState): number {
  return (OFFLINE.baseCapHours + 2 * attuneRank(s, 'dreams')) * 3600;
}

/**
 * Applies time away. Short absences (< 90 s) are simulated exactly. Longer
 * ones use the measured automated net flow into the stash, at reduced
 * efficiency and capped duration. If an item the factory consumes would run
 * out, production is assumed to stop at that moment for everything.
 */
export function applyOffline(s: GameState, seconds: number): OfflineReport | null {
  if (!(seconds > 1)) return null;
  if (seconds < 90) {
    run(s, seconds);
    return null;
  }
  const counted = Math.min(seconds, offlineCap(s));
  const eff = OFFLINE.efficiency + 0.05 * attuneRank(s, 'dreams') + 0.05 * perkRank(s, 'night_shift');
  let t = counted * eff;
  const { rate } = flowRates(s);
  for (const k of ITEM_IDS) {
    const r = rate[k] ?? 0;
    if (r < 0) t = Math.min(t, s.stash[k] / -r);
  }
  const gained: Stack = {};
  const spent: Stack = {};
  for (const k of ITEM_IDS) {
    const r = rate[k] ?? 0;
    if (!r) continue;
    const amount = Math.floor(r * t);
    if (amount > 0) {
      const fit = stashAdd(s, k, Math.min(amount, Math.max(0, capacity(s) - s.stash[k])));
      if (fit) gained[k] = fit;
    } else if (amount < 0) {
      const take = Math.min(s.stash[k], -amount);
      s.stash[k] -= take;
      if (take) spent[k] = take;
    }
  }
  // The world keeps living: trees regrow, saplings mature, the sky turns.
  for (const b of s.buildings.values()) {
    const def = BUILDINGS[b.type];
    if (def.kind === 'tree') b.stock = treeMaxStock(b);
    if (def.kind === 'sapling') b.progress = Math.min(TREE.saplingGrowTime - 0.1, b.progress + seconds);
  }
  if (s.islets.summon) s.islets.summon.t = Math.min(s.islets.summon.t, 1);
  s.time += Math.min(seconds, 86400);
  run(s, 2); // settle
  return { seconds, counted, gained, spent };
}
