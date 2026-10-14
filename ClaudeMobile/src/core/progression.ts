import { BUILDINGS } from './content/buildings';
import { DISCOVERY_LIST, DISCOVERIES, type Cond } from './content/discoveries';
import { RECIPES } from './content/recipes';
import { LAND } from './content/world';
import { type GameState, addXp } from './state';
import { XP } from './content/renown';

export function condMet(s: GameState, c: Cond): boolean {
  switch (c.t) {
    case 'item': return (s.stats.obtained[c.item] ?? 0) >= c.n;
    case 'built': {
      let n = 0;
      for (const b of s.buildings.values()) if (b.type === c.type) n++;
      return n >= c.n;
    }
    case 'tiles': return s.tiles.size >= c.n;
    case 'event': return s.flags.has(c.e);
    case 'delivered': return s.stats.delivered >= c.n;
  }
}

/** Progress of a condition in [0,1] for gentle journal hints. */
export function condProgress(s: GameState, c: Cond): number {
  switch (c.t) {
    case 'item': return Math.min(1, (s.stats.obtained[c.item] ?? 0) / c.n);
    case 'tiles': return Math.min(1, s.tiles.size / c.n);
    case 'delivered': return Math.min(1, s.stats.delivered / c.n);
    default: return condMet(s, c) ? 1 : 0;
  }
}

export function available(s: GameState, id: string): boolean {
  const d = DISCOVERIES[id];
  return !!d && d.after.every((a) => s.known.has(a));
}

/** Checks every discovery whose prerequisites are known. Returns newly found ids. */
export function checkDiscoveries(s: GameState): string[] {
  const found: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const d of DISCOVERY_LIST) {
      if (s.known.has(d.id) || !available(s, d.id)) continue;
      if (d.when.every((c) => condMet(s, c))) {
        s.known.add(d.id);
        found.push(d.id);
        if (d.id !== 'start') addXp(s, XP.discovery);
        s.events.push({ type: 'discovery', id: d.id });
        changed = true;
      }
    }
  }
  return found;
}

export function buildingUnlocked(s: GameState, type: string): boolean {
  const u = BUILDINGS[type]?.unlock;
  return u === '' || (!!u && s.known.has(u));
}
export function recipeUnlocked(s: GameState, id: string): boolean {
  const r = RECIPES[id];
  return !!r && s.known.has(r.unlock);
}
export function landUnlocked(s: GameState, id: string): boolean {
  return s.known.has(LAND[id]?.unlock ?? '_');
}

/** The next few riddles to show in the journal (never the names). */
export function teasers(s: GameState): { id: string; hint: string; progress: number }[] {
  const out: { id: string; hint: string; progress: number }[] = [];
  for (const d of DISCOVERY_LIST) {
    if (s.known.has(d.id) || !available(s, d.id) || !d.hint) continue;
    const p = d.when.length ? d.when.reduce((a, c) => a + condProgress(s, c), 0) / d.when.length : 0;
    out.push({ id: d.id, hint: d.hint, progress: p });
  }
  return out.slice(0, 3);
}
